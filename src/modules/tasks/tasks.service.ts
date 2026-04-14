import type { Prisma } from "../../../generated/prisma/client.js";
import prisma from "../../../prisma/prisma.client.js";
import { AppError } from "../../shared/http/app-error.js";
import type { AuthRole } from "../auth/auth.policies.js";
import { emitRealtimeEvent } from "../notifications/notifications.socket.js";
import { createNotificationRecord } from "../notifications/notifications.service.js";
import type {
  CreateStandaloneTaskInput,
  CreateTaskInput,
  StandaloneTasksListQuery,
  TasksListQuery,
  TransitionTaskStatusInput,
  UpdateTaskInput,
} from "./tasks.schemas.js";

const TASK_STATUS_NAMES = {
  assigned: "Asignada",
  in_progress: "En proceso",
  done: "Terminada",
} as const;

type WorkflowStatus = keyof typeof TASK_STATUS_NAMES;

const WORKFLOW_TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]> = {
  assigned: ["in_progress", "done"],
  in_progress: ["done"],
  done: [],
};

interface TaskRecord {
  id: number;
  projectId: number | null;
  assigneeMembershipId: number | null;
  assigneeEmployeeId: number | null;
  taskStatusId: number;
  taskPriorityId: number;
  title: string;
  description: string | null;
  plannedStartDate: Date;
  dueDate: Date;
  estimatedMinutes: number | null;
  reportedActualMinutes: number | null;
  completionEvidence: string | null;
  deletedAt: Date | null;
  createdByUserId: number;
  createdAt: Date;
  updatedAt: Date;
  project: { id: number; name: string; status: { id: number; name: string } } | null;
  status: { id: number; name: string };
  priority: { id: number; name: string };
  assigneeMembership: {
    id: number;
    employee: {
      id: number;
      user: {
        id: number;
        name: string;
        email: string;
        isActive: boolean;
      };
    };
  } | null;
  assigneeEmployee: {
    id: number;
    user: {
      id: number;
      name: string;
      email: string;
      isActive: boolean;
    };
  } | null;
  workSessions: Array<{
    id: number;
    startedAt: Date;
    endedAt: Date | null;
  }>;
  statusTransitions: Array<{
    changedAt: Date;
  }>;
}

export interface TaskDto {
  id: number;
  projectId: number;
  projectName: string;
  taskStatusId: number;
  status: string;
  taskPriorityId: number;
  priority: string;
  title: string;
  description: string | null;
  plannedStartDate: string;
  dueDate: string;
  estimatedMinutes: number | null;
  reportedActualMinutes: number | null;
  completionEvidence: string | null;
  actualMinutes: number;
  deviationMinutes: number | null;
  isEstimateDelayed: boolean | null;
  isDateOverdue: boolean;
  completedAt: string | null;
  hasOpenWorkSession: boolean;
  assigneeMembershipId: number | null;
  assigneeEmployeeId: number | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  deletedAt: string | null;
  createdByUserId: number;
  createdAt: string;
  updatedAt: string;
}

export interface DeleteTaskResult {
  id: number;
  deletedAt: string;
}

export interface CreateTaskResult {
  task: TaskDto;
  createdCount: number;
  createdTaskIds: number[];
}

interface TransitionTaskActor {
  userId: number;
  role: AuthRole;
}

interface TaskUpdateActor {
  userId: number;
  role: AuthRole;
}

interface StandaloneTaskActor {
  userId: number;
  role: AuthRole;
}

interface TaskListActor {
  userId: number;
  role: AuthRole;
}

interface TaskStatusTransitionDto {
  id: number;
  taskId: number;
  fromStatus: string | null;
  toStatus: string;
  changedByUserId: number;
  changedAt: string;
  notes: string | null;
}

export interface TransitionTaskStatusResult {
  task: TaskDto;
  transition: TaskStatusTransitionDto;
}

export interface TaskHistoryEntryDto {
  id: number;
  taskId: number;
  fromStatus: string | null;
  toStatus: string;
  changedAt: string;
  changedByUserId: number;
  changedByName: string;
  changedByEmail: string;
  notes: string | null;
}

const taskMetricsInclude = {
  project: {
    select: {
      id: true,
      name: true,
      status: { select: { id: true, name: true } },
    },
  },
  status: { select: { id: true, name: true } },
  priority: { select: { id: true, name: true } },
  assigneeMembership: {
    select: {
      id: true,
      employee: {
        select: {
          id: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              isActive: true,
            },
          },
        },
      },
    },
  },
  assigneeEmployee: {
    select: {
      id: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
        },
      },
    },
  },
  workSessions: {
    select: {
      id: true,
      startedAt: true,
      endedAt: true,
    },
  },
  statusTransitions: {
    where: {
      toStatus: {
        name: TASK_STATUS_NAMES.done,
      },
    },
    orderBy: {
      changedAt: "desc",
    },
    take: 1,
    select: {
      changedAt: true,
    },
  },
} satisfies Prisma.TaskInclude;

const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);

const toUtcDayNumber = (value: Date): number => {
  const iso = toIsoDate(value);
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  return Date.UTC(year, month - 1, day);
};

const computeActualMinutes = (
  workSessions: TaskRecord["workSessions"],
  now: Date,
): { totalMinutes: number; hasOpen: boolean } => {
  let totalMs = 0;
  let hasOpen = false;

  for (const session of workSessions) {
    const startedAt = session.startedAt.getTime();
    const endedAt = (session.endedAt ?? now).getTime();
    if (!session.endedAt) {
      hasOpen = true;
    }

    if (endedAt > startedAt) {
      totalMs += endedAt - startedAt;
    }
  }

  return {
    totalMinutes: Math.max(0, Math.round(totalMs / 60000)),
    hasOpen,
  };
};

const computeTaskMetrics = (task: TaskRecord, now: Date) => {
  const completedAtDate = task.statusTransitions[0]?.changedAt ?? null;
  const completedAt = completedAtDate?.toISOString() ?? null;
  const { totalMinutes: computedActualMinutes, hasOpen: hasOpenWorkSession } = computeActualMinutes(
    task.workSessions,
    now,
  );
  const actualMinutes = task.reportedActualMinutes ?? computedActualMinutes;
  const deviationMinutes = task.estimatedMinutes === null
    ? null
    : actualMinutes - task.estimatedMinutes;
  const isEstimateDelayed = task.estimatedMinutes === null
    ? null
    : actualMinutes > task.estimatedMinutes;
  const dueDay = toUtcDayNumber(task.dueDate);
  const fallbackCompletionDate = task.status.name === TASK_STATUS_NAMES.done
    ? task.updatedAt
    : now;
  const referenceDay = completedAtDate
    ? toUtcDayNumber(completedAtDate)
    : toUtcDayNumber(fallbackCompletionDate);
  const isDateOverdue = referenceDay > dueDay;

  return {
    actualMinutes,
    deviationMinutes,
    isEstimateDelayed,
    isDateOverdue,
    completedAt,
    hasOpenWorkSession,
  };
};

const mapTask = (task: TaskRecord, now: Date): TaskDto => {
  const metrics = computeTaskMetrics(task, now);

  return {
    id: task.id,
    projectId: task.projectId ?? 0,
    projectName: task.project?.name ?? "Tarea suelta",
    taskStatusId: task.taskStatusId,
    status: task.status.name,
    taskPriorityId: task.taskPriorityId,
    priority: task.priority.name,
    title: task.title,
    description: task.description ?? null,
    plannedStartDate: toIsoDate(task.plannedStartDate),
    dueDate: toIsoDate(task.dueDate),
    estimatedMinutes: task.estimatedMinutes ?? null,
    reportedActualMinutes: task.reportedActualMinutes ?? null,
    completionEvidence: task.completionEvidence ?? null,
    actualMinutes: metrics.actualMinutes,
    deviationMinutes: metrics.deviationMinutes,
    isEstimateDelayed: metrics.isEstimateDelayed,
    isDateOverdue: metrics.isDateOverdue,
    completedAt: metrics.completedAt,
    hasOpenWorkSession: metrics.hasOpenWorkSession,
    assigneeMembershipId: task.assigneeMembershipId,
    assigneeEmployeeId: task.assigneeMembership?.employee.id ?? task.assigneeEmployee?.id ?? null,
    assigneeName: task.assigneeMembership?.employee.user.name ?? task.assigneeEmployee?.user.name ?? null,
    assigneeEmail: task.assigneeMembership?.employee.user.email ?? task.assigneeEmployee?.user.email ?? null,
    deletedAt: task.deletedAt?.toISOString() ?? null,
    createdByUserId: task.createdByUserId,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
};

const getTaskOrThrow = async (taskId: number): Promise<TaskRecord> => {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: taskMetricsInclude,
  });

  if (!task) {
    throw new AppError(404, "TASK_NOT_FOUND", "Task not found");
  }

  if (task.project && task.project.status.name !== "Activo") {
    throw new AppError(404, "TASK_NOT_FOUND", "Task not found");
  }

  return task as unknown as TaskRecord;
};

const getAssignedStatusId = async () => {
  const status = await prisma.taskStatus.findFirst({
    where: { name: TASK_STATUS_NAMES.assigned },
    select: { id: true },
  });

  if (!status) {
    throw new AppError(
      500,
      "TASK_STATUS_ASSIGNED_NOT_CONFIGURED",
      "Task status catalog is missing 'Asignada'",
    );
  }

  return status.id;
};

const getWorkflowStatusByName = (statusName: string): WorkflowStatus | null => {
  if (statusName === TASK_STATUS_NAMES.assigned) return "assigned";
  if (statusName === TASK_STATUS_NAMES.in_progress) return "in_progress";
  if (statusName === TASK_STATUS_NAMES.done) return "done";
  return null;
};

const getStatusCatalog = async (): Promise<Record<WorkflowStatus, { id: number; name: string }>> => {
  const statuses = await prisma.taskStatus.findMany({
    where: {
      name: {
        in: [
          TASK_STATUS_NAMES.assigned,
          TASK_STATUS_NAMES.in_progress,
          TASK_STATUS_NAMES.done,
        ],
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  const assigned = statuses.find((status) => status.name === TASK_STATUS_NAMES.assigned);
  const inProgress = statuses.find((status) => status.name === TASK_STATUS_NAMES.in_progress);
  const done = statuses.find((status) => status.name === TASK_STATUS_NAMES.done);

  if (!assigned || !inProgress || !done) {
    throw new AppError(
      500,
      "TASK_STATUS_CATALOG_INVALID",
      "Task statuses catalog is missing required workflow values",
    );
  }

  return {
    assigned: { id: assigned.id, name: assigned.name },
    in_progress: { id: inProgress.id, name: inProgress.name },
    done: { id: done.id, name: done.name },
  };
};

const validateTaskDates = (plannedStartDate: Date, dueDate: Date) => {
  if (dueDate < plannedStartDate) {
    throw new AppError(
      400,
      "TASK_INVALID_DATE_RANGE",
      "Task dueDate must be greater than or equal to plannedStartDate",
    );
  }
};

const addDaysToDate = (source: Date, days: number): Date => {
  const result = new Date(source);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

const addMonthsToDate = (source: Date, months: number): Date => {
  const year = source.getUTCFullYear();
  const month = source.getUTCMonth();
  const day = source.getUTCDate();

  const monthAnchor = new Date(Date.UTC(year, month + months, 1));
  const lastDayOfTargetMonth = new Date(
    Date.UTC(monthAnchor.getUTCFullYear(), monthAnchor.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const targetDay = Math.min(day, lastDayOfTargetMonth);

  return new Date(
    Date.UTC(
      monthAnchor.getUTCFullYear(),
      monthAnchor.getUTCMonth(),
      targetDay,
    ),
  );
};

const buildRecurringTaskSchedule = (
  payload: Pick<CreateTaskInput, "plannedStartDate" | "dueDate" | "recurrence">,
): Array<{ plannedStartDate: Date; dueDate: Date }> => {
  if (!payload.recurrence) {
    return [{ plannedStartDate: payload.plannedStartDate, dueDate: payload.dueDate }];
  }

  const { recurrence } = payload;
  const every = recurrence.every ?? 1;
  const untilDate = recurrence.untilDate;

  if (untilDate < payload.dueDate) {
    throw new AppError(
      400,
      "TASK_RECURRENCE_UNTIL_INVALID",
      "Recurrence end date must be greater than or equal to due date",
    );
  }

  const schedule: Array<{ plannedStartDate: Date; dueDate: Date }> = [];
  let plannedStartDate = payload.plannedStartDate;
  let dueDate = payload.dueDate;
  const maxOccurrences = 400;

  while (dueDate <= untilDate) {
    schedule.push({ plannedStartDate, dueDate });
    if (schedule.length > maxOccurrences) {
      throw new AppError(
        400,
        "TASK_RECURRENCE_LIMIT_EXCEEDED",
        `Recurrence exceeded the allowed maximum of ${maxOccurrences} tasks`,
      );
    }

    if (recurrence.frequency === "monthly") {
      plannedStartDate = addMonthsToDate(plannedStartDate, every);
      dueDate = addMonthsToDate(dueDate, every);
      continue;
    }

    const daysStep = recurrence.frequency === "weekly" ? every * 7 : every;
    plannedStartDate = addDaysToDate(plannedStartDate, daysStep);
    dueDate = addDaysToDate(dueDate, daysStep);
  }

  if (schedule.length === 0) {
    throw new AppError(
      400,
      "TASK_RECURRENCE_EMPTY_SCHEDULE",
      "Recurrence configuration produced no task instances",
    );
  }

  return schedule;
};

const ensureProjectAvailableForTask = async (projectId: number) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      status: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!project) {
    throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
  }

  if (project.status.name !== "Activo") {
    throw new AppError(409, "PROJECT_NOT_ACTIVE", "Project must be active to manage tasks");
  }

  return project;
};

const ensureTaskPriorityExists = async (taskPriorityId: number) => {
  const priority = await prisma.taskPriority.findUnique({
    where: { id: taskPriorityId },
    select: { id: true },
  });

  if (!priority) {
    throw new AppError(404, "TASK_PRIORITY_NOT_FOUND", "Task priority not found");
  }
};

const resolveEmployeeIdFromUserId = async (userId: number): Promise<number> => {
  const employee = await prisma.employee.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!employee) {
    throw new AppError(403, "EMPLOYEE_PROFILE_REQUIRED", "Employee profile is required");
  }

  return employee.id;
};

const ensureStandaloneAssigneeEmployee = async (employeeId: number) => {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      user: {
        select: {
          id: true,
          isActive: true,
        },
      },
    },
  });

  if (!employee) {
    throw new AppError(404, "EMPLOYEE_NOT_FOUND", "Employee not found");
  }

  if (!employee.user.isActive) {
    throw new AppError(409, "EMPLOYEE_INACTIVE", "Employee is inactive");
  }

  return employee;
};

const ensureValidAssigneeMembership = async (
  projectId: number | null,
  assigneeMembershipId: number | null,
) => {
  if (assigneeMembershipId === null) {
    return null;
  }

  if (projectId === null) {
    throw new AppError(
      409,
      "TASK_ASSIGNEE_MEMBERSHIP_INVALID",
      "Standalone task cannot be assigned through project memberships",
    );
  }

  const membership = await prisma.projectMembership.findUnique({
    where: { id: assigneeMembershipId },
    include: {
      employee: {
        select: {
          id: true,
          user: {
            select: {
              id: true,
              isActive: true,
            },
          },
        },
      },
    },
  });

  if (!membership || membership.projectId !== projectId || membership.unassignedAt !== null) {
    throw new AppError(
      409,
      "TASK_ASSIGNEE_MEMBERSHIP_INVALID",
      "Task assignee membership must be active and belong to task project",
    );
  }

  if (!membership.employee.user.isActive) {
    throw new AppError(
      409,
      "TASK_ASSIGNEE_INACTIVE",
      "Task assignee employee is inactive",
    );
  }

  return membership.id;
};

const ensureTaskTransitionAccess = async (taskId: number, actor: TransitionTaskActor) => {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      projectId: true,
      project: {
        select: {
          status: {
            select: {
              name: true,
            },
          },
        },
      },
      createdByUserId: true,
      assigneeMembershipId: true,
      assigneeEmployeeId: true,
      estimatedMinutes: true,
      taskStatusId: true,
      deletedAt: true,
      status: {
        select: {
          id: true,
          name: true,
        },
      },
      assigneeMembership: {
        select: {
          id: true,
          projectId: true,
          unassignedAt: true,
          employee: {
            select: {
              id: true,
              userId: true,
              user: {
                select: {
                  isActive: true,
                },
              },
            },
          },
        },
      },
      assigneeEmployee: {
        select: {
          id: true,
          userId: true,
          user: {
            select: {
              isActive: true,
            },
          },
        },
      },
    },
  });

  if (!task) {
    throw new AppError(404, "TASK_NOT_FOUND", "Task not found");
  }

  if (task.projectId !== null && task.project?.status.name !== "Activo") {
    throw new AppError(404, "TASK_NOT_FOUND", "Task not found");
  }

  if (task.deletedAt) {
    throw new AppError(409, "TASK_SOFT_DELETED", "Task is deleted and cannot be moved");
  }

  if (task.assigneeMembership && task.assigneeMembership.unassignedAt !== null) {
    throw new AppError(
      409,
      "TASK_ASSIGNEE_MEMBERSHIP_INACTIVE",
      "Task assignee membership is no longer active",
    );
  }

  if (task.assigneeMembership && !task.assigneeMembership.employee.user.isActive) {
    throw new AppError(
      409,
      "TASK_ASSIGNEE_INACTIVE",
      "Task assignee employee is inactive",
    );
  }

  if (task.assigneeEmployee && !task.assigneeEmployee.user.isActive) {
    throw new AppError(
      409,
      "TASK_ASSIGNEE_INACTIVE",
      "Task assignee employee is inactive",
    );
  }

  if (actor.role === "employee") {
    const isStandaloneTask = task.projectId === null;
    const canMoveStandaloneTask = (
      isStandaloneTask
      && task.assigneeEmployee !== null
      && task.assigneeEmployee.userId === actor.userId
    );
    const canMoveProjectTask = (
      task.assigneeMembership
      && task.assigneeMembership.employee.userId === actor.userId
    );

    if (!canMoveStandaloneTask && !canMoveProjectTask) {
      throw new AppError(
        403,
        "TASK_TRANSITION_FORBIDDEN",
        "Employee can only move own standalone tasks or tasks assigned to their active membership",
      );
    }
  }

  return task;
};

const getStatusNameByFilter = (status: TasksListQuery["status"]): string | null => {
  if (status === "assigned") return TASK_STATUS_NAMES.assigned;
  if (status === "in_progress") return TASK_STATUS_NAMES.in_progress;
  if (status === "done") return TASK_STATUS_NAMES.done;
  return null;
};

export const listTasks = async (
  query: TasksListQuery,
  actor: TaskListActor,
): Promise<TaskDto[]> => {
  const whereClauses: Prisma.TaskWhereInput[] = [];

  if (query.projectId !== undefined) {
    whereClauses.push({ projectId: query.projectId });
    whereClauses.push({
      project: {
        status: {
          name: "Activo",
        },
      },
    });
  } else if (!query.includeStandalone) {
    whereClauses.push({ projectId: { not: null } });
    whereClauses.push({
      project: {
        status: {
          name: "Activo",
        },
      },
    });
  } else {
    whereClauses.push({
      OR: [
        { projectId: null },
        {
          project: {
            status: {
              name: "Activo",
            },
          },
        },
      ],
    });
  }

  const statusName = getStatusNameByFilter(query.status);
  if (statusName) {
    whereClauses.push({ status: { name: statusName } });
  }

  if (!query.includeDeleted) {
    whereClauses.push({ deletedAt: null });
  }

  if (actor.role === "employee") {
    whereClauses.push({
      OR: [
        {
          assigneeMembership: {
            is: {
              unassignedAt: null,
              employee: {
                userId: actor.userId,
              },
            },
          },
        },
        {
          assigneeEmployee: {
            is: {
              userId: actor.userId,
            },
          },
        },
      ],
    });
  }

  const tasks = await prisma.task.findMany({
    where: {
      AND: whereClauses,
    },
    orderBy: [{ dueDate: "asc" }, { id: "desc" }],
    include: taskMetricsInclude,
  });

  const now = new Date();
  return tasks.map((task) => mapTask(task as unknown as TaskRecord, now));
};

export const listStandaloneTasks = async (
  query: StandaloneTasksListQuery,
  actor: StandaloneTaskActor,
): Promise<TaskDto[]> => {
  const where: Prisma.TaskWhereInput = {
    projectId: null,
  };

  const statusName = getStatusNameByFilter(query.status);
  if (statusName) {
    where.status = { name: statusName };
  }

  if (!query.includeDeleted) {
    where.deletedAt = null;
  }

  if (actor.role === "employee") {
    where.assigneeEmployee = {
      userId: actor.userId,
    };
  }

  const tasks = await prisma.task.findMany({
    where,
    orderBy: [{ dueDate: "asc" }, { id: "desc" }],
    include: taskMetricsInclude,
  });

  const now = new Date();
  return tasks.map((task) => mapTask(task as unknown as TaskRecord, now));
};

export const getTaskById = async (taskId: number): Promise<TaskDto> => {
  const task = await getTaskOrThrow(taskId);
  return mapTask(task, new Date());
};

export const createTask = async (
  payload: CreateTaskInput,
  actorUserId: number,
): Promise<CreateTaskResult> => {
  const project = await ensureProjectAvailableForTask(payload.projectId);
  await ensureTaskPriorityExists(payload.taskPriorityId);
  validateTaskDates(payload.plannedStartDate, payload.dueDate);
  const recurrenceSchedule = buildRecurringTaskSchedule(payload);
  const assignedStatusId = await getAssignedStatusId();
  const assigneeMembershipId = await ensureValidAssigneeMembership(
    payload.projectId,
    payload.assigneeMembershipId ?? null,
  );

  const createdTaskIds = await prisma.$transaction(async (tx) => {
    const createdIds: number[] = [];
    const membership = assigneeMembershipId === null
      ? null
      : await tx.projectMembership.findUnique({
          where: { id: assigneeMembershipId },
          select: {
            id: true,
            employeeId: true,
            employee: {
              select: {
                userId: true,
              },
            },
          },
        });

    for (const occurrence of recurrenceSchedule) {
      const task = await tx.task.create({
        data: {
          projectId: payload.projectId,
          taskStatusId: assignedStatusId,
          taskPriorityId: payload.taskPriorityId,
          title: payload.title,
          description: payload.description ?? null,
          plannedStartDate: occurrence.plannedStartDate,
          dueDate: occurrence.dueDate,
          estimatedMinutes: payload.estimatedMinutes ?? null,
          assigneeMembershipId,
          createdByUserId: actorUserId,
        },
        select: { id: true },
      });

      createdIds.push(task.id);

      await tx.taskStatusTransition.create({
        data: {
          taskId: task.id,
          fromStatusId: null,
          toStatusId: assignedStatusId,
          changedByUserId: actorUserId,
        },
      });

      if (membership) {
        await createNotificationRecord({
          userId: membership.employee.userId,
          typeCode: "task_assignment",
          title: "Nueva tarea asignada",
          message: `Te asignaron la tarea \"${payload.title}\" en ${project.name}.`,
          resourceType: "task",
          resourceId: task.id,
          metadata: {
            taskId: task.id,
            taskTitle: payload.title,
            projectId: project.id,
            projectName: project.name,
            projectMembershipId: membership.id,
            employeeId: membership.employeeId,
            assignedByUserId: actorUserId,
          },
        }, tx);
      }
    }

    return createdIds;
  });

  const primaryTaskId = createdTaskIds.at(0);
  if (!primaryTaskId) {
    throw new AppError(500, "TASK_CREATION_FAILED", "Task creation did not produce any records");
  }

  const primaryTask = await getTaskById(primaryTaskId);
  emitRealtimeEvent("task:created", {
    task: primaryTask,
    createdCount: createdTaskIds.length,
    createdTaskIds,
    issuedAt: new Date().toISOString(),
  });
  emitRealtimeEvent("analytics:updated", {
    entity: "task",
    action: "created",
    taskId: primaryTask.id,
    projectId: primaryTask.projectId,
    issuedAt: new Date().toISOString(),
  }, "admin");
  return {
    task: primaryTask,
    createdCount: createdTaskIds.length,
    createdTaskIds,
  };
};

export const createStandaloneTask = async (
  payload: CreateStandaloneTaskInput,
  actor: StandaloneTaskActor,
) => {
  await ensureTaskPriorityExists(payload.taskPriorityId);
  validateTaskDates(payload.plannedStartDate, payload.dueDate);
  const recurrenceSchedule = buildRecurringTaskSchedule(payload);
  const assignedStatusId = await getAssignedStatusId();
  const assigneeEmployeeId = actor.role === "employee"
    ? await resolveEmployeeIdFromUserId(actor.userId)
    : payload.assigneeEmployeeId ?? null;

  if (assigneeEmployeeId === null) {
    throw new AppError(
      400,
      "TASK_STANDALONE_ASSIGNEE_REQUIRED",
      "Standalone task requires an assignee employee",
    );
  }

  const assigneeEmployee = await ensureStandaloneAssigneeEmployee(assigneeEmployeeId);

  const createdTaskIds = await prisma.$transaction(async (tx) => {
    const createdIds: number[] = [];

    for (const occurrence of recurrenceSchedule) {
      const task = await tx.task.create({
        data: {
          projectId: null,
          taskStatusId: assignedStatusId,
          taskPriorityId: payload.taskPriorityId,
          title: payload.title,
          description: payload.description ?? null,
          plannedStartDate: occurrence.plannedStartDate,
          dueDate: occurrence.dueDate,
          estimatedMinutes: payload.estimatedMinutes ?? null,
          assigneeMembershipId: null,
          assigneeEmployeeId: assigneeEmployee.id,
          createdByUserId: actor.userId,
        },
        select: { id: true },
      });

      createdIds.push(task.id);

      await tx.taskStatusTransition.create({
        data: {
          taskId: task.id,
          fromStatusId: null,
          toStatusId: assignedStatusId,
          changedByUserId: actor.userId,
        },
      });

      await createNotificationRecord({
        userId: assigneeEmployee.user.id,
        typeCode: "task_assignment",
        title: "Nueva tarea suelta asignada",
        message: `Te asignaron la tarea suelta \"${payload.title}\".`,
        resourceType: "task",
        resourceId: task.id,
        metadata: {
          taskId: task.id,
          taskTitle: payload.title,
          employeeId: assigneeEmployee.id,
          assignedByUserId: actor.userId,
          isStandalone: true,
        },
      }, tx);
    }

    return createdIds;
  });

  const primaryTaskId = createdTaskIds.at(0);
  if (!primaryTaskId) {
    throw new AppError(500, "TASK_CREATION_FAILED", "Task creation did not produce any records");
  }

  const primaryTask = await getTaskById(primaryTaskId);
  emitRealtimeEvent("task:created", {
    task: primaryTask,
    createdCount: createdTaskIds.length,
    createdTaskIds,
    issuedAt: new Date().toISOString(),
  });
  emitRealtimeEvent("analytics:updated", {
    entity: "task",
    action: "created",
    taskId: primaryTask.id,
    projectId: primaryTask.projectId,
    issuedAt: new Date().toISOString(),
  }, "admin");
  return {
    task: primaryTask,
    createdCount: createdTaskIds.length,
    createdTaskIds,
  };
};

export const updateTask = async (
  taskId: number,
  payload: UpdateTaskInput,
  actor: TaskUpdateActor,
): Promise<TaskDto> => {
  const existingTask = await getTaskOrThrow(taskId);
  const project = existingTask.projectId === null
    ? null
    : await ensureProjectAvailableForTask(existingTask.projectId);

  if (existingTask.deletedAt) {
    throw new AppError(409, "TASK_SOFT_DELETED", "Task is deleted and cannot be modified");
  }

  if (actor.role === "employee" && existingTask.createdByUserId !== actor.userId) {
    throw new AppError(
      403,
      "TASK_UPDATE_FORBIDDEN",
      "Employee can only edit full task details for tasks they created",
    );
  }

  const nextPlannedStartDate = payload.plannedStartDate ?? existingTask.plannedStartDate;
  const nextDueDate = payload.dueDate ?? existingTask.dueDate;
  validateTaskDates(nextPlannedStartDate, nextDueDate);

  if (payload.taskPriorityId !== undefined) {
    await ensureTaskPriorityExists(payload.taskPriorityId);
  }

  const assigneeMembershipId = payload.assigneeMembershipId !== undefined
    ? await ensureValidAssigneeMembership(existingTask.projectId, payload.assigneeMembershipId)
    : undefined;

  const data: {
    title?: string;
    description?: string | null;
    plannedStartDate?: Date;
    dueDate?: Date;
    taskPriorityId?: number;
    assigneeMembershipId?: number | null;
    estimatedMinutes?: number | null;
  } = {};

  if (payload.title !== undefined) {
    data.title = payload.title;
  }

  if (payload.description !== undefined) {
    data.description = payload.description;
  }

  if (payload.plannedStartDate !== undefined) {
    data.plannedStartDate = payload.plannedStartDate;
  }

  if (payload.dueDate !== undefined) {
    data.dueDate = payload.dueDate;
  }

  if (payload.taskPriorityId !== undefined) {
    data.taskPriorityId = payload.taskPriorityId;
  }

  if (assigneeMembershipId !== undefined) {
    data.assigneeMembershipId = assigneeMembershipId;
  }

  if (payload.estimatedMinutes !== undefined) {
    data.estimatedMinutes = payload.estimatedMinutes;
  }

  await prisma.task.update({
    where: { id: taskId },
    data,
  });

  if (
    assigneeMembershipId !== undefined
    && assigneeMembershipId !== null
    && assigneeMembershipId !== existingTask.assigneeMembershipId
  ) {
    const membership = await prisma.projectMembership.findUnique({
      where: { id: assigneeMembershipId },
      select: {
        id: true,
        employeeId: true,
        employee: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (membership) {
      await createNotificationRecord({
        userId: membership.employee.userId,
        typeCode: "task_assignment",
        title: "Nueva tarea asignada",
          message: `Te asignaron la tarea \"${payload.title ?? existingTask.title}\" en ${project?.name ?? "tareas sueltas"}.`,
        resourceType: "task",
        resourceId: taskId,
        metadata: {
          taskId,
          taskTitle: payload.title ?? existingTask.title,
          projectId: project?.id ?? null,
          projectName: project?.name ?? "Tarea suelta",
          projectMembershipId: membership.id,
          employeeId: membership.employeeId,
        },
      });
    }
  }

  const updatedTask = await getTaskById(taskId);
  emitRealtimeEvent("task:updated", {
    task: updatedTask,
    issuedAt: new Date().toISOString(),
  });
  emitRealtimeEvent("analytics:updated", {
    entity: "task",
    action: "updated",
    taskId: updatedTask.id,
    projectId: updatedTask.projectId,
    issuedAt: new Date().toISOString(),
  }, "admin");
  return updatedTask;
};

export const transitionTaskStatus = async (
  taskId: number,
  payload: TransitionTaskStatusInput,
  actor: TransitionTaskActor,
): Promise<TransitionTaskStatusResult> => {
  const task = await ensureTaskTransitionAccess(taskId, actor);
  const projectId = task.projectId;
  const isStandaloneTask = projectId === null;
  if (projectId !== null) {
    await ensureProjectAvailableForTask(projectId);
  }

  const currentWorkflowStatus = getWorkflowStatusByName(task.status.name);
  if (!currentWorkflowStatus) {
    throw new AppError(
      409,
      "TASK_STATUS_NOT_WORKFLOW",
      "Current task status is outside the workflow",
    );
  }

  if (currentWorkflowStatus === payload.toStatus) {
    throw new AppError(409, "TASK_STATUS_UNCHANGED", "Task is already in requested status");
  }

  const allowedTargets = WORKFLOW_TRANSITIONS[currentWorkflowStatus];
  if (!allowedTargets.includes(payload.toStatus)) {
    throw new AppError(
      409,
      "TASK_TRANSITION_NOT_ALLOWED",
      `Transition from ${task.status.name} to ${TASK_STATUS_NAMES[payload.toStatus]} is not allowed`,
    );
  }

  if (!isStandaloneTask && payload.toStatus !== "assigned" && task.assigneeMembershipId === null) {
    throw new AppError(
      409,
      "TASK_ASSIGNEE_REQUIRED",
      "Task must be assigned to an active member before moving to this status",
    );
  }

  const statusCatalog = await getStatusCatalog();
  const targetStatus = statusCatalog[payload.toStatus];
  const updatedAt = new Date();
  const completionEvidence = payload.completionEvidence ?? null;
  const reportedActualMinutes = payload.actualMinutes ?? null;

  if (payload.toStatus === "done" && reportedActualMinutes === null) {
    throw new AppError(
      400,
      "TASK_REPORTED_ACTUAL_MINUTES_REQUIRED",
      "Task completion requires reported actual minutes",
    );
  }

  const createdTransition = await prisma.$transaction(async (tx) => {
    if (!isStandaloneTask && payload.toStatus === "in_progress") {
      const openSession = await tx.taskWorkSession.findFirst({
        where: {
          taskId,
          endedAt: null,
        },
        select: { id: true },
      });

      if (!openSession) {
        await tx.taskWorkSession.create({
          data: {
            taskId,
            projectMembershipId: task.assigneeMembershipId!,
            startedByUserId: actor.userId,
            startedAt: updatedAt,
          },
        });
      }
    }

    if (!isStandaloneTask && payload.toStatus === "done") {
      const openSession = await tx.taskWorkSession.findFirst({
        where: {
          taskId,
          endedAt: null,
        },
        select: { id: true },
      });

      if (!openSession) {
        const fallbackActualMinutes = Math.max(
          1,
          reportedActualMinutes ?? task.estimatedMinutes ?? 1,
        );
        const fallbackStartedAt = new Date(updatedAt.getTime() - (fallbackActualMinutes * 60 * 1000));

        // Allow closing legacy/inconsistent tasks already in progress without an open session.
        await tx.taskWorkSession.create({
          data: {
            taskId,
            projectMembershipId: task.assigneeMembershipId!,
            startedByUserId: actor.userId,
            endedByUserId: actor.userId,
            startedAt: fallbackStartedAt,
            endedAt: updatedAt,
            updatedAt,
          },
        });
      } else {
        await tx.taskWorkSession.update({
          where: { id: openSession.id },
          data: {
            endedAt: updatedAt,
            endedByUserId: actor.userId,
            updatedAt,
          },
        });
      }
    }

    const taskUpdateData: Prisma.TaskUncheckedUpdateInput = {
      taskStatusId: targetStatus.id,
      updatedAt,
    };
    if (payload.toStatus === "done") {
      taskUpdateData.reportedActualMinutes = reportedActualMinutes;
      taskUpdateData.completionEvidence = completionEvidence;
    }

    await tx.task.update({
      where: { id: taskId },
      data: taskUpdateData,
    });

    return tx.taskStatusTransition.create({
      data: {
        taskId,
        fromStatusId: task.taskStatusId,
        toStatusId: targetStatus.id,
        changedByUserId: actor.userId,
        changedAt: updatedAt,
        notes: payload.notes ?? null,
      },
    });
  });

  const updatedTask = await getTaskById(taskId);
  emitRealtimeEvent("task:updated", {
    task: updatedTask,
    transition: {
      fromStatus: task.status.name,
      toStatus: targetStatus.name,
    },
    issuedAt: new Date().toISOString(),
  });
  emitRealtimeEvent("analytics:updated", {
    entity: "task",
    action: "status_transition",
    taskId: updatedTask.id,
    projectId: updatedTask.projectId,
    issuedAt: new Date().toISOString(),
  }, "admin");
  return {
    task: updatedTask,
    transition: {
      id: createdTransition.id,
      taskId: createdTransition.taskId,
      fromStatus: task.status.name,
      toStatus: targetStatus.name,
      changedByUserId: createdTransition.changedByUserId,
      changedAt: createdTransition.changedAt.toISOString(),
      notes: createdTransition.notes ?? null,
    },
  };
};

export const getTaskHistory = async (taskId: number): Promise<TaskHistoryEntryDto[]> => {
  await getTaskOrThrow(taskId);

  const history = await prisma.taskStatusTransition.findMany({
    where: { taskId },
    orderBy: { changedAt: "asc" },
    select: {
      id: true,
      taskId: true,
      changedAt: true,
      changedByUserId: true,
      notes: true,
      fromStatus: { select: { name: true } },
      toStatus: { select: { name: true } },
      changedByUser: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  return history.map((entry) => ({
    id: entry.id,
    taskId: entry.taskId,
    fromStatus: entry.fromStatus?.name ?? null,
    toStatus: entry.toStatus.name,
    changedAt: entry.changedAt.toISOString(),
    changedByUserId: entry.changedByUserId,
    changedByName: entry.changedByUser.name,
    changedByEmail: entry.changedByUser.email,
    notes: entry.notes ?? null,
  }));
};

export const deleteTask = async (taskId: number): Promise<DeleteTaskResult> => {
  const existingTask = await getTaskOrThrow(taskId);
  if (existingTask.projectId !== null) {
    await ensureProjectAvailableForTask(existingTask.projectId);
  }

  if (existingTask.deletedAt) {
    return {
      id: existingTask.id,
      deletedAt: existingTask.deletedAt.toISOString(),
    };
  }

  const deletedAt = new Date();
  await prisma.task.update({
    where: { id: taskId },
    data: { deletedAt },
  });

  const result = {
    id: taskId,
    deletedAt: deletedAt.toISOString(),
  };
  emitRealtimeEvent("task:deleted", {
    taskId,
    deletedAt: result.deletedAt,
    issuedAt: new Date().toISOString(),
  });
  emitRealtimeEvent("analytics:updated", {
    entity: "task",
    action: "deleted",
    taskId,
    projectId: existingTask.projectId ?? 0,
    issuedAt: new Date().toISOString(),
  }, "admin");
  return result;
};
