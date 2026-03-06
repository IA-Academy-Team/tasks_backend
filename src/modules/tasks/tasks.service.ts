import type { Prisma } from "../../../generated/prisma/client.js";
import prisma from "../../../prisma/prisma.client.js";
import { AppError } from "../../shared/http/app-error.js";
import type { CreateTaskInput, TasksListQuery, UpdateTaskInput } from "./tasks.schemas.js";

const TASK_STATUS_NAMES = {
  assigned: "Asignada",
  inProgress: "En proceso",
  done: "Terminada",
} as const;

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

const mapTask = (task: TaskRecord): TaskDto => ({
  id: task.id,
  projectId: task.projectId,
  projectName: task.project.name,
  taskStatusId: task.taskStatusId,
  status: task.status.name,
  taskPriorityId: task.taskPriorityId,
  priority: task.priority.name,
  title: task.title,
  description: task.description ?? null,
  plannedStartDate: task.plannedStartDate.toISOString().slice(0, 10),
  dueDate: task.dueDate.toISOString().slice(0, 10),
  estimatedMinutes: task.estimatedMinutes ?? null,
  assigneeMembershipId: task.assigneeMembershipId,
  assigneeEmployeeId: task.assigneeMembership?.employee.id ?? null,
  assigneeName: task.assigneeMembership?.employee.user.name ?? null,
  assigneeEmail: task.assigneeMembership?.employee.user.email ?? null,
  deletedAt: task.deletedAt?.toISOString() ?? null,
  createdByUserId: task.createdByUserId,
  createdAt: task.createdAt.toISOString(),
  updatedAt: task.updatedAt.toISOString(),
});

const getTaskOrThrow = async (taskId: number): Promise<TaskRecord> => {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
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
    },
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

const getStatusNameByFilter = (status: TasksListQuery["status"]): string | null => {
  if (status === "assigned") return TASK_STATUS_NAMES.assigned;
  if (status === "in_progress") return TASK_STATUS_NAMES.inProgress;
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
    include: {
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
    },
  });

  return tasks.map((task) => mapTask(task as unknown as TaskRecord));
};

export const getTaskById = async (taskId: number): Promise<TaskDto> => {
  const task = await getTaskOrThrow(taskId);
  return mapTask(task);
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

  const createdTask = await prisma.task.create({
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
