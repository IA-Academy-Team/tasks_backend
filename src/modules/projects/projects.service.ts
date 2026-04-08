import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import prisma from "../../../prisma/prisma.client.js";
import { AppError } from "../../shared/http/app-error.js";
import { createNotificationRecord } from "../notifications/notifications.service.js";
import type {
  AssignProjectMembershipInput,
  CreateProjectInput,
  ProjectMembershipsListQuery,
  ProjectsListQuery,
  ReassignProjectMembershipInput,
  ReassignProjectTasksInput,
  UpdateProjectInput,
  UpdateProjectStatusInput,
} from "./projects.schemas.js";

type ProjectAccessActor = {
  userId: number;
  role: "admin" | "employee";
};

const PROJECT_STATUS_NAMES = {
  active: "Activo",
  closed: "Cerrado",
} as const;

interface ProjectSummaryRecord {
  id: number;
  areaId: number | null;
  projectStatusId: number;
  name: string;
  description: string | null;
  startDate: Date | null;
  endDate: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  area: { id: number; name: string } | null;
  status: { id: number; name: string };
  _count: { memberships: number; tasks: number };
}

interface ProjectMembershipRecord {
  id: number;
  projectId: number;
  employeeId: number;
  assignedByUserId: number;
  endedByUserId: number | null;
  assignedAt: Date;
  unassignedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  employee: {
    id: number;
    userId: number;
    user: {
      id: number;
      name: string;
      email: string;
      isActive: boolean;
    };
    areaAssignments: Array<{
      areaId: number;
      area: { id: number; name: string };
    }>;
  };
}

export interface ProjectDto {
  id: number;
  areaId: number | null;
  areaName: string;
  projectStatusId: number;
  status: string;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  closedAt: string | null;
  activeMemberCount: number;
  totalTaskCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DeleteProjectResult {
  id: number;
  mode: "deleted" | "archived";
}

export interface ProjectMembershipDto {
  id: number;
  projectId: number;
  employeeId: number;
  employeeName: string;
  employeeEmail: string;
  employeeIsActive: boolean;
  currentAreaId: number | null;
  currentAreaName: string | null;
  assignedByUserId: number;
  endedByUserId: number | null;
  assignedAt: string;
  unassignedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReassignProjectMembershipResult {
  fromMembership: ProjectMembershipDto;
  toMembership: ProjectMembershipDto;
}

export interface ReassignProjectTasksResult {
  projectId: number;
  fromEmployeeId: number;
  toEmployeeId: number;
  reassignedTasks: number;
  targetMembershipId: number;
}

const toIsoDate = (value: Date | null): string | null => (
  value ? value.toISOString().slice(0, 10) : null
);

const toIsoDateTime = (value: Date | null): string | null => (
  value ? value.toISOString() : null
);

const mapProject = (project: ProjectSummaryRecord): ProjectDto => ({
  id: project.id,
  areaId: project.areaId,
  areaName: project.area?.name ?? "Sin area",
  projectStatusId: project.projectStatusId,
  status: project.status.name,
  name: project.name,
  description: project.description ?? null,
  startDate: toIsoDate(project.startDate),
  endDate: toIsoDate(project.endDate),
  closedAt: toIsoDateTime(project.closedAt),
  activeMemberCount: project._count.memberships,
  totalTaskCount: project._count.tasks,
  createdAt: project.createdAt.toISOString(),
  updatedAt: project.updatedAt.toISOString(),
});

const mapProjectMembership = (membership: ProjectMembershipRecord): ProjectMembershipDto => {
  const currentAreaAssignment = membership.employee.areaAssignments[0];

  return {
    id: membership.id,
    projectId: membership.projectId,
    employeeId: membership.employeeId,
    employeeName: membership.employee.user.name,
    employeeEmail: membership.employee.user.email,
    employeeIsActive: membership.employee.user.isActive,
    currentAreaId: currentAreaAssignment?.area.id ?? null,
    currentAreaName: currentAreaAssignment?.area.name ?? null,
    assignedByUserId: membership.assignedByUserId,
    endedByUserId: membership.endedByUserId,
    assignedAt: membership.assignedAt.toISOString(),
    unassignedAt: membership.unassignedAt?.toISOString() ?? null,
    isActive: membership.unassignedAt === null,
    createdAt: membership.createdAt.toISOString(),
    updatedAt: membership.updatedAt.toISOString(),
  };
};

const resolveProjectStatusIds = async () => {
  const statuses = await prisma.projectStatus.findMany({
    where: {
      name: {
        in: [
          PROJECT_STATUS_NAMES.active,
          PROJECT_STATUS_NAMES.closed,
        ],
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  const active = statuses.find((status) => status.name === PROJECT_STATUS_NAMES.active)?.id;
  const closed = statuses.find((status) => status.name === PROJECT_STATUS_NAMES.closed)?.id;

  if (!active || !closed) {
    throw new AppError(
      500,
      "PROJECT_STATUSES_NOT_CONFIGURED",
      "Project status catalog is missing required values",
    );
  }

  return { active, closed };
};

const ensureAreaActive = async (areaId: number) => {
  const area = await prisma.area.findUnique({
    where: { id: areaId },
    select: { id: true, isActive: true },
  });

  if (!area) {
    throw new AppError(404, "AREA_NOT_FOUND", "Area not found");
  }

  if (!area.isActive) {
    throw new AppError(409, "AREA_INACTIVE", "Area is inactive");
  }
};

const getProjectSummaryOrThrow = async (projectId: number): Promise<ProjectSummaryRecord> => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      area: { select: { id: true, name: true } },
      status: { select: { id: true, name: true } },
      _count: {
        select: {
          memberships: { where: { unassignedAt: null } },
          tasks: { where: { deletedAt: null } },
        },
      },
    },
  });

  if (!project) {
    throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
  }

  return project as unknown as ProjectSummaryRecord;
};

const ensureEmployeeEligibleForProject = async (employeeId: number, projectAreaId: number | null) => {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      user: {
        select: {
          id: true,
          isActive: true,
        },
      },
      areaAssignments: {
        where: { endedAt: null },
        orderBy: { assignedAt: "desc" },
        take: 1,
        select: {
          areaId: true,
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

  if (projectAreaId === null) {
    return;
  }

  const currentAreaAssignment = employee.areaAssignments[0];
  if (!currentAreaAssignment) {
    throw new AppError(
      409,
      "EMPLOYEE_WITHOUT_ACTIVE_AREA",
      "Employee must have an active area assignment",
    );
  }

  if (currentAreaAssignment.areaId !== projectAreaId) {
    throw new AppError(
      409,
      "EMPLOYEE_AREA_MISMATCH",
      "Employee active area does not match project area",
      {
        employeeAreaId: currentAreaAssignment.areaId,
        projectAreaId,
      },
    );
  }
};

const validateDateRange = (startDate: Date | null, endDate: Date | null) => {
  if (startDate && endDate && endDate < startDate) {
    throw new AppError(
      400,
      "PROJECT_INVALID_DATE_RANGE",
      "Project endDate must be greater than or equal to startDate",
    );
  }
};

const getProjectMembershipOrThrow = async (
  projectId: number,
  membershipId: number,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<ProjectMembershipRecord> => {
  const membership = await db.projectMembership.findFirst({
    where: {
      id: membershipId,
      projectId,
    },
    include: {
      employee: {
        select: {
          id: true,
          userId: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              isActive: true,
            },
          },
          areaAssignments: {
            where: { endedAt: null },
            orderBy: { assignedAt: "desc" },
            take: 1,
            select: {
              areaId: true,
              area: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (!membership) {
    throw new AppError(404, "PROJECT_MEMBERSHIP_NOT_FOUND", "Project membership not found");
  }

  return membership as unknown as ProjectMembershipRecord;
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

const assertEmployeeCanAccessProject = async (projectId: number, userId: number): Promise<void> => {
  const employeeId = await resolveEmployeeIdFromUserId(userId);

  const membership = await prisma.projectMembership.findFirst({
    where: {
      projectId,
      employeeId,
      unassignedAt: null,
    },
    select: { id: true },
  });

  if (!membership) {
    throw new AppError(403, "PROJECT_FORBIDDEN", "You do not have access to this project");
  }
};

const isPrismaErrorWithCode = (error: unknown): error is { code: string } => (
  typeof error === "object"
  && error !== null
  && "code" in error
  && typeof (error as { code: unknown }).code === "string"
);

export const listProjects = async (
  query: ProjectsListQuery,
  actor: ProjectAccessActor,
): Promise<ProjectDto[]> => {
  const where: Prisma.ProjectWhereInput = {};

  if (query.areaId !== undefined) {
    where.areaId = query.areaId;
  }

  if (query.status !== "all") {
    where.status = { name: PROJECT_STATUS_NAMES[query.status] };
  }

  if (actor.role === "employee") {
    const employeeId = await resolveEmployeeIdFromUserId(actor.userId);
    where.memberships = {
      some: {
        employeeId,
        unassignedAt: null,
      },
    };
  }

  const projects = await prisma.project.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    include: {
      area: { select: { id: true, name: true } },
      status: { select: { id: true, name: true } },
      _count: {
        select: {
          memberships: { where: { unassignedAt: null } },
          tasks: { where: { deletedAt: null } },
        },
      },
    },
  });

  return projects.map((project) => mapProject(project as unknown as ProjectSummaryRecord));
};

export const getProjectById = async (
  projectId: number,
  actor?: ProjectAccessActor,
): Promise<ProjectDto> => {
  if (actor?.role === "employee") {
    await assertEmployeeCanAccessProject(projectId, actor.userId);
  }

  const project = await getProjectSummaryOrThrow(projectId);
  return mapProject(project);
};

export const createProject = async (payload: CreateProjectInput): Promise<ProjectDto> => {
  if (payload.areaId !== undefined && payload.areaId !== null) {
    await ensureAreaActive(payload.areaId);
  }
  const resolvedStartDate = payload.startDate ?? new Date();
  validateDateRange(resolvedStartDate, payload.endDate ?? null);

  const statusIds = await resolveProjectStatusIds();

  const project = await prisma.project.create({
    data: {
      areaId: payload.areaId ?? null,
      projectStatusId: statusIds.active,
      name: payload.name,
      description: payload.description ?? null,
      startDate: resolvedStartDate,
      endDate: payload.endDate ?? null,
    },
    select: { id: true },
  }).catch((error) => {
    if (isPrismaErrorWithCode(error) && error.code === "P2002") {
      throw new AppError(
        409,
        "PROJECT_NAME_ALREADY_EXISTS_IN_AREA",
        "Project name already exists in area",
      );
    }

    throw error;
  });

  return getProjectById(project.id);
};

export const updateProject = async (
  projectId: number,
  payload: UpdateProjectInput,
): Promise<ProjectDto> => {
  const existingProject = await getProjectSummaryOrThrow(projectId);

  if (payload.areaId !== undefined && payload.areaId !== null) {
    await ensureAreaActive(payload.areaId);
  }

  const nextStartDate = payload.startDate !== undefined
    ? payload.startDate
    : existingProject.startDate;
  const nextEndDate = payload.endDate !== undefined
    ? payload.endDate
    : existingProject.endDate;

  validateDateRange(nextStartDate, nextEndDate);

  const data: {
    areaId?: number | null;
    name?: string;
    description?: string | null;
    startDate?: Date | null;
    endDate?: Date | null;
  } = {};

  if (payload.areaId !== undefined) {
    data.areaId = payload.areaId;
  }

  if (payload.name !== undefined) {
    data.name = payload.name;
  }

  if (payload.description !== undefined) {
    data.description = payload.description;
  }

  if (payload.startDate !== undefined) {
    data.startDate = payload.startDate;
  }

  if (payload.endDate !== undefined) {
    data.endDate = payload.endDate;
  }

  await prisma.project.update({
    where: { id: projectId },
    data,
    select: { id: true },
  }).catch((error) => {
    if (isPrismaErrorWithCode(error)) {
      if (error.code === "P2002") {
        throw new AppError(
          409,
          "PROJECT_NAME_ALREADY_EXISTS_IN_AREA",
          "Project name already exists in area",
        );
      }

      if (error.code === "P2025") {
        throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
      }
    }

    throw error;
  });

  return getProjectById(projectId);
};

export const updateProjectStatus = async (
  projectId: number,
  payload: UpdateProjectStatusInput,
): Promise<ProjectDto> => {
  const existingProject = await getProjectSummaryOrThrow(projectId);
  const statusIds = await resolveProjectStatusIds();

  let nextStatusId = statusIds.active;
  if (payload.status === "closed") {
    nextStatusId = statusIds.closed;
  }

  const data: {
    projectStatusId: number;
    closedAt: Date | null;
    endDate?: Date | null;
  } = {
    projectStatusId: nextStatusId,
    closedAt: payload.status === "active" ? null : new Date(),
  };

  if (payload.status !== "active") {
    const endDate = payload.endDate ?? existingProject.endDate ?? new Date();
    validateDateRange(existingProject.startDate, endDate);
    data.endDate = endDate;
  }

  await prisma.project.update({
    where: { id: projectId },
    data,
    select: { id: true },
  });

  return getProjectById(projectId);
};

export const deleteProject = async (
  projectId: number,
): Promise<DeleteProjectResult> => {
  await getProjectSummaryOrThrow(projectId);
  await prisma.$transaction(async (tx) => {
    await tx.task.deleteMany({
      where: { projectId },
    });

    await tx.projectMembership.deleteMany({
      where: { projectId },
    });

    await tx.project.delete({
      where: { id: projectId },
    });
  });

  return { id: projectId, mode: "deleted" };
};

export const listProjectMemberships = async (
  projectId: number,
  query: ProjectMembershipsListQuery,
  actor: ProjectAccessActor,
): Promise<ProjectMembershipDto[]> => {
  if (actor.role === "employee") {
    await assertEmployeeCanAccessProject(projectId, actor.userId);
  }

  await getProjectSummaryOrThrow(projectId);

  const where: Prisma.ProjectMembershipWhereInput = { projectId };

  if (query.status === "active") {
    where.unassignedAt = null;
  }

  if (query.status === "inactive") {
    where.unassignedAt = { not: null };
  }

  const memberships = await prisma.projectMembership.findMany({
    where,
    orderBy: [{ unassignedAt: "asc" }, { assignedAt: "desc" }],
    include: {
      employee: {
        select: {
          id: true,
          userId: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              isActive: true,
            },
          },
          areaAssignments: {
            where: { endedAt: null },
            orderBy: { assignedAt: "desc" },
            take: 1,
            select: {
              areaId: true,
              area: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  return memberships.map((membership) => mapProjectMembership(membership as unknown as ProjectMembershipRecord));
};

export const assignProjectMembership = async (
  projectId: number,
  payload: AssignProjectMembershipInput,
  actorUserId: number,
): Promise<ProjectMembershipDto> => {
  const project = await getProjectSummaryOrThrow(projectId);

  if (project.status.name !== PROJECT_STATUS_NAMES.active) {
    throw new AppError(
      409,
      "PROJECT_NOT_ACTIVE",
      "Project must be active to assign members",
    );
  }

  await ensureEmployeeEligibleForProject(payload.employeeId, project.areaId);

  const existingMembership = await prisma.projectMembership.findFirst({
    where: {
      projectId,
      employeeId: payload.employeeId,
      unassignedAt: null,
    },
    select: { id: true },
  });

  if (existingMembership) {
    throw new AppError(
      409,
      "PROJECT_MEMBERSHIP_ALREADY_ACTIVE",
      "Employee already has an active membership in this project",
    );
  }

  const membership = await prisma.$transaction(async (tx) => {
    const createdMembership = await tx.projectMembership.create({
      data: {
        projectId,
        employeeId: payload.employeeId,
        assignedByUserId: actorUserId,
      },
      select: { id: true },
    });

    const hydratedMembership = await getProjectMembershipOrThrow(projectId, createdMembership.id, tx);

    await createNotificationRecord({
      userId: hydratedMembership.employee.user.id,
      typeCode: "project_assignment",
      title: "Nueva asignacion de proyecto",
      message: `Te asignaron al proyecto ${project.name}.`,
      resourceType: "project",
      resourceId: project.id,
      metadata: {
        projectId: project.id,
        projectName: project.name,
        projectMembershipId: hydratedMembership.id,
        employeeId: hydratedMembership.employeeId,
        assignedByUserId: actorUserId,
      },
    }, tx);

    return hydratedMembership;
  }).catch((error) => {
    if (isPrismaErrorWithCode(error) && error.code === "P2002") {
      throw new AppError(
        409,
        "PROJECT_MEMBERSHIP_ALREADY_ACTIVE",
        "Employee already has an active membership in this project",
      );
    }

    throw error;
  });

  return mapProjectMembership(membership);
};

export const unassignProjectMembership = async (
  projectId: number,
  membershipId: number,
  actorUserId: number,
): Promise<ProjectMembershipDto> => {
  const membership = await getProjectMembershipOrThrow(projectId, membershipId);

  if (!membership.unassignedAt) {
    const updatedMembership = await prisma.projectMembership.update({
      where: { id: membershipId },
      data: {
        unassignedAt: new Date(),
        endedByUserId: actorUserId,
      },
    });

    const hydratedMembership = await getProjectMembershipOrThrow(projectId, updatedMembership.id);
    return mapProjectMembership(hydratedMembership);
  }

  return mapProjectMembership(membership);
};

export const reassignProjectMembership = async (
  projectId: number,
  membershipId: number,
  payload: ReassignProjectMembershipInput,
  actorUserId: number,
): Promise<ReassignProjectMembershipResult> => {
  const project = await getProjectSummaryOrThrow(projectId);
  const sourceMembership = await getProjectMembershipOrThrow(projectId, membershipId);

  if (sourceMembership.unassignedAt) {
    throw new AppError(
      409,
      "PROJECT_MEMBERSHIP_NOT_ACTIVE",
      "Only active memberships can be reassigned",
    );
  }

  if (sourceMembership.employeeId === payload.toEmployeeId) {
    throw new AppError(
      409,
      "PROJECT_MEMBERSHIP_SAME_EMPLOYEE",
      "Reassignment requires a different employee",
    );
  }

  await ensureEmployeeEligibleForProject(payload.toEmployeeId, project.areaId);

  const targetActiveMembership = await prisma.projectMembership.findFirst({
    where: {
      projectId,
      employeeId: payload.toEmployeeId,
      unassignedAt: null,
    },
    select: { id: true },
  });

  if (targetActiveMembership) {
    throw new AppError(
      409,
      "PROJECT_MEMBERSHIP_ALREADY_ACTIVE",
      "Target employee already has an active membership in this project",
    );
  }

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const fromMembership = await tx.projectMembership.update({
      where: { id: sourceMembership.id },
      data: {
        unassignedAt: now,
        endedByUserId: actorUserId,
      },
      include: {
        employee: {
          select: {
            id: true,
            userId: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                isActive: true,
              },
            },
            areaAssignments: {
              where: { endedAt: null },
              orderBy: { assignedAt: "desc" },
              take: 1,
              select: {
                areaId: true,
                area: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    const toMembership = await tx.projectMembership.create({
      data: {
        projectId,
        employeeId: payload.toEmployeeId,
        assignedByUserId: actorUserId,
      },
      include: {
        employee: {
          select: {
            id: true,
            userId: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                isActive: true,
              },
            },
            areaAssignments: {
              where: { endedAt: null },
              orderBy: { assignedAt: "desc" },
              take: 1,
              select: {
                areaId: true,
                area: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    await createNotificationRecord({
      userId: toMembership.employee.user.id,
      typeCode: "project_assignment",
      title: "Nueva asignacion de proyecto",
      message: `Te asignaron al proyecto ${project.name}.`,
      resourceType: "project",
      resourceId: project.id,
      metadata: {
        projectId: project.id,
        projectName: project.name,
        projectMembershipId: toMembership.id,
        employeeId: toMembership.employeeId,
        reassignedFromMembershipId: fromMembership.id,
        assignedByUserId: actorUserId,
      },
    }, tx);

    return { fromMembership, toMembership };
  }).catch((error) => {
    if (isPrismaErrorWithCode(error) && error.code === "P2002") {
      throw new AppError(
        409,
        "PROJECT_MEMBERSHIP_ALREADY_ACTIVE",
        "Target employee already has an active membership in this project",
      );
    }

    throw error;
  });

  return {
    fromMembership: mapProjectMembership(result.fromMembership as unknown as ProjectMembershipRecord),
    toMembership: mapProjectMembership(result.toMembership as unknown as ProjectMembershipRecord),
  };
};

export const reassignProjectTasks = async (
  projectId: number,
  payload: ReassignProjectTasksInput,
  actorUserId: number,
): Promise<ReassignProjectTasksResult> => {
  const project = await getProjectSummaryOrThrow(projectId);

  if (payload.fromEmployeeId === payload.toEmployeeId) {
    throw new AppError(
      409,
      "PROJECT_TASK_REASSIGN_SAME_EMPLOYEE",
      "Source and target employees must be different",
    );
  }

  await ensureEmployeeEligibleForProject(payload.toEmployeeId, project.areaId);

  const doneStatus = await prisma.taskStatus.findFirst({
    where: { name: "Terminada" },
    select: { id: true },
  });

  if (!doneStatus) {
    throw new AppError(500, "TASK_STATUS_NOT_CONFIGURED", "Task status 'Terminada' is not configured");
  }

  const sourceMemberships = await prisma.projectMembership.findMany({
    where: {
      projectId,
      employeeId: payload.fromEmployeeId,
    },
    select: { id: true },
  });

  if (sourceMemberships.length === 0) {
    throw new AppError(
      404,
      "PROJECT_MEMBERSHIP_NOT_FOUND",
      "Source employee does not have memberships in this project",
    );
  }

  const sourceMembershipIds = sourceMemberships.map((membership) => membership.id);
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    let targetMembership = await tx.projectMembership.findFirst({
      where: {
        projectId,
        employeeId: payload.toEmployeeId,
        unassignedAt: null,
      },
      select: { id: true },
    });

    if (!targetMembership) {
      targetMembership = await tx.projectMembership.create({
        data: {
          projectId,
          employeeId: payload.toEmployeeId,
          assignedByUserId: actorUserId,
          assignedAt: now,
        },
        select: { id: true },
      });
    }

    const updateResult = await tx.task.updateMany({
      where: {
        projectId,
        deletedAt: null,
        assigneeMembershipId: { in: sourceMembershipIds },
        taskStatusId: { not: doneStatus.id },
      },
      data: {
        assigneeMembershipId: targetMembership.id,
        updatedAt: now,
      },
    });

    return {
      targetMembershipId: targetMembership.id,
      reassignedTasks: updateResult.count,
    };
  });

  return {
    projectId,
    fromEmployeeId: payload.fromEmployeeId,
    toEmployeeId: payload.toEmployeeId,
    reassignedTasks: result.reassignedTasks,
    targetMembershipId: result.targetMembershipId,
  };
};
