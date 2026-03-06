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
  { id: 3, name: "Cancelado" },
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
    name: "Carlos Desarrollo",
    email: "carlos.desarrollo@taskapp.local",
    role: "employee",
    emailVerified: true,
    phoneNumber: "+573001000003",
    image: "https://example.com/avatar/carlos.png",
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
  {
    name: "Mateo Soporte",
    email: "mateo.soporte@taskapp.local",
    role: "employee",
    emailVerified: false,
    phoneNumber: "+573001000005",
    image: "https://example.com/avatar/mateo.png",
    isActive: true,
  },
  {
    name: "Valentina Inactiva",
    email: "valentina.inactiva@taskapp.local",
    role: "employee",
    emailVerified: true,
    phoneNumber: "+573001000006",
    image: "https://example.com/avatar/valentina.png",
    isActive: false,
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
];

type CatalogItem = { id: number; name: string };

type UserSeed = (typeof usersSeed)[number];
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
  return prisma.account.upsert({
    where: {
      providerId_providerAccountId: {
        providerId,
        providerAccountId,
      },
    },
    update: {
      userId,
      scope: providerId === "credentials" ? "app" : "openid profile email",
      password: password ?? null,
    },
    create: {
      userId,
      providerId,
      providerAccountId,
      scope: providerId === "credentials" ? "app" : "openid profile email",
      password: password ?? null,
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
      assignedAt: params.assignedAt,
    },
  });

  if (existing) {
    return prisma.projectMembership.update({
      where: { id: existing.id },
      data: {
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
      startedAt: params.startedAt,
    },
  });

  if (existing) {
    return prisma.taskWorkSession.update({
      where: { id: existing.id },
      data: {
        projectMembershipId: params.projectMembershipId,
        startedByUserId: params.startedByUserId,
        endedByUserId: params.endedByUserId ?? null,
        endedAt: params.endedAt ?? null,
      },
    });
  }

  return prisma.taskWorkSession.create({ data: params });
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

  const users = new Map<string, Awaited<ReturnType<typeof ensureUser>>>();
  for (const seed of usersSeed) {
    users.set(seed.email, await ensureUser(seed));
  }

  const adminUser = users.get("admin@taskapp.local")!;
  const lauraUser = users.get("laura.operaciones@taskapp.local")!;
  const carlosUser = users.get("carlos.desarrollo@taskapp.local")!;
  const sofiaUser = users.get("sofia.qa@taskapp.local")!;
  const mateoUser = users.get("mateo.soporte@taskapp.local")!;
  const valentinaUser = users.get("valentina.inactiva@taskapp.local")!;

  await ensureAccount(adminUser.id, "credentials", adminUser.email, "admin123");
  await ensureAccount(lauraUser.id, "credentials", lauraUser.email, "laura123");
  await ensureAccount(carlosUser.id, "google", "google-carlos-desarrollo");
  await ensureAccount(sofiaUser.id, "credentials", sofiaUser.email, "sofia123");
  await ensureAccount(mateoUser.id, "github", "github-mateo-soporte");
  await ensureAccount(valentinaUser.id, "credentials", valentinaUser.email, "valentina123");

  await ensureSession(adminUser.id, "sess-admin-principal", 30, "Seeder Admin Agent");
  await ensureSession(lauraUser.id, "sess-laura-operaciones", 15, "Seeder Operations Client");
  await ensureSession(carlosUser.id, "sess-carlos-desarrollo", 15, "Seeder Dev Client");
  await ensureSession(sofiaUser.id, "sess-sofia-qa", 7, "Seeder QA Client");

  await ensureVerification(adminUser.email, "verify-admin-email", 2);
  await ensureVerification(mateoUser.email, "verify-mateo-email", 3);
  await ensureVerification("reset:laura.operaciones@taskapp.local", "reset-laura-password", 1);

  const employees = new Map<string, Awaited<ReturnType<typeof ensureEmployee>>>();
  employees.set(lauraUser.email, await ensureEmployee(lauraUser.id, "Activo"));
  employees.set(carlosUser.email, await ensureEmployee(carlosUser.id, "Activo"));
  employees.set(sofiaUser.email, await ensureEmployee(sofiaUser.id, "Activo"));
  employees.set(mateoUser.email, await ensureEmployee(mateoUser.id, "Activo"));
  employees.set(valentinaUser.email, await ensureEmployee(valentinaUser.id, "Inactivo", daysAgo(45)));

  const areas = new Map<string, Awaited<ReturnType<typeof ensureArea>>>();
  for (const area of areasSeed) {
    areas.set(area.name, await ensureArea(area));
  }

  const lauraEmployee = employees.get(lauraUser.email)!;
  const carlosEmployee = employees.get(carlosUser.email)!;
  const sofiaEmployee = employees.get(sofiaUser.email)!;
  const mateoEmployee = employees.get(mateoUser.email)!;
  const valentinaEmployee = employees.get(valentinaUser.email)!;

  const operacionesArea = areas.get("Operaciones")!;
  const desarrolloArea = areas.get("Desarrollo")!;
  const calidadArea = areas.get("Calidad")!;
  const archivoArea = areas.get("Archivo")!;

  await ensureAreaAssignment({
    employeeId: lauraEmployee.id,
    areaId: operacionesArea.id,
    assignedByUserId: adminUser.id,
    assignedAt: daysAgo(120),
  });

  await ensureAreaAssignment({
    employeeId: carlosEmployee.id,
    areaId: operacionesArea.id,
    assignedByUserId: adminUser.id,
    assignedAt: daysAgo(150),
    endedAt: daysAgo(60),
    endedByUserId: adminUser.id,
  });

  await ensureAreaAssignment({
    employeeId: carlosEmployee.id,
    areaId: desarrolloArea.id,
    assignedByUserId: adminUser.id,
    assignedAt: daysAgo(60),
  });

  await ensureAreaAssignment({
    employeeId: sofiaEmployee.id,
    areaId: calidadArea.id,
    assignedByUserId: adminUser.id,
    assignedAt: daysAgo(90),
  });

  await ensureAreaAssignment({
    employeeId: mateoEmployee.id,
    areaId: operacionesArea.id,
    assignedByUserId: adminUser.id,
    assignedAt: daysAgo(75),
  });

  await ensureAreaAssignment({
    employeeId: valentinaEmployee.id,
    areaId: archivoArea.id,
    assignedByUserId: adminUser.id,
    assignedAt: daysAgo(180),
    endedAt: daysAgo(45),
    endedByUserId: adminUser.id,
  });

  const activeProjectStatusId = await getProjectStatusIdByName("Activo");
  const closedProjectStatusId = await getProjectStatusIdByName("Cerrado");
  const cancelledProjectStatusId = await getProjectStatusIdByName("Cancelado");

  const taskAssignedStatusId = await getTaskStatusIdByName("Asignada");
  const taskInProgressStatusId = await getTaskStatusIdByName("En proceso");
  const taskDoneStatusId = await getTaskStatusIdByName("Terminada");

  const lowPriorityId = await getTaskPriorityIdByName("Baja");
  const mediumPriorityId = await getTaskPriorityIdByName("Media");
  const highPriorityId = await getTaskPriorityIdByName("Alta");

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

  const projectCancelado = await ensureProject({
    areaId: operacionesArea.id,
    projectStatusId: cancelledProjectStatusId,
    name: "Migracion Legacy",
    description: "Iniciativa detenida para migrar operaciones historicas.",
    startDate: daysAgo(130),
    endDate: daysAgo(80),
    closedAt: daysAgo(80),
  });

  const lauraSupportMembership = await ensureProjectMembership({
    projectId: projectOperaciones.id,
    employeeId: lauraEmployee.id,
    assignedByUserId: adminUser.id,
    assignedAt: daysAgo(70),
  });

  const mateoSupportMembership = await ensureProjectMembership({
    projectId: projectOperaciones.id,
    employeeId: mateoEmployee.id,
    assignedByUserId: adminUser.id,
    assignedAt: daysAgo(65),
  });

  const carlosSupportHistoricalMembership = await ensureProjectMembership({
    projectId: projectOperaciones.id,
    employeeId: carlosEmployee.id,
    assignedByUserId: adminUser.id,
    assignedAt: daysAgo(68),
    unassignedAt: daysAgo(58),
    endedByUserId: adminUser.id,
  });

  const carlosDevMembership = await ensureProjectMembership({
    projectId: projectDesarrollo.id,
    employeeId: carlosEmployee.id,
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

  const lauraCancelledMembership = await ensureProjectMembership({
    projectId: projectCancelado.id,
    employeeId: lauraEmployee.id,
    assignedByUserId: adminUser.id,
    assignedAt: daysAgo(125),
    unassignedAt: daysAgo(80),
    endedByUserId: adminUser.id,
  });

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
    assigneeMembershipId: carlosDevMembership.id,
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
    createdByUserId: carlosUser.id,
  });

  const taskLegacyDocs = await ensureTask({
    projectId: projectCancelado.id,
    assigneeMembershipId: null,
    taskStatusId: taskAssignedStatusId,
    taskPriorityId: lowPriorityId,
    title: "Documentar alcance pendiente",
    description: "Consolidar documentacion residual del proyecto cancelado.",
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
    changedByUserId: carlosUser.id,
    changedAt: daysAgo(5),
    notes: "Desarrollo inicio implementacion del refresh token.",
  });

  await ensureTaskTransition({
    taskId: taskQaSuite.id,
    toStatusId: taskAssignedStatusId,
    changedByUserId: carlosUser.id,
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
    projectMembershipId: carlosDevMembership.id,
    startedByUserId: carlosUser.id,
    endedByUserId: carlosUser.id,
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
