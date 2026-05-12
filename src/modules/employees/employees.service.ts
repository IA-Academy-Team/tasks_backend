import bcrypt from "bcrypt";
import prisma from "../../../prisma/prisma.client.js";
import { AppError } from "../../shared/http/app-error.js";
import { emitRealtimeEvent } from "../notifications/notifications.socket.js";
import type { AuthRole } from "../auth/auth.policies.js";
import { createNotificationRecord } from "../notifications/notifications.service.js";
import type {
  EmployeeAssignmentsListQuery,
  CreateEmployeeInput,
  EmployeesListQuery,
  UpdateEmployeeInput,
} from "./employees.schemas.js";

interface EmployeeWithRelations {
  id: number;
  userId: number;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: number;
    name: string;
    email: string;
    roleId: number;
    isActive: boolean;
    emailVerified: boolean;
    phoneNumber: string | null;
    image: string | null;
  };
  areaAssignments: Array<{
    areaId: number;
    assignedAt: Date;
    endedAt: Date | null;
    area: { id: number; name: string };
  }>;
}

export interface EmployeeDto {
  id: number;
  userId: number;
  name: string;
  email: string;
  role: AuthRole;
  roleId: number;
  emailVerified: boolean;
  isActive: boolean;
  phoneNumber: string | null;
  image: string | null;
  currentAreaId: number | null;
  currentAreaName: string | null;
  areaIds: number[];
  areaNames: string[];
  assignedAreaIds: number[];
  assignedAreaNames: string[];
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeAreaAssignmentDto {
  id: number;
  employeeId: number;
  areaId: number;
  areaName: string;
  assignedByUserId: number;
  endedByUserId: number | null;
  assignedAt: string;
  endedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeProjectMembershipDto {
  id: number;
  employeeId: number;
  projectId: number;
  projectName: string;
  projectStatus: string;
  projectAreaId: number | null;
  projectAreaName: string;
  assignedByUserId: number;
  endedByUserId: number | null;
  assignedAt: string;
  unassignedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DeleteEmployeeResult {
  id: number;
  mode: "deleted";
}

const normalizeRoleName = (roleId: number): AuthRole => {
  if (roleId === 1) return "admin";
  if (roleId === 3) return "leader";
  return "employee";
};

const mapEmployee = (employee: EmployeeWithRelations): EmployeeDto => {
  const sortedAssignments = [...employee.areaAssignments]
    .sort((left, right) => right.assignedAt.getTime() - left.assignedAt.getTime());
  const sortedActiveAssignments = [...employee.areaAssignments]
    .filter((assignment) => assignment.endedAt === null)
    .sort((left, right) => right.assignedAt.getTime() - left.assignedAt.getTime());
  const currentAreaAssignment = sortedActiveAssignments[0];

  const assignedAreaById = new Map<number, string>();
  sortedAssignments.forEach((assignment) => {
    if (!assignedAreaById.has(assignment.area.id)) {
      assignedAreaById.set(assignment.area.id, assignment.area.name);
    }
  });

  const areaById = new Map<number, string>();
  sortedActiveAssignments.forEach((assignment) => {
    if (!areaById.has(assignment.area.id)) {
      areaById.set(assignment.area.id, assignment.area.name);
    }
  });

  return {
    id: employee.id,
    userId: employee.userId,
    name: employee.user.name,
    email: employee.user.email,
    role: normalizeRoleName(employee.user.roleId),
    roleId: employee.user.roleId,
    emailVerified: employee.user.emailVerified,
    isActive: employee.user.isActive,
    phoneNumber: employee.user.phoneNumber ?? null,
    image: employee.user.image ?? null,
    currentAreaId: currentAreaAssignment?.area.id ?? null,
    currentAreaName: currentAreaAssignment?.area.name ?? null,
    areaIds: [...areaById.keys()],
    areaNames: [...areaById.values()],
    assignedAreaIds: [...assignedAreaById.keys()],
    assignedAreaNames: [...assignedAreaById.values()],
    createdAt: employee.createdAt.toISOString(),
    updatedAt: employee.updatedAt.toISOString(),
  };
};

const getRoleIdByName = async (roleName: "employee" | "leader"): Promise<number> => {
  const role = await prisma.role.findFirst({
    where: { name: roleName },
    select: { id: true },
  });

  if (!role) {
    throw new AppError(
      500,
      "ROLE_NOT_FOUND",
      `Role configuration is missing for '${roleName}'`,
    );
  }

  return role.id;
};

const getEmployeeOrThrow = async (employeeId: number): Promise<EmployeeWithRelations> => {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          roleId: true,
          isActive: true,
          emailVerified: true,
          phoneNumber: true,
          image: true,
        },
      },
      areaAssignments: {
        orderBy: { assignedAt: "desc" },
        select: {
          areaId: true,
          assignedAt: true,
          endedAt: true,
          area: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!employee) {
    throw new AppError(404, "EMPLOYEE_NOT_FOUND", "Employee not found");
  }

  return employee as EmployeeWithRelations;
};

const mapAreaAssignment = (assignment: {
  id: number;
  employeeId: number;
  areaId: number;
  assignedByUserId: number;
  endedByUserId: number | null;
  assignedAt: Date;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  area: { id: number; name: string };
}): EmployeeAreaAssignmentDto => ({
  id: assignment.id,
  employeeId: assignment.employeeId,
  areaId: assignment.areaId,
  areaName: assignment.area.name,
  assignedByUserId: assignment.assignedByUserId,
  endedByUserId: assignment.endedByUserId,
  assignedAt: assignment.assignedAt.toISOString(),
  endedAt: assignment.endedAt?.toISOString() ?? null,
  isActive: assignment.endedAt === null,
  createdAt: assignment.createdAt.toISOString(),
  updatedAt: assignment.updatedAt.toISOString(),
});

const mapProjectMembership = (membership: {
  id: number;
  employeeId: number;
  projectId: number;
  assignedByUserId: number;
  endedByUserId: number | null;
  assignedAt: Date;
  unassignedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  project: {
    id: number;
    name: string;
    status: { id: number; name: string };
    area: { id: number; name: string } | null;
  };
}): EmployeeProjectMembershipDto => ({
  id: membership.id,
  employeeId: membership.employeeId,
  projectId: membership.projectId,
  projectName: membership.project.name,
  projectStatus: membership.project.status.name,
  projectAreaId: membership.project.area?.id ?? null,
  projectAreaName: membership.project.area?.name ?? "Sin area",
  assignedByUserId: membership.assignedByUserId,
  endedByUserId: membership.endedByUserId,
  assignedAt: membership.assignedAt.toISOString(),
  unassignedAt: membership.unassignedAt?.toISOString() ?? null,
  isActive: membership.unassignedAt === null,
  createdAt: membership.createdAt.toISOString(),
  updatedAt: membership.updatedAt.toISOString(),
});

export const listEmployees = async (_query: EmployeesListQuery): Promise<EmployeeDto[]> => {
  const employees = await prisma.employee.findMany({
    orderBy: [{ user: { name: "asc" } }],
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          roleId: true,
          isActive: true,
          emailVerified: true,
          phoneNumber: true,
          image: true,
        },
      },
      areaAssignments: {
        orderBy: { assignedAt: "desc" },
        select: {
          areaId: true,
          assignedAt: true,
          endedAt: true,
          area: { select: { id: true, name: true } },
        },
      },
    },
  });

  return employees.map((employee) => mapEmployee(employee as EmployeeWithRelations));
};

export const getEmployeeById = async (employeeId: number): Promise<EmployeeDto> => {
  const employee = await getEmployeeOrThrow(employeeId);
  return mapEmployee(employee);
};

export const createEmployee = async (payload: CreateEmployeeInput): Promise<EmployeeDto> => {
  const employeeRoleId = await getRoleIdByName(payload.role ?? "employee");

  const { employeeId } = await prisma.$transaction(async (tx) => {
    const hashedPassword = await bcrypt.hash(payload.password, 10);

    const createdUser = await tx.user.create({
      data: {
        name: payload.name,
        email: payload.email,
        roleId: employeeRoleId,
        isActive: true,
        emailVerified: payload.emailVerified ?? false,
        phoneNumber: payload.phoneNumber ?? null,
        image: payload.image ?? null,
      },
    }).catch((error) => {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        throw new AppError(409, "EMAIL_ALREADY_EXISTS", "Email is already in use");
      }

      throw error;
    });

    await tx.account.create({
      data: {
        userId: createdUser.id,
        providerId: "credential",
        providerAccountId: String(createdUser.id),
        scope: "app",
        password: hashedPassword,
      },
    });

    const createdEmployee = await tx.employee.create({
      data: {
        userId: createdUser.id,
      },
      select: { id: true },
    });

    return { employeeId: createdEmployee.id };
  });

  const created = await getEmployeeById(employeeId);
  emitRealtimeEvent("employee:created", {
    employee: created,
    issuedAt: new Date().toISOString(),
  }, "admin");
  emitRealtimeEvent("analytics:updated", {
    entity: "employee",
    action: "created",
    employeeId: created.id,
    issuedAt: new Date().toISOString(),
  }, "admin");
  return created;
};

export const updateEmployee = async (
  employeeId: number,
  payload: UpdateEmployeeInput,
  actorUserId?: number,
): Promise<EmployeeDto> => {
  const employee = await getEmployeeOrThrow(employeeId);

  if (payload.isActive === false && actorUserId !== undefined && employee.userId === actorUserId) {
    throw new AppError(
      409,
      "SELF_DEACTIVATION_NOT_ALLOWED",
      "You cannot deactivate your own account",
    );
  }

  const data: {
    name?: string;
    email?: string;
    phoneNumber?: string | null;
    image?: string | null;
    emailVerified?: boolean;
    isActive?: boolean;
  } = {};

  if (payload.name !== undefined) {
    data.name = payload.name;
  }

  if (payload.email !== undefined) {
    data.email = payload.email;
  }

  if (payload.phoneNumber !== undefined) {
    data.phoneNumber = payload.phoneNumber;
  }

  if (payload.image !== undefined) {
    data.image = payload.image;
  }

  if (payload.emailVerified !== undefined) {
    data.emailVerified = payload.emailVerified;
  }

  if (payload.isActive !== undefined) {
    data.isActive = payload.isActive;
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length > 0) {
      await tx.user.update({
        where: { id: employee.userId },
        data,
      }).catch((error) => {
        if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
          throw new AppError(409, "EMAIL_ALREADY_EXISTS", "Email is already in use");
        }

        throw error;
      });
    }
  });

  const updated = await getEmployeeById(employeeId);
  emitRealtimeEvent("employee:updated", {
    employee: updated,
    issuedAt: new Date().toISOString(),
  }, "admin");
  emitRealtimeEvent("analytics:updated", {
    entity: "employee",
    action: "updated",
    employeeId: updated.id,
    issuedAt: new Date().toISOString(),
  }, "admin");
  return updated;
};

export const deleteEmployee = async (
  employeeId: number,
  actorUserId: number,
): Promise<DeleteEmployeeResult> => {
  const employee = await getEmployeeOrThrow(employeeId);

  if (employee.userId === actorUserId) {
    throw new AppError(
      409,
      "SELF_DELETION_NOT_ALLOWED",
      "You cannot delete your own account",
    );
  }

  await prisma.$transaction(async (tx) => {
    const memberships = await tx.projectMembership.findMany({
      where: { employeeId },
      select: { id: true },
    });
    const membershipIds = memberships.map((membership) => membership.id);

    await tx.task.deleteMany({
      where: {
        OR: [
          { createdByUserId: employee.userId },
          { assigneeEmployeeId: employeeId },
          membershipIds.length > 0 ? { assigneeMembershipId: { in: membershipIds } } : undefined,
        ].filter(Boolean) as Array<
          | { createdByUserId: number }
          | { assigneeEmployeeId: number }
          | { assigneeMembershipId: { in: number[] } }
        >,
      },
    });

    await tx.employeeAreaAssignment.deleteMany({
      where: { employeeId },
    });

    await tx.projectMembership.deleteMany({
      where: { employeeId },
    });

    await tx.employee.delete({
      where: { id: employeeId },
    });

    await tx.user.delete({
      where: { id: employee.userId },
    });
  });

  const result = {
    id: employeeId,
    mode: "deleted",
  } as const;
  emitRealtimeEvent("employee:deleted", {
    employeeId,
    mode: result.mode,
    issuedAt: new Date().toISOString(),
  }, "admin");
  emitRealtimeEvent("analytics:updated", {
    entity: "employee",
    action: "deleted",
    employeeId,
    issuedAt: new Date().toISOString(),
  }, "admin");
  return result;
};

export const listEmployeeAreaAssignments = async (
  employeeId: number,
  query: EmployeeAssignmentsListQuery,
): Promise<EmployeeAreaAssignmentDto[]> => {
  await getEmployeeOrThrow(employeeId);

  const where: {
    employeeId: number;
    endedAt?: Date | null | { not: null };
  } = { employeeId };

  if (query.status === "active") {
    where.endedAt = null;
  }

  if (query.status === "inactive") {
    where.endedAt = { not: null };
  }

  const assignments = await prisma.employeeAreaAssignment.findMany({
    where,
    orderBy: [{ endedAt: "asc" }, { assignedAt: "desc" }],
    include: {
      area: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return assignments.map((assignment) => mapAreaAssignment(assignment));
};

export const assignEmployeeToArea = async (
  employeeId: number,
  areaId: number,
  actorUserId: number,
): Promise<EmployeeAreaAssignmentDto> => {
  const employee = await getEmployeeOrThrow(employeeId);

  const area = await prisma.area.findUnique({
    where: { id: areaId },
    select: { id: true, name: true, isActive: true },
  });

  if (!area) {
    throw new AppError(404, "AREA_NOT_FOUND", "Area not found");
  }

  if (!area.isActive) {
    throw new AppError(409, "AREA_INACTIVE", "Area is inactive");
  }

  const currentAssignment = await prisma.employeeAreaAssignment.findFirst({
    where: {
      employeeId,
      endedAt: null,
    },
    orderBy: { assignedAt: "desc" },
    select: {
      id: true,
      areaId: true,
    },
  });

  if (currentAssignment?.areaId === areaId) {
    throw new AppError(
      409,
      "EMPLOYEE_ALREADY_IN_AREA",
      "Employee already has this area as active assignment",
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    if (currentAssignment) {
      await tx.employeeAreaAssignment.update({
        where: { id: currentAssignment.id },
        data: {
          endedAt: new Date(),
          endedByUserId: actorUserId,
        },
      });
    }

    const createdAssignment = await tx.employeeAreaAssignment.create({
      data: {
        employeeId,
        areaId,
        assignedByUserId: actorUserId,
      },
      include: {
        area: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    await createNotificationRecord({
      userId: employee.user.id,
      typeCode: "area_assignment",
      title: "Nueva asignacion de area",
      message: `Te asignaron al area ${createdAssignment.area.name}.`,
      resourceType: "area",
      resourceId: createdAssignment.area.id,
      metadata: {
        areaId: createdAssignment.area.id,
        areaName: createdAssignment.area.name,
        employeeId,
        assignedByUserId: actorUserId,
      },
    }, tx);

    return createdAssignment;
  });

  return mapAreaAssignment(result);
};

export const unassignEmployeeFromArea = async (
  employeeId: number,
  actorUserId: number,
  expectedAreaId?: number,
): Promise<EmployeeAreaAssignmentDto> => {
  await getEmployeeOrThrow(employeeId);

  const currentAssignment = await prisma.employeeAreaAssignment.findFirst({
    where: {
      employeeId,
      endedAt: null,
    },
    orderBy: { assignedAt: "desc" },
    include: {
      area: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!currentAssignment) {
    throw new AppError(409, "EMPLOYEE_HAS_NO_ACTIVE_AREA", "Employee has no active area assignment");
  }

  if (expectedAreaId !== undefined && currentAssignment.areaId !== expectedAreaId) {
    throw new AppError(
      409,
      "EMPLOYEE_ACTIVE_AREA_MISMATCH",
      "Employee active area does not match expected area",
    );
  }

  const endedAssignment = await prisma.employeeAreaAssignment.update({
    where: { id: currentAssignment.id },
    data: {
      endedAt: new Date(),
      endedByUserId: actorUserId,
    },
    include: {
      area: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return mapAreaAssignment(endedAssignment);
};

export const listEmployeeProjectMemberships = async (
  employeeId: number,
  query: EmployeeAssignmentsListQuery,
): Promise<EmployeeProjectMembershipDto[]> => {
  await getEmployeeOrThrow(employeeId);

  const where: {
    employeeId: number;
    unassignedAt?: Date | null | { not: null };
  } = { employeeId };

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
      project: {
        select: {
          id: true,
          name: true,
          status: {
            select: {
              id: true,
              name: true,
            },
          },
          area: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  return memberships.map((membership) => mapProjectMembership(membership));
};
