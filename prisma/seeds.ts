import bcrypt from "bcrypt";
import { Prisma } from "../generated/prisma/client.js";
import prisma from "./prisma.client.js";

const roles = [
  { id: 1, name: "admin" },
  { id: 2, name: "employee" },
];

const employeeStatuses = [
  { id: 1, name: "Activo" },
  { id: 2, name: "Inactivo" },
];

const projectStatuses = [
  { id: 1, name: "Activo" },
  { id: 2, name: "Cerrado" },
];

const taskStatuses = [
  { id: 1, name: "Asignada" },
  { id: 2, name: "En proceso" },
  { id: 3, name: "Terminada" },
];

const taskPriorities = [
  { id: 1, name: "Baja" },
  { id: 2, name: "Media" },
  { id: 3, name: "Alta" },
];

const notificationTypes = [
  { id: 1, code: "area_assignment", name: "Asignacion de area" },
  { id: 2, code: "project_assignment", name: "Asignacion de proyecto" },
  { id: 3, code: "task_assignment", name: "Asignacion de tarea" },
];

const usersSeed = [
  {
    name: "Admin Principal",
    email: "admin@taskapp.local",
    role: "admin",
    emailVerified: true,
    phoneNumber: "+573001000001",
    image: "https://example.com/avatar/admin-principal.png",
    isActive: true,
  },
  {
    name: "Laura Operaciones",
    email: "laura.operaciones@taskapp.local",
    role: "employee",
    emailVerified: true,
    phoneNumber: "+573001000002",
    image: "https://example.com/avatar/laura.png",
    isActive: true,
  },
  {
    name: "Sofia QA",
    email: "sofia.qa@taskapp.local",
    role: "employee",
    emailVerified: true,
    phoneNumber: "+573001000004",
    image: "https://example.com/avatar/sofia.png",
    isActive: true,
  },
];

const areasSeed = [
  {
    name: "Operaciones",
    description: "Gestion operativa de tareas y seguimiento del trabajo diario.",
    isActive: true,
  },
  {
    name: "Desarrollo",
    description: "Ejecucion tecnica de iniciativas de producto y plataforma.",
    isActive: true,
  },
  {
    name: "Calidad",
    description: "Validacion funcional y tecnica antes de liberar entregas.",
    isActive: true,
  },
  {
    name: "Archivo",
    description: "Area historica para reasignaciones y cierres administrativos.",
    isActive: false,
  },
  {
    name: "Producto",
    description: "Definicion y priorizacion de roadmap funcional.",
    isActive: true,
  },
  {
    name: "Infraestructura",
    description: "Operacion de entornos, despliegues y observabilidad.",
    isActive: true,
  },
  {
    name: "Datos",
    description: "Modelado analitico y reporteria operativa.",
    isActive: true,
  },
  {
    name: "Atencion Cliente",
    description: "Seguimiento de casos criticos y comunicacion externa.",
    isActive: true,
  },
];

const extraEmployeeFirstNames = [
  "Carlos", "Mariana", "Andres", "Valentina", "Diego", "Camila", "Jorge", "Natalia", "Felipe", "Paula",
  "Ricardo", "Daniela", "Mateo", "Gabriela", "Nicolas", "Alejandra", "Santiago", "Lucia", "Sebastian", "Manuela",
  "Juan", "Carolina", "David", "Laura", "Miguel", "Tatiana", "Oscar", "Angela", "Ivan", "Juliana",
];

const extraEmployeeLastNames = [
  "Gomez", "Rodriguez", "Hernandez", "Lopez", "Martinez", "Garcia", "Ramirez", "Castro", "Torres", "Ruiz",
  "Morales", "Vargas", "Suarez", "Silva", "Ortega", "Rojas", "Mendoza", "Acosta", "Jimenez", "Pineda",
];

type CatalogItem = { id: number; name: string };

type UserSeed = {
  name: string;
  email: string;
  role: string;
  emailVerified: boolean;
  phoneNumber: string;
  image: string;
  isActive: boolean;
};
type AreaSeed = (typeof areasSeed)[number];

async function upsertCatalog<T extends CatalogItem>(
  items: T[],
  upsert: (item: T) => Promise<unknown>,
) {
  for (const item of items) {
    await upsert(item);
  }
}

function daysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function utcDateAtNoon(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));
}

function getDaysInUtcMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function clampDay(day: number, maxDay: number) {
  return Math.min(Math.max(day, 1), maxDay);
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function buildExtraEmployeeSeeds(total: number): UserSeed[] {
  const records: UserSeed[] = [];

  for (let index = 0; index < total; index += 1) {
    const firstName = extraEmployeeFirstNames[index % extraEmployeeFirstNames.length]!;
    const lastName = extraEmployeeLastNames[(index * 3) % extraEmployeeLastNames.length]!;
    const sequence = String(index + 1).padStart(2, "0");
    const slugBase = `${slugify(firstName)}.${slugify(lastName)}.${sequence}`;

    records.push({
      name: `${firstName} ${lastName}`,
      email: `${slugBase}@taskapp.local`,
      role: "employee",
      emailVerified: true,
      phoneNumber: `+57312${String(1000000 + index)}`,
      image: `https://example.com/avatar/${slugBase}.png`,
      isActive: index % 9 !== 0,
    });
  }

  return records;
}

async function getRoleIdByName(name: string) {
  const role = await prisma.role.findFirstOrThrow({ where: { name } });
  return role.id;
}

async function getEmployeeStatusIdByName(name: string) {
  const status = await prisma.employeeStatus.findFirstOrThrow({ where: { name } });
  return status.id;
}

async function getProjectStatusIdByName(name: string) {
  const status = await prisma.projectStatus.findFirstOrThrow({ where: { name } });
  return status.id;
}

async function getTaskStatusIdByName(name: string) {
  const status = await prisma.taskStatus.findFirstOrThrow({ where: { name } });
  return status.id;
}

async function getTaskPriorityIdByName(name: string) {
  const priority = await prisma.taskPriority.findFirstOrThrow({ where: { name } });
  return priority.id;
}

async function getNotificationTypeIdByCode(code: string) {
  const type = await prisma.notificationType.findFirstOrThrow({ where: { code } });
  return type.id;
}

async function ensureUser(user: UserSeed) {
  const roleId = await getRoleIdByName(user.role);

  return prisma.user.upsert({
    where: { email: user.email },
    update: {
      name: user.name,
      roleId,
      emailVerified: user.emailVerified,
      phoneNumber: user.phoneNumber,
      image: user.image,
      isActive: user.isActive,
    },
    create: {
      name: user.name,
      email: user.email,
      roleId,
      emailVerified: user.emailVerified,
      phoneNumber: user.phoneNumber,
      image: user.image,
      isActive: user.isActive,
    },
  });
}

async function ensureAccount(userId: number, providerId: string, providerAccountId: string, password?: string) {
  const passwordValue = providerId === "credential" && password
    ? await bcrypt.hash(password, 10)
    : password ?? null;

  return prisma.account.upsert({
    where: {
      providerId_providerAccountId: {
        providerId,
        providerAccountId,
      },
    },
    update: {
      userId,
      scope: providerId === "credential" ? "app" : "openid profile email",
      password: passwordValue,
    },
    create: {
      userId,
      providerId,
      providerAccountId,
      scope: providerId === "credential" ? "app" : "openid profile email",
      password: passwordValue,
    },
  });
}

async function ensureSession(userId: number, token: string, expiresInDays: number, userAgent: string) {
  return prisma.session.upsert({
    where: { token },
    update: {
      userId,
      expiresAt: daysAgo(-expiresInDays),
      ipAddress: "127.0.0.1",
      userAgent,
    },
    create: {
      userId,
      token,
      expiresAt: daysAgo(-expiresInDays),
      ipAddress: "127.0.0.1",
      userAgent,
    },
  });
}

async function ensureVerification(identifier: string, value: string, expiresInDays: number) {
  return prisma.verification.upsert({
    where: {
      identifier_value: {
        identifier,
        value,
      },
    },
    update: {
      expiresAt: daysAgo(-expiresInDays),
    },
    create: {
      identifier,
      value,
      expiresAt: daysAgo(-expiresInDays),
    },
  });
}

async function ensureEmployee(userId: number, statusName: string, deactivatedAt?: Date | null) {
  const employeeStatusId = await getEmployeeStatusIdByName(statusName);

  return prisma.employee.upsert({
    where: { userId },
    update: {
      employeeStatusId,
      deactivatedAt: deactivatedAt ?? null,
    },
    create: {
      userId,
      employeeStatusId,
      deactivatedAt: deactivatedAt ?? null,
    },
  });
}

async function ensureArea(area: AreaSeed) {
  return prisma.area.upsert({
    where: { name: area.name },
    update: {
      description: area.description,
      isActive: area.isActive,
    },
    create: area,
  });
}

async function ensureAreaAssignment(params: {
  employeeId: number;
  areaId: number;
  assignedByUserId: number;
  assignedAt: Date;
  endedAt?: Date | null;
  endedByUserId?: number | null;
}) {
  const normalizeEndedAt = (
    assignedAt: Date,
    candidateEndedAt: Date,
  ) => candidateEndedAt > assignedAt
    ? candidateEndedAt
    : new Date(assignedAt.getTime() + 1000);

  const existing = await prisma.employeeAreaAssignment.findFirst({
    where: {
      employeeId: params.employeeId,
      areaId: params.areaId,
      assignedAt: params.assignedAt,
    },
  });

  if (existing) {
    return prisma.employeeAreaAssignment.update({
      where: { id: existing.id },
      data: {
        endedAt: params.endedAt ?? null,
        endedByUserId: params.endedByUserId ?? null,
        assignedByUserId: params.assignedByUserId,
      },
    });
  }

  if ((params.endedAt ?? null) === null) {
    const currentActiveAssignment = await prisma.employeeAreaAssignment.findFirst({
      where: {
        employeeId: params.employeeId,
        endedAt: null,
      },
      orderBy: { assignedAt: "desc" },
    });

    if (currentActiveAssignment && currentActiveAssignment.areaId === params.areaId) {
      return prisma.employeeAreaAssignment.update({
        where: { id: currentActiveAssignment.id },
        data: {
          assignedAt: params.assignedAt,
          assignedByUserId: params.assignedByUserId,
          endedAt: null,
          endedByUserId: null,
        },
      });
    }

    if (currentActiveAssignment && currentActiveAssignment.areaId !== params.areaId) {
      await prisma.employeeAreaAssignment.update({
        where: { id: currentActiveAssignment.id },
        data: {
          endedAt: normalizeEndedAt(currentActiveAssignment.assignedAt, params.assignedAt),
          endedByUserId: params.assignedByUserId,
        },
      });
    }
  }

  return prisma.employeeAreaAssignment.create({
    data: params,
  });
}

async function ensureProject(params: {
  areaId: number;
  projectStatusId: number;
  name: string;
  description: string;
  startDate?: Date | null;
  endDate?: Date | null;
  closedAt?: Date | null;
}) {
  const existing = await prisma.project.findFirst({
    where: {
      areaId: params.areaId,
      name: params.name,
    },
  });

  if (existing) {
    return prisma.project.update({
      where: { id: existing.id },
      data: params,
    });
  }

  return prisma.project.create({ data: params });
}

async function ensureProjectMembership(params: {
  projectId: number;
  employeeId: number;
  assignedByUserId: number;
  assignedAt: Date;
  unassignedAt?: Date | null;
  endedByUserId?: number | null;
}) {
  const existing = await prisma.projectMembership.findFirst({
    where: {
      projectId: params.projectId,
      employeeId: params.employeeId,
    },
  });

  if (existing) {
    return prisma.projectMembership.update({
      where: { id: existing.id },
      data: {
        assignedAt: params.assignedAt,
        assignedByUserId: params.assignedByUserId,
        unassignedAt: params.unassignedAt ?? null,
        endedByUserId: params.endedByUserId ?? null,
      },
    });
  }

  return prisma.projectMembership.create({ data: params });
}

async function ensureTask(params: {
  projectId: number;
  assigneeMembershipId?: number | null;
  taskStatusId: number;
  taskPriorityId: number;
  title: string;
  description?: string | null;
  plannedStartDate: Date;
  dueDate: Date;
  estimatedMinutes?: number | null;
  deletedAt?: Date | null;
  createdByUserId: number;
}) {
  const existing = await prisma.task.findFirst({
    where: {
      projectId: params.projectId,
      title: params.title,
    },
  });

  if (existing) {
    return prisma.task.update({
      where: { id: existing.id },
      data: params,
    });
  }

  return prisma.task.create({ data: params });
}

async function ensureTaskTransition(params: {
  taskId: number;
  fromStatusId?: number | null;
  toStatusId: number;
  changedByUserId: number;
  changedAt: Date;
  notes?: string | null;
}) {
  const existing = await prisma.taskStatusTransition.findFirst({
    where: {
      taskId: params.taskId,
      changedAt: params.changedAt,
      toStatusId: params.toStatusId,
    },
  });

  if (existing) {
    return prisma.taskStatusTransition.update({
      where: { id: existing.id },
      data: {
        fromStatusId: params.fromStatusId ?? null,
        changedByUserId: params.changedByUserId,
        notes: params.notes ?? null,
      },
    });
  }

  return prisma.taskStatusTransition.create({ data: params });
}

async function ensureTaskWorkSession(params: {
  taskId: number;
  projectMembershipId: number;
  startedByUserId: number;
  endedByUserId?: number | null;
  startedAt: Date;
  endedAt?: Date | null;
}) {
  const existing = await prisma.taskWorkSession.findFirst({
    where: {
      taskId: params.taskId,
    },
  });

  if (existing) {
    return prisma.taskWorkSession.update({
      where: { id: existing.id },
      data: {
        projectMembershipId: params.projectMembershipId,
        startedByUserId: params.startedByUserId,
        endedByUserId: params.endedByUserId ?? null,
        startedAt: params.startedAt,
        endedAt: params.endedAt ?? null,
      },
    });
  }

  return prisma.taskWorkSession.create({ data: params });
}

async function ensureNotification(params: {
  userId: number;
  notificationTypeId: number;
  title: string;
  message: string;
  resourceType?: string | null;
  resourceId?: number | null;
  isRead?: boolean;
  readAt?: Date | null;
  metadata?: Prisma.InputJsonValue | null;
  createdAt?: Date;
}) {
  const existing = await prisma.notification.findFirst({
    where: {
      userId: params.userId,
      notificationTypeId: params.notificationTypeId,
      title: params.title,
      resourceType: params.resourceType ?? null,
      resourceId: params.resourceId ?? null,
    },
  });

  const isRead = params.isRead ?? false;
  const readAt = isRead
    ? (params.readAt ?? params.createdAt ?? new Date())
    : null;

  if (existing) {
    return prisma.notification.update({
      where: { id: existing.id },
      data: {
        message: params.message,
        ...(params.metadata !== undefined
          ? { metadata: params.metadata === null ? Prisma.JsonNull : params.metadata }
          : {}),
        isRead,
        readAt,
      },
    });
  }

  return prisma.notification.create({
    data: {
      userId: params.userId,
      notificationTypeId: params.notificationTypeId,
      title: params.title,
      message: params.message,
      resourceType: params.resourceType ?? null,
      resourceId: params.resourceId ?? null,
      ...(params.metadata !== undefined
        ? { metadata: params.metadata === null ? Prisma.JsonNull : params.metadata }
        : {}),
      isRead,
      readAt,
      ...(params.createdAt ? { createdAt: params.createdAt } : {}),
    },
  });
}

async function main() {
  await upsertCatalog(roles, (role) =>
    prisma.role.upsert({
      where: { id: role.id },
      update: { name: role.name },
      create: role,
    }),
  );

  await upsertCatalog(employeeStatuses, (status) =>
    prisma.employeeStatus.upsert({
      where: { id: status.id },
      update: { name: status.name },
      create: status,
    }),
  );

  await upsertCatalog(projectStatuses, (status) =>
    prisma.projectStatus.upsert({
      where: { id: status.id },
      update: { name: status.name },
      create: status,
    }),
  );

  await upsertCatalog(taskStatuses, (status) =>
    prisma.taskStatus.upsert({
      where: { id: status.id },
      update: { name: status.name },
      create: status,
    }),
  );

  await upsertCatalog(taskPriorities, (priority) =>
    prisma.taskPriority.upsert({
      where: { id: priority.id },
      update: { name: priority.name },
      create: priority,
    }),
  );

  await upsertCatalog(notificationTypes, (type) =>
    prisma.notificationType.upsert({
      where: { id: type.id },
      update: {
        code: type.code,
        name: type.name,
      },
      create: type,
    }),
  );

  const expandedUsersSeed = [
    ...usersSeed,
    ...buildExtraEmployeeSeeds(42),
  ];

  const users = new Map<string, Awaited<ReturnType<typeof ensureUser>>>();
  for (const seed of expandedUsersSeed) {
    users.set(seed.email, await ensureUser(seed));
  }

  const adminUser = users.get("admin@taskapp.local")!;
  const lauraUser = users.get("laura.operaciones@taskapp.local")!;
  const sofiaUser = users.get("sofia.qa@taskapp.local")!;

  await ensureAccount(adminUser.id, "credential", String(adminUser.id), "admin123");
  await ensureAccount(lauraUser.id, "credential", String(lauraUser.id), "laura123");
  await ensureAccount(sofiaUser.id, "credential", String(sofiaUser.id), "sofia123");

  for (const seed of expandedUsersSeed) {
    if (seed.role !== "employee") continue;
    if (seed.email === lauraUser.email || seed.email === sofiaUser.email) continue;
    const user = users.get(seed.email);
    if (!user) continue;
    await ensureAccount(user.id, "credential", String(user.id), "employee123");
  }

  await ensureSession(adminUser.id, "sess-admin-principal", 30, "Seeder Admin Agent");
  await ensureSession(lauraUser.id, "sess-laura-operaciones", 15, "Seeder Operations Client");
  await ensureSession(sofiaUser.id, "sess-sofia-qa", 7, "Seeder QA Client");

  const employeeSessionUsers = expandedUsersSeed
    .filter((seed) => seed.role === "employee")
    .slice(0, 16);

  for (const [index, seed] of employeeSessionUsers.entries()) {
    const user = users.get(seed.email);
    if (!user) continue;
    await ensureSession(
      user.id,
      `sess-${slugify(seed.name)}-${index + 1}`,
      5 + (index % 20),
      "Seeder Employee Client",
    );
  }

  await ensureVerification(adminUser.email, "verify-admin-email", 2);
  await ensureVerification("reset:laura.operaciones@taskapp.local", "reset-laura-password", 1);

  const employees = new Map<string, Awaited<ReturnType<typeof ensureEmployee>>>();
  for (const seed of expandedUsersSeed) {
    if (seed.role !== "employee") continue;
    const user = users.get(seed.email);
    if (!user) continue;

    const statusName = seed.isActive ? "Activo" : "Inactivo";
    const deactivatedAt = seed.isActive ? null : daysAgo(15 + (seed.email.length % 45));
    employees.set(seed.email, await ensureEmployee(user.id, statusName, deactivatedAt));
  }

  const areas = new Map<string, Awaited<ReturnType<typeof ensureArea>>>();
  for (const area of areasSeed) {
    areas.set(area.name, await ensureArea(area));
  }

  const lauraEmployee = employees.get(lauraUser.email)!;
  const sofiaEmployee = employees.get(sofiaUser.email)!;

  const operacionesArea = areas.get("Operaciones")!;
  const desarrolloArea = areas.get("Desarrollo")!;
  const calidadArea = areas.get("Calidad")!;
  const productoArea = areas.get("Producto")!;
  const infraestructuraArea = areas.get("Infraestructura")!;
  const datosArea = areas.get("Datos")!;
  const atencionClienteArea = areas.get("Atencion Cliente")!;

  await ensureAreaAssignment({
    employeeId: lauraEmployee.id,
    areaId: operacionesArea.id,
    assignedByUserId: adminUser.id,
    assignedAt: daysAgo(120),
  });

  await ensureAreaAssignment({
    employeeId: sofiaEmployee.id,
    areaId: operacionesArea.id,
    assignedByUserId: adminUser.id,
    assignedAt: daysAgo(150),
    endedAt: daysAgo(90),
    endedByUserId: adminUser.id,
  });

  await ensureAreaAssignment({
    employeeId: sofiaEmployee.id,
    areaId: calidadArea.id,
    assignedByUserId: adminUser.id,
    assignedAt: daysAgo(90),
  });

  await ensureAreaAssignment({
    employeeId: lauraEmployee.id,
    areaId: desarrolloArea.id,
    assignedByUserId: adminUser.id,
    assignedAt: daysAgo(60),
  });

  const activeAreasForDistribution = [
    operacionesArea,
    desarrolloArea,
    calidadArea,
    productoArea,
    infraestructuraArea,
    datosArea,
    atencionClienteArea,
  ];

  const extraEmployeeSeeds = expandedUsersSeed.filter((seed) =>
    seed.role === "employee"
    && seed.email !== lauraUser.email
    && seed.email !== sofiaUser.email);

  for (const [index, seed] of extraEmployeeSeeds.entries()) {
    const employee = employees.get(seed.email);
    const user = users.get(seed.email);
    if (!employee || !user) continue;

    const targetArea = activeAreasForDistribution[index % activeAreasForDistribution.length]!;
    const assignedAt = daysAgo(190 - index * 2);

    if (index % 5 === 0) {
      const previousArea = activeAreasForDistribution[(index + 2) % activeAreasForDistribution.length]!;
      await ensureAreaAssignment({
        employeeId: employee.id,
        areaId: previousArea.id,
        assignedByUserId: adminUser.id,
        assignedAt: daysAgo(260 - index * 2),
        endedAt: daysAgo(200 - index * 2),
        endedByUserId: adminUser.id,
      });
    }

    await ensureAreaAssignment({
      employeeId: employee.id,
      areaId: targetArea.id,
      assignedByUserId: adminUser.id,
      assignedAt,
      ...(seed.isActive
        ? {}
        : {
          endedAt: daysAgo(10 + (index % 25)),
          endedByUserId: adminUser.id,
        }),
    });
  }

  const activeProjectStatusId = await getProjectStatusIdByName("Activo");
  const closedProjectStatusId = await getProjectStatusIdByName("Cerrado");

  const taskAssignedStatusId = await getTaskStatusIdByName("Asignada");
  const taskInProgressStatusId = await getTaskStatusIdByName("En proceso");
  const taskDoneStatusId = await getTaskStatusIdByName("Terminada");

  const lowPriorityId = await getTaskPriorityIdByName("Baja");
  const mediumPriorityId = await getTaskPriorityIdByName("Media");
  const highPriorityId = await getTaskPriorityIdByName("Alta");
  const areaAssignmentTypeId = await getNotificationTypeIdByCode("area_assignment");
  const projectAssignmentTypeId = await getNotificationTypeIdByCode("project_assignment");
  const taskAssignmentTypeId = await getNotificationTypeIdByCode("task_assignment");

  const ensureCompletedComplianceTask = async (params: {
    projectId: number;
    membershipId: number;
    changedByUserId: number;
    title: string;
    description: string;
    plannedStartDate: Date;
    dueDate: Date;
    doneAt: Date;
    estimatedMinutes: number;
    actualMinutes: number;
    taskPriorityId: number;
  }) => {
    const task = await ensureTask({
      projectId: params.projectId,
      assigneeMembershipId: params.membershipId,
      taskStatusId: taskDoneStatusId,
      taskPriorityId: params.taskPriorityId,
      title: params.title,
      description: params.description,
      plannedStartDate: params.plannedStartDate,
      dueDate: params.dueDate,
      estimatedMinutes: params.estimatedMinutes,
      createdByUserId: adminUser.id,
    });

    await ensureTaskTransition({
      taskId: task.id,
      toStatusId: taskAssignedStatusId,
      changedByUserId: adminUser.id,
      changedAt: params.plannedStartDate,
      notes: "Tarea creada para muestra del trend de cumplimiento.",
    });

    await ensureTaskTransition({
      taskId: task.id,
      fromStatusId: taskAssignedStatusId,
      toStatusId: taskInProgressStatusId,
      changedByUserId: params.changedByUserId,
      changedAt: addHours(params.plannedStartDate, 6),
      notes: "Inicio operativo de tarea para trazabilidad semanal.",
    });

    await ensureTaskTransition({
      taskId: task.id,
      fromStatusId: taskInProgressStatusId,
      toStatusId: taskDoneStatusId,
      changedByUserId: params.changedByUserId,
      changedAt: params.doneAt,
      notes: "Cierre para consolidar metrica del compliance trend.",
    });

    const sessionStart = addHours(params.plannedStartDate, 8);
    await ensureTaskWorkSession({
      taskId: task.id,
      projectMembershipId: params.membershipId,
      startedByUserId: params.changedByUserId,
      endedByUserId: params.changedByUserId,
      startedAt: sessionStart,
      endedAt: addHours(sessionStart, params.actualMinutes / 60),
    });

    return task;
  };

  const projectOperaciones = await ensureProject({
    areaId: operacionesArea.id,
    projectStatusId: activeProjectStatusId,
    name: "Mesa de Soporte Interna",
    description: "Proyecto para centralizar tickets y seguimiento de atencion interna.",
    startDate: daysAgo(70),
  });

  const projectDesarrollo = await ensureProject({
    areaId: desarrolloArea.id,
    projectStatusId: activeProjectStatusId,
    name: "Backend API v2",
    description: "Refactor del backend para autenticacion, tareas y reporterias.",
    startDate: daysAgo(55),
  });

  const projectCalidad = await ensureProject({
    areaId: calidadArea.id,
    projectStatusId: closedProjectStatusId,
    name: "Regression Sprint Enero",
    description: "Cobertura funcional y tecnica de los cambios previos al lanzamiento.",
    startDate: daysAgo(95),
    endDate: daysAgo(25),
    closedAt: daysAgo(25),
  });

  const projectLegacy = await ensureProject({
    areaId: operacionesArea.id,
    projectStatusId: closedProjectStatusId,
    name: "Migracion Legacy",
    description: "Iniciativa desactivada para migrar operaciones historicas.",
    startDate: daysAgo(130),
    endDate: daysAgo(80),
    closedAt: daysAgo(80),
  });

  const generatedProjects: Awaited<ReturnType<typeof ensureProject>>[] = [];
  const projectAreas = [
    operacionesArea,
    desarrolloArea,
    calidadArea,
    productoArea,
    infraestructuraArea,
    datosArea,
    atencionClienteArea,
  ];

  for (const [areaIndex, area] of projectAreas.entries()) {
    for (let cycle = 1; cycle <= 4; cycle += 1) {
      const projectOrder = areaIndex * 4 + cycle;
      const statusSelector = projectOrder % 9;
      const projectStatusId = statusSelector <= 5
        ? activeProjectStatusId
        : closedProjectStatusId;

      const isClosed = projectStatusId !== activeProjectStatusId;
      const endDate = isClosed ? daysAgo(20 + projectOrder) : null;

      const project = await ensureProject({
        areaId: area.id,
        projectStatusId,
        name: `${area.name} - Operacion ${String(projectOrder).padStart(2, "0")}`,
        description: `Flujo operativo de ${area.name} para ejecucion continua del ciclo ${projectOrder}.`,
        startDate: daysAgo(180 - projectOrder * 3),
        endDate,
        closedAt: isClosed ? endDate : null,
      });

      generatedProjects.push(project);
    }
  }

  const lauraSupportMembership = await ensureProjectMembership({
    projectId: projectOperaciones.id,
    employeeId: lauraEmployee.id,
    assignedByUserId: adminUser.id,
    assignedAt: daysAgo(70),
  });

  await ensureProjectMembership({
    projectId: projectOperaciones.id,
    employeeId: sofiaEmployee.id,
    assignedByUserId: adminUser.id,
    assignedAt: daysAgo(68),
    unassignedAt: daysAgo(58),
    endedByUserId: adminUser.id,
  });

  const lauraDevMembership = await ensureProjectMembership({
    projectId: projectDesarrollo.id,
    employeeId: lauraEmployee.id,
    assignedByUserId: adminUser.id,
    assignedAt: daysAgo(55),
  });

  const sofiaDevMembership = await ensureProjectMembership({
    projectId: projectDesarrollo.id,
    employeeId: sofiaEmployee.id,
    assignedByUserId: adminUser.id,
    assignedAt: daysAgo(52),
  });

  const sofiaQaMembership = await ensureProjectMembership({
    projectId: projectCalidad.id,
    employeeId: sofiaEmployee.id,
    assignedByUserId: adminUser.id,
    assignedAt: daysAgo(95),
    unassignedAt: daysAgo(25),
    endedByUserId: adminUser.id,
  });

  await ensureProjectMembership({
    projectId: projectLegacy.id,
    employeeId: lauraEmployee.id,
    assignedByUserId: adminUser.id,
    assignedAt: daysAgo(125),
    unassignedAt: daysAgo(80),
    endedByUserId: adminUser.id,
  });

  const generatedMembershipsByProject = new Map<number, Awaited<ReturnType<typeof ensureProjectMembership>>[]>();
  const employeeById = new Map<number, Awaited<ReturnType<typeof ensureEmployee>>>();
  for (const employee of employees.values()) {
    employeeById.set(employee.id, employee);
  }

  const activeAreaAssignments = await prisma.employeeAreaAssignment.findMany({
    where: { endedAt: null },
    select: {
      employeeId: true,
      areaId: true,
    },
  });
  const activeAreaByEmployeeId = new Map<number, number>();
  for (const assignment of activeAreaAssignments) {
    activeAreaByEmployeeId.set(assignment.employeeId, assignment.areaId);
  }

  const employeeSeedByEmail = new Map<string, UserSeed>();
  for (const seed of expandedUsersSeed) {
    employeeSeedByEmail.set(seed.email, seed);
  }

  const activeEmployeePool = Array.from(employees.entries())
    .map(([email, employee]) => ({ email, employee, seed: employeeSeedByEmail.get(email) }))
    .filter((entry) => entry.seed?.role === "employee" && entry.seed.isActive);

  for (const [projectIndex, project] of generatedProjects.entries()) {
    const areaEmployees = activeEmployeePool
      .filter((entry) => activeAreaByEmployeeId.get(entry.employee.id) === project.areaId);
    const candidates = areaEmployees.length >= 3 ? areaEmployees : activeEmployeePool;
    const membersToAssign = Math.min(6, Math.max(3, 3 + (projectIndex % 4)));
    const assignedEmployeeIds = new Set<number>();

    const memberships: Awaited<ReturnType<typeof ensureProjectMembership>>[] = [];
    for (let memberIndex = 0; memberIndex < candidates.length && memberships.length < membersToAssign; memberIndex += 1) {
      const candidate = candidates[(projectIndex * 2 + memberIndex) % candidates.length];
      if (!candidate) continue;
      if (assignedEmployeeIds.has(candidate.employee.id)) continue;
      assignedEmployeeIds.add(candidate.employee.id);

      const isClosedProject = project.projectStatusId !== activeProjectStatusId;
      const assignedAt = daysAgo(170 - projectIndex * 3 - memberIndex);
      const unassignedAt = isClosedProject ? daysAgo(15 + projectIndex + memberIndex) : null;

      const membership = await ensureProjectMembership({
        projectId: project.id,
        employeeId: candidate.employee.id,
        assignedByUserId: adminUser.id,
        assignedAt,
        unassignedAt,
        endedByUserId: unassignedAt ? adminUser.id : null,
      });

      memberships.push(membership);
    }

    generatedMembershipsByProject.set(project.id, memberships);
  }

  const taskBacklogCleanup = await ensureTask({
    projectId: projectOperaciones.id,
    assigneeMembershipId: lauraSupportMembership.id,
    taskStatusId: taskAssignedStatusId,
    taskPriorityId: mediumPriorityId,
    title: "Depurar tickets duplicados",
    description: "Limpiar registros repetidos antes del cierre semanal.",
    plannedStartDate: daysAgo(2),
    dueDate: daysAgo(-3),
    estimatedMinutes: 90,
    createdByUserId: adminUser.id,
  });

  const taskApiAuth = await ensureTask({
    projectId: projectDesarrollo.id,
    assigneeMembershipId: lauraDevMembership.id,
    taskStatusId: taskInProgressStatusId,
    taskPriorityId: highPriorityId,
    title: "Implementar refresh token seguro",
    description: "Agregar renovacion segura de sesiones y revocacion.",
    plannedStartDate: daysAgo(6),
    dueDate: daysAgo(4),
    estimatedMinutes: 360,
    createdByUserId: adminUser.id,
  });

  const taskQaSuite = await ensureTask({
    projectId: projectDesarrollo.id,
    assigneeMembershipId: sofiaDevMembership.id,
    taskStatusId: taskDoneStatusId,
    taskPriorityId: highPriorityId,
    title: "Automatizar pruebas de login",
    description: "Cubrir login, logout, expiracion de sesion y permisos.",
    plannedStartDate: daysAgo(18),
    dueDate: daysAgo(8),
    estimatedMinutes: 420,
    createdByUserId: lauraUser.id,
  });

  const taskLegacyDocs = await ensureTask({
    projectId: projectLegacy.id,
    assigneeMembershipId: null,
    taskStatusId: taskAssignedStatusId,
    taskPriorityId: lowPriorityId,
    title: "Documentar alcance pendiente",
    description: "Consolidar documentacion residual del proyecto desactivado.",
    plannedStartDate: daysAgo(110),
    dueDate: daysAgo(85),
    estimatedMinutes: 120,
    deletedAt: daysAgo(79),
    createdByUserId: adminUser.id,
  });

  const taskRegressionReport = await ensureTask({
    projectId: projectCalidad.id,
    assigneeMembershipId: sofiaQaMembership.id,
    taskStatusId: taskDoneStatusId,
    taskPriorityId: mediumPriorityId,
    title: "Emitir informe final de regresion",
    description: "Publicar resultados del sprint de calidad y defectos encontrados.",
    plannedStartDate: daysAgo(35),
    dueDate: daysAgo(27),
    estimatedMinutes: 180,
    createdByUserId: adminUser.id,
  });

  await ensureTaskTransition({
    taskId: taskBacklogCleanup.id,
    toStatusId: taskAssignedStatusId,
    changedByUserId: adminUser.id,
    changedAt: daysAgo(2),
    notes: "Tarea creada y asignada a operaciones.",
  });

  await ensureTaskTransition({
    taskId: taskApiAuth.id,
    toStatusId: taskAssignedStatusId,
    changedByUserId: adminUser.id,
    changedAt: daysAgo(6),
    notes: "Pendiente de iniciar por desarrollo.",
  });

  await ensureTaskTransition({
    taskId: taskApiAuth.id,
    fromStatusId: taskAssignedStatusId,
    toStatusId: taskInProgressStatusId,
    changedByUserId: lauraUser.id,
    changedAt: daysAgo(5),
    notes: "Desarrollo inicio implementacion del refresh token.",
  });

  await ensureTaskTransition({
    taskId: taskQaSuite.id,
    toStatusId: taskAssignedStatusId,
    changedByUserId: lauraUser.id,
    changedAt: daysAgo(18),
    notes: "Tarea creada para automatizacion QA.",
  });

  await ensureTaskTransition({
    taskId: taskQaSuite.id,
    fromStatusId: taskAssignedStatusId,
    toStatusId: taskInProgressStatusId,
    changedByUserId: sofiaUser.id,
    changedAt: daysAgo(16),
    notes: "Se inicia construccion de pruebas automatizadas.",
  });

  await ensureTaskTransition({
    taskId: taskQaSuite.id,
    fromStatusId: taskInProgressStatusId,
    toStatusId: taskDoneStatusId,
    changedByUserId: sofiaUser.id,
    changedAt: daysAgo(9),
    notes: "Suite terminada y validada por QA.",
  });

  await ensureTaskTransition({
    taskId: taskRegressionReport.id,
    toStatusId: taskAssignedStatusId,
    changedByUserId: adminUser.id,
    changedAt: daysAgo(35),
    notes: "Informe solicitado para cierre del sprint.",
  });

  await ensureTaskTransition({
    taskId: taskRegressionReport.id,
    fromStatusId: taskAssignedStatusId,
    toStatusId: taskInProgressStatusId,
    changedByUserId: sofiaUser.id,
    changedAt: daysAgo(33),
    notes: "QA consolida evidencias de regresion.",
  });

  await ensureTaskTransition({
    taskId: taskRegressionReport.id,
    fromStatusId: taskInProgressStatusId,
    toStatusId: taskDoneStatusId,
    changedByUserId: sofiaUser.id,
    changedAt: daysAgo(27),
    notes: "Reporte entregado y aprobado.",
  });

  await ensureTaskTransition({
    taskId: taskLegacyDocs.id,
    toStatusId: taskAssignedStatusId,
    changedByUserId: adminUser.id,
    changedAt: daysAgo(110),
    notes: "Tarea archivada por cancelacion del proyecto.",
  });

  const authSessionStart = daysAgo(5);
  const authSessionEnd = addHours(authSessionStart, 3);
  await ensureTaskWorkSession({
    taskId: taskApiAuth.id,
    projectMembershipId: lauraDevMembership.id,
    startedByUserId: lauraUser.id,
    endedByUserId: lauraUser.id,
    startedAt: authSessionStart,
    endedAt: authSessionEnd,
  });

  const qaSessionStart = daysAgo(15);
  const qaSessionEnd = addHours(qaSessionStart, 2.5);
  await ensureTaskWorkSession({
    taskId: taskQaSuite.id,
    projectMembershipId: sofiaDevMembership.id,
    startedByUserId: sofiaUser.id,
    endedByUserId: sofiaUser.id,
    startedAt: qaSessionStart,
    endedAt: qaSessionEnd,
  });

  const openSupportSessionStart = daysAgo(1);
  await ensureTaskWorkSession({
    taskId: taskBacklogCleanup.id,
    projectMembershipId: lauraSupportMembership.id,
    startedByUserId: lauraUser.id,
    startedAt: openSupportSessionStart,
  });

  const reportSessionStart = daysAgo(29);
  const reportSessionEnd = addHours(reportSessionStart, 1.5);
  await ensureTaskWorkSession({
    taskId: taskRegressionReport.id,
    projectMembershipId: sofiaQaMembership.id,
    startedByUserId: sofiaUser.id,
    endedByUserId: sofiaUser.id,
    startedAt: reportSessionStart,
    endedAt: reportSessionEnd,
  });

  for (const [projectIndex, project] of generatedProjects.entries()) {
    const memberships = generatedMembershipsByProject.get(project.id) ?? [];
    const tasksPerProject = project.projectStatusId === activeProjectStatusId ? 14 : 9;

    for (let taskIndex = 0; taskIndex < tasksPerProject; taskIndex += 1) {
      const selector = (projectIndex + taskIndex) % 10;
      const taskStatusId = project.projectStatusId !== activeProjectStatusId
        ? selector < 7
          ? taskDoneStatusId
          : selector < 9
            ? taskInProgressStatusId
            : taskAssignedStatusId
        : selector < 4
          ? taskAssignedStatusId
          : selector < 7
            ? taskInProgressStatusId
            : taskDoneStatusId;
      const taskPriorityId = selector < 2 ? highPriorityId : selector < 7 ? mediumPriorityId : lowPriorityId;

      const dueDate = taskStatusId === taskDoneStatusId
        ? daysAgo(20 - ((projectIndex + taskIndex) % 14))
        : taskStatusId === taskInProgressStatusId
          ? daysAgo(2 - ((projectIndex + taskIndex) % 5))
          : daysAgo(-1 * (1 + ((projectIndex + taskIndex) % 10)));
      const plannedStartDate = new Date(dueDate);
      plannedStartDate.setUTCDate(plannedStartDate.getUTCDate() - (3 + (taskIndex % 5)));

      const assigneeMembership = memberships.length > 0
        ? memberships[taskIndex % memberships.length] ?? null
        : null;
      const assigneeEmployee = assigneeMembership
        ? employeeById.get(assigneeMembership.employeeId)
        : null;
      const changedByUserId = assigneeEmployee?.userId ?? adminUser.id;

      const task = await ensureTask({
        projectId: project.id,
        assigneeMembershipId: assigneeMembership?.id ?? null,
        taskStatusId,
        taskPriorityId,
        title: `${project.name} · Tarea ${String(taskIndex + 1).padStart(2, "0")}`,
        description: `Actividad operativa del proyecto ${project.name}, lote ${projectIndex + 1}.`,
        plannedStartDate,
        dueDate,
        estimatedMinutes: 60 + ((taskIndex % 8) * 45),
        createdByUserId: adminUser.id,
      });

      await ensureTaskTransition({
        taskId: task.id,
        toStatusId: taskAssignedStatusId,
        changedByUserId: adminUser.id,
        changedAt: plannedStartDate,
        notes: "Tarea creada dentro del seed masivo.",
      });

      if (taskStatusId === taskInProgressStatusId || taskStatusId === taskDoneStatusId) {
        const inProgressAt = addHours(plannedStartDate, 6);
        await ensureTaskTransition({
          taskId: task.id,
          fromStatusId: taskAssignedStatusId,
          toStatusId: taskInProgressStatusId,
          changedByUserId,
          changedAt: inProgressAt,
          notes: "Inicio de ejecucion en flujo operativo.",
        });
      }

      if (taskStatusId === taskDoneStatusId) {
        const doneAt = addHours(plannedStartDate, 12 + (taskIndex % 6));
        await ensureTaskTransition({
          taskId: task.id,
          fromStatusId: taskInProgressStatusId,
          toStatusId: taskDoneStatusId,
          changedByUserId,
          changedAt: doneAt,
          notes: "Tarea completada dentro del ciclo semanal.",
        });
      }

      if (assigneeMembership) {
        const sessionStart = addHours(plannedStartDate, 2);
        const shouldKeepOpenSession = taskStatusId === taskInProgressStatusId
          && project.projectStatusId === activeProjectStatusId
          && taskIndex % 6 === 0;

        await ensureTaskWorkSession({
          taskId: task.id,
          projectMembershipId: assigneeMembership.id,
          startedByUserId: changedByUserId,
          endedByUserId: shouldKeepOpenSession ? null : changedByUserId,
          startedAt: sessionStart,
          endedAt: shouldKeepOpenSession
            ? null
            : addHours(sessionStart, 1.2 + (taskIndex % 4) * 0.6),
        });
      }
    }
  }

  const latestProjectTask = await prisma.task.findFirst({
    where: {
      deletedAt: null,
      projectId: { not: null },
    },
    orderBy: [{ dueDate: "desc" }, { id: "desc" }],
    select: { dueDate: true },
  });

  const trendAnchorDate = latestProjectTask?.dueDate ?? new Date();
  const trendYear = trendAnchorDate.getUTCFullYear();
  const trendMonthIndex = trendAnchorDate.getUTCMonth();
  const trendDaysInMonth = getDaysInUtcMonth(trendYear, trendMonthIndex);
  const trendWeekCount = Math.max(1, Math.ceil(trendDaysInMonth / 7));
  const trendMonthLabel = `${trendYear}-${String(trendMonthIndex + 1).padStart(2, "0")}`;
  const trendMembershipPool = [lauraSupportMembership, lauraDevMembership, sofiaDevMembership];

  for (let weekIndex = 0; weekIndex < trendWeekCount; weekIndex += 1) {
    const weekStartDay = weekIndex * 7 + 1;
    const toTrendDate = (dayOffset: number) => utcDateAtNoon(
      trendYear,
      trendMonthIndex,
      clampDay(weekStartDay + dayOffset, trendDaysInMonth),
    );

    const dueOnTime = toTrendDate(1);
    const dueEstimateDelayed = toTrendDate(3);
    const dueDateOverdue = toTrendDate(5);

    const membership = trendMembershipPool[weekIndex % trendMembershipPool.length]!;
    const changedByUserId = employeeById.get(membership.employeeId)?.userId ?? adminUser.id;
    const trendPrefix = `[Trend ${trendMonthLabel}] W${String(weekIndex + 1).padStart(2, "0")}`;

    await ensureCompletedComplianceTask({
      projectId: projectDesarrollo.id,
      membershipId: membership.id,
      changedByUserId,
      title: `${trendPrefix} · On Time`,
      description: "Caso controlado de cumplimiento dentro de la ventana prevista.",
      plannedStartDate: addHours(dueOnTime, -96),
      dueDate: dueOnTime,
      doneAt: addHours(dueOnTime, -10),
      estimatedMinutes: 180,
      actualMinutes: 150,
      taskPriorityId: mediumPriorityId,
    });

    await ensureCompletedComplianceTask({
      projectId: projectDesarrollo.id,
      membershipId: membership.id,
      changedByUserId,
      title: `${trendPrefix} · Estimate Delayed`,
      description: "Caso controlado con desviacion de estimado pero entrega en fecha.",
      plannedStartDate: addHours(dueEstimateDelayed, -72),
      dueDate: dueEstimateDelayed,
      doneAt: addHours(dueEstimateDelayed, -6),
      estimatedMinutes: 120,
      actualMinutes: 210,
      taskPriorityId: highPriorityId,
    });

    await ensureCompletedComplianceTask({
      projectId: projectDesarrollo.id,
      membershipId: membership.id,
      changedByUserId,
      title: `${trendPrefix} · Date Overdue`,
      description: "Caso controlado de entrega fuera de fecha para alertas operativas.",
      plannedStartDate: addHours(dueDateOverdue, -60),
      dueDate: dueDateOverdue,
      doneAt: addHours(dueDateOverdue, 30),
      estimatedMinutes: 160,
      actualMinutes: 110,
      taskPriorityId: highPriorityId,
    });
  }

  await ensureNotification({
    userId: lauraUser.id,
    notificationTypeId: areaAssignmentTypeId,
    title: "Nueva asignacion de area",
    message: `Fuiste asignada al area ${operacionesArea.name}.`,
    resourceType: "area",
    resourceId: operacionesArea.id,
    metadata: {
      areaId: operacionesArea.id,
      areaName: operacionesArea.name,
      assignedByUserId: adminUser.id,
    },
    createdAt: daysAgo(120),
    isRead: true,
    readAt: daysAgo(119),
  });

  await ensureNotification({
    userId: lauraUser.id,
    notificationTypeId: areaAssignmentTypeId,
    title: "Nueva asignacion de area",
    message: `Fuiste asignada al area ${desarrolloArea.name}.`,
    resourceType: "area",
    resourceId: desarrolloArea.id,
    metadata: {
      areaId: desarrolloArea.id,
      areaName: desarrolloArea.name,
      assignedByUserId: adminUser.id,
    },
    createdAt: daysAgo(60),
  });

  await ensureNotification({
    userId: lauraUser.id,
    notificationTypeId: projectAssignmentTypeId,
    title: "Nueva asignacion de proyecto",
    message: `Fuiste asignada al proyecto ${projectDesarrollo.name}.`,
    resourceType: "project",
    resourceId: projectDesarrollo.id,
    metadata: {
      projectId: projectDesarrollo.id,
      projectName: projectDesarrollo.name,
      membershipId: lauraDevMembership.id,
      assignedByUserId: adminUser.id,
    },
    createdAt: daysAgo(55),
  });

  await ensureNotification({
    userId: sofiaUser.id,
    notificationTypeId: projectAssignmentTypeId,
    title: "Nueva asignacion de proyecto",
    message: `Fuiste asignada al proyecto ${projectDesarrollo.name}.`,
    resourceType: "project",
    resourceId: projectDesarrollo.id,
    metadata: {
      projectId: projectDesarrollo.id,
      projectName: projectDesarrollo.name,
      membershipId: sofiaDevMembership.id,
      assignedByUserId: adminUser.id,
    },
    createdAt: daysAgo(52),
  });

  await ensureNotification({
    userId: lauraUser.id,
    notificationTypeId: projectAssignmentTypeId,
    title: "Nueva asignacion de proyecto",
    message: `Fuiste asignada al proyecto ${projectOperaciones.name}.`,
    resourceType: "project",
    resourceId: projectOperaciones.id,
    metadata: {
      projectId: projectOperaciones.id,
      projectName: projectOperaciones.name,
      membershipId: lauraSupportMembership.id,
      assignedByUserId: adminUser.id,
    },
    createdAt: daysAgo(70),
    isRead: true,
    readAt: daysAgo(69),
  });

  await ensureNotification({
    userId: lauraUser.id,
    notificationTypeId: taskAssignmentTypeId,
    title: "Nueva tarea asignada",
    message: `Se te asignó la tarea "${taskBacklogCleanup.title}" en ${projectOperaciones.name}.`,
    resourceType: "task",
    resourceId: taskBacklogCleanup.id,
    metadata: {
      taskId: taskBacklogCleanup.id,
      taskTitle: taskBacklogCleanup.title,
      projectId: projectOperaciones.id,
      projectName: projectOperaciones.name,
      assignedByUserId: adminUser.id,
    },
    createdAt: daysAgo(2),
  });

  await ensureNotification({
    userId: lauraUser.id,
    notificationTypeId: taskAssignmentTypeId,
    title: "Nueva tarea asignada",
    message: `Se te asignó la tarea "${taskApiAuth.title}" en ${projectDesarrollo.name}.`,
    resourceType: "task",
    resourceId: taskApiAuth.id,
    metadata: {
      taskId: taskApiAuth.id,
      taskTitle: taskApiAuth.title,
      projectId: projectDesarrollo.id,
      projectName: projectDesarrollo.name,
      assignedByUserId: adminUser.id,
    },
    createdAt: daysAgo(6),
  });

  await ensureNotification({
    userId: sofiaUser.id,
    notificationTypeId: taskAssignmentTypeId,
    title: "Nueva tarea asignada",
    message: `Se te asignó la tarea "${taskQaSuite.title}" en ${projectDesarrollo.name}.`,
    resourceType: "task",
    resourceId: taskQaSuite.id,
    metadata: {
      taskId: taskQaSuite.id,
      taskTitle: taskQaSuite.title,
      projectId: projectDesarrollo.id,
      projectName: projectDesarrollo.name,
      assignedByUserId: lauraUser.id,
    },
    createdAt: daysAgo(18),
    isRead: true,
    readAt: daysAgo(17),
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
