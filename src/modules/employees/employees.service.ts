import bcrypt from "bcrypt";
import prisma from "../../../prisma/prisma.client.js";
import { NODE_ENV } from "../../shared/config/env.config.js";
import { AppError } from "../../shared/http/app-error.js";
import type { AuthRole } from "../auth/auth.policies.js";
import type {
  EmployeeAssignmentsListQuery,
  CreateEmployeeInput,
  EmployeesListQuery,
  UpdateEmployeeInput,
} from "./employees.schemas.js";

const ALLOWED_EMAIL_DOMAINS = new Set([
  "campuslands.com",
  "fundacioncampuslands.com",
  ...(NODE_ENV === "production" ? [] : ["taskapp.local"]),
]);

const isAllowedEmail = (email: string): boolean => {
  const domain = email.split("@").pop()?.toLowerCase();
  return Boolean(domain && ALLOWED_EMAIL_DOMAINS.has(domain));
};

interface EmployeeWithRelations {
  id: number;
  userId: number;
  employeeStatusId: number;
  deactivatedAt: Date | null;
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
  status: { id: number; name: string };
  areaAssignments: Array<{
    areaId: number;
    assignedAt: Date;
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
  isActive: boolean;
  emailVerified: boolean;
  phoneNumber: string | null;
  image: string | null;
  employeeStatusId: number;
  employeeStatus: string;
  deactivatedAt: string | null;
  currentAreaId: number | null;
  currentAreaName: string | null;
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
  projectAreaId: number;
  projectAreaName: string;
  assignedByUserId: number;
  endedByUserId: number | null;
  assignedAt: string;
  unassignedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const normalizeRoleName = (roleId: number): AuthRole =>
  roleId === 1 ? "admin" : "employee";

const mapEmployee = (employee: EmployeeWithRelations): EmployeeDto => {
  const currentAreaAssignment = employee.areaAssignments[0];

  return {
    id: employee.id,
    userId: employee.userId,
    name: employee.user.name,
    email: employee.user.email,
    role: normalizeRoleName(employee.user.roleId),
    roleId: employee.user.roleId,
    isActive: employee.user.isActive,
    emailVerified: employee.user.emailVerified,
    phoneNumber: employee.user.phoneNumber ?? null,
    image: employee.user.image ?? null,
    employeeStatusId: employee.employeeStatusId,
    employeeStatus: employee.status.name,
    deactivatedAt: employee.deactivatedAt?.toISOString() ?? null,
    currentAreaId: currentAreaAssignment?.area.id ?? null,
    currentAreaName: currentAreaAssignment?.area.name ?? null,
    createdAt: employee.createdAt.toISOString(),
    updatedAt: employee.updatedAt.toISOString(),
  };
};

const getEmployeeRoleId = async (): Promise<number> => {
  const role = await prisma.role.findFirst({
    where: { name: "employee" },
    select: { id: true },
  });

  if (!role) {
    throw new AppError(500, "ROLE_EMPLOYEE_NOT_FOUND", "Employee role configuration is missing");
  }

  return role.id;
};

const getEmployeeStatusIds = async (): Promise<{ active: number; inactive: number }> => {
  const statuses = await prisma.employeeStatus.findMany({
    where: {
      name: { in: ["Activo", "Inactivo"] },
    },
    select: { id: true, name: true },
  });

  const active = statuses.find((status) => status.name === "Activo")?.id;
  const inactive = statuses.find((status) => status.name === "Inactivo")?.id;

  if (!active || !inactive) {
    throw new AppError(
      500,
      "EMPLOYEE_STATUSES_NOT_CONFIGURED",
      "Employee status catalog is missing required values",
    );
  }

  return { active, inactive };
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
      status: { select: { id: true, name: true } },
      areaAssignments: {
        where: { endedAt: null },
        orderBy: { assignedAt: "desc" },
        take: 1,
        select: {
          areaId: true,
          assignedAt: true,
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
    area: { id: number; name: string };
  };
}): EmployeeProjectMembershipDto => ({
  id: membership.id,
  employeeId: membership.employeeId,
  projectId: membership.projectId,
  projectName: membership.project.name,
  projectStatus: membership.project.status.name,
  projectAreaId: membership.project.area.id,
  projectAreaName: membership.project.area.name,
  assignedByUserId: membership.assignedByUserId,
  endedByUserId: membership.endedByUserId,
  assignedAt: membership.assignedAt.toISOString(),
  unassignedAt: membership.unassignedAt?.toISOString() ?? null,
  isActive: membership.unassignedAt === null,
  createdAt: membership.createdAt.toISOString(),
  updatedAt: membership.updatedAt.toISOString(),
});

export const listEmployees = async (query: EmployeesListQuery): Promise<EmployeeDto[]> => {
  const where = query.status === "all"
    ? {}
    : {
        user: {
          isActive: query.status === "active",
        },
      };

  const employees = await prisma.employee.findMany({
    where,
    orderBy: [{ user: { isActive: "desc" } }, { user: { name: "asc" } }],
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
      status: { select: { id: true, name: true } },
      areaAssignments: {
        where: { endedAt: null },
        orderBy: { assignedAt: "desc" },
        take: 1,
        select: {
          areaId: true,
          assignedAt: true,
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
  if (!isAllowedEmail(payload.email)) {
    throw new AppError(
      400,
      "EMAIL_DOMAIN_NOT_ALLOWED",
      "Email domain is not allowed for this environment",
    );
  }

  const [employeeRoleId, statusIds] = await Promise.all([
    getEmployeeRoleId(),
    getEmployeeStatusIds(),
  ]);

  const { employeeId } = await prisma.$transaction(async (tx) => {
    const hashedPassword = await bcrypt.hash(payload.password, 10);

    const createdUser = await tx.user.create({
      data: {
        name: payload.name,
        email: payload.email,
        roleId: employeeRoleId,
        isActive: payload.isActive ?? true,
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
        employeeStatusId: (payload.isActive ?? true) ? statusIds.active : statusIds.inactive,
        deactivatedAt: (payload.isActive ?? true) ? null : new Date(),
      },
      select: { id: true },
    });

    return { employeeId: createdEmployee.id };
  });

  return getEmployeeById(employeeId);
};

export const updateEmployee = async (
  employeeId: number,
  payload: UpdateEmployeeInput,
): Promise<EmployeeDto> => {
  const employee = await getEmployeeOrThrow(employeeId);

  const data: {
    name?: string;
    phoneNumber?: string | null;
    image?: string | null;
    emailVerified?: boolean;
  } = {};

  if (payload.name !== undefined) {
    data.name = payload.name;
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

  await prisma.user.update({
    where: { id: employee.userId },
    data,
  });

  return getEmployeeById(employeeId);
};

export const updateEmployeeStatus = async (
  employeeId: number,
  isActive: boolean,
  actorUserId: number,
): Promise<EmployeeDto> => {
  const employee = await getEmployeeOrThrow(employeeId);

  if (!isActive && employee.userId === actorUserId) {
    throw new AppError(
      409,
      "SELF_DEACTIVATION_NOT_ALLOWED",
      "You cannot deactivate your own account",
    );
  }

  const statusIds = await getEmployeeStatusIds();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: employee.userId },
      data: { isActive },
    }),
    prisma.employee.update({
      where: { id: employeeId },
      data: {
        employeeStatusId: isActive ? statusIds.active : statusIds.inactive,
        deactivatedAt: isActive ? null : new Date(),
      },
    }),
  ]);

  return getEmployeeById(employeeId);
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

  if (!employee.user.isActive) {
    throw new AppError(409, "EMPLOYEE_INACTIVE", "Employee is inactive");
  }

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

    return tx.employeeAreaAssignment.create({
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
  });

  return mapAreaAssignment(result);
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
