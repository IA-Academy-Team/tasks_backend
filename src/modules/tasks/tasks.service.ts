import type { Prisma } from "../../../generated/prisma/client.js";
import prisma from "../../../prisma/prisma.client.js";
import { AppError } from "../../shared/http/app-error.js";
import type { AuthRole } from "../auth/auth.policies.js";
import type {
  CreateTaskInput,
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
  assigned: ["in_progress"],
  in_progress: ["done"],
  done: [],
};

interface TaskRecord {
  id: number;
  projectId: number;
  assigneeMembershipId: number | null;
  taskStatusId: number;
  taskPriorityId: number;
  title: string;
  description: string | null;
  plannedStartDate: Date;
  dueDate: Date;
  estimatedMinutes: number | null;
  deletedAt: Date | null;
  createdByUserId: number;
  createdAt: Date;
  updatedAt: Date;
  project: { id: number; name: string; status: { id: number; name: string } };
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

interface TransitionTaskActor {
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
  const { totalMinutes: actualMinutes, hasOpen: hasOpenWorkSession } = computeActualMinutes(
    task.workSessions,
    now,
  );
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
    projectId: task.projectId,
    projectName: task.project.name,
    taskStatusId: task.taskStatusId,
    status: task.status.name,
    taskPriorityId: task.taskPriorityId,
    priority: task.priority.name,
    title: task.title,
    description: task.description ?? null,
    plannedStartDate: toIsoDate(task.plannedStartDate),
    dueDate: toIsoDate(task.dueDate),
    estimatedMinutes: task.estimatedMinutes ?? null,
    actualMinutes: metrics.actualMinutes,
    deviationMinutes: metrics.deviationMinutes,
    isEstimateDelayed: metrics.isEstimateDelayed,
    isDateOverdue: metrics.isDateOverdue,
    completedAt: metrics.completedAt,
    hasOpenWorkSession: metrics.hasOpenWorkSession,
    assigneeMembershipId: task.assigneeMembershipId,
    assigneeEmployeeId: task.assigneeMembership?.employee.id ?? null,
    assigneeName: task.assigneeMembership?.employee.user.name ?? null,
    assigneeEmail: task.assigneeMembership?.employee.user.email ?? null,
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

const ensureProjectAvailableForTask = async (projectId: number) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
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

const ensureValidAssigneeMembership = async (
  projectId: number,
  assigneeMembershipId: number | null,
) => {
  if (assigneeMembershipId === null) {
    return null;
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
      assigneeMembershipId: true,
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
    },
  });

  if (!task) {
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

  if (actor.role === "employee") {
    if (!task.assigneeMembership || task.assigneeMembership.employee.userId !== actor.userId) {
      throw new AppError(
        403,
        "TASK_TRANSITION_FORBIDDEN",
        "Employee can only move tasks assigned to their active membership",
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

export const listTasks = async (query: TasksListQuery): Promise<TaskDto[]> => {
  const where: Prisma.TaskWhereInput = {};

  if (query.projectId !== undefined) {
    where.projectId = query.projectId;
  }

  const statusName = getStatusNameByFilter(query.status);
  if (statusName) {
    where.status = { name: statusName };
  }

  if (!query.includeDeleted) {
    where.deletedAt = null;
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
): Promise<TaskDto> => {
  await ensureProjectAvailableForTask(payload.projectId);
  await ensureTaskPriorityExists(payload.taskPriorityId);
  validateTaskDates(payload.plannedStartDate, payload.dueDate);
  const assignedStatusId = await getAssignedStatusId();
  const assigneeMembershipId = await ensureValidAssigneeMembership(
    payload.projectId,
    payload.assigneeMembershipId ?? null,
  );

  const createdTask = await prisma.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        projectId: payload.projectId,
        taskStatusId: assignedStatusId,
        taskPriorityId: payload.taskPriorityId,
        title: payload.title,
        description: payload.description ?? null,
        plannedStartDate: payload.plannedStartDate,
        dueDate: payload.dueDate,
        estimatedMinutes: payload.estimatedMinutes ?? null,
        assigneeMembershipId,
        createdByUserId: actorUserId,
      },
      select: { id: true },
    });

    await tx.taskStatusTransition.create({
      data: {
        taskId: task.id,
        fromStatusId: null,
        toStatusId: assignedStatusId,
        changedByUserId: actorUserId,
      },
    });

    return task;
  });

  return getTaskById(createdTask.id);
};

export const updateTask = async (
  taskId: number,
  payload: UpdateTaskInput,
): Promise<TaskDto> => {
  const existingTask = await getTaskOrThrow(taskId);
  await ensureProjectAvailableForTask(existingTask.projectId);

  if (existingTask.deletedAt) {
    throw new AppError(409, "TASK_SOFT_DELETED", "Task is deleted and cannot be modified");
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

  return getTaskById(taskId);
};

export const transitionTaskStatus = async (
  taskId: number,
  payload: TransitionTaskStatusInput,
  actor: TransitionTaskActor,
): Promise<TransitionTaskStatusResult> => {
  const task = await ensureTaskTransitionAccess(taskId, actor);
  await ensureProjectAvailableForTask(task.projectId);

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

  if (payload.toStatus !== "assigned" && task.assigneeMembershipId === null) {
    throw new AppError(
      409,
      "TASK_ASSIGNEE_REQUIRED",
      "Task must be assigned to an active member before moving to this status",
    );
  }

  const statusCatalog = await getStatusCatalog();
  const targetStatus = statusCatalog[payload.toStatus];
  const updatedAt = new Date();

  const createdTransition = await prisma.$transaction(async (tx) => {
    if (payload.toStatus === "in_progress") {
      const openSession = await tx.taskWorkSession.findFirst({
        where: {
          taskId,
          endedAt: null,
        },
        select: { id: true },
      });

      if (openSession) {
        throw new AppError(
          409,
          "TASK_WORK_SESSION_ALREADY_OPEN",
          "Task already has an open work session",
        );
      }

      await tx.taskWorkSession.create({
        data: {
          taskId,
          projectMembershipId: task.assigneeMembershipId!,
          startedByUserId: actor.userId,
          startedAt: updatedAt,
        },
      });
    }

    if (payload.toStatus === "done") {
      const openSession = await tx.taskWorkSession.findFirst({
        where: {
          taskId,
          endedAt: null,
        },
        select: { id: true },
      });

      if (!openSession) {
        throw new AppError(
          409,
          "TASK_WORK_SESSION_NOT_OPEN",
          "Task cannot be finished without an open work session",
        );
      }

      await tx.taskWorkSession.update({
        where: { id: openSession.id },
        data: {
          endedAt: updatedAt,
          endedByUserId: actor.userId,
          updatedAt,
        },
      });
    }

    await tx.task.update({
      where: { id: taskId },
      data: {
        taskStatusId: targetStatus.id,
        updatedAt,
      },
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
  await ensureProjectAvailableForTask(existingTask.projectId);

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

  return {
    id: taskId,
    deletedAt: deletedAt.toISOString(),
  };
};
