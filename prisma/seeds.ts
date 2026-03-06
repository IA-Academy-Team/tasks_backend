import prisma from "./prisma.client.js";

const roles = [
  { id: 1, name: "admin", description: "Administrador del sistema" },
  { id: 2, name: "employee", description: "Empleado operativo" },
];

const employeeStatuses = [
  { id: 1, code: "ACTIVE", name: "Activo", description: "Empleado habilitado para operar" },
  { id: 2, code: "INACTIVE", name: "Inactivo", description: "Empleado deshabilitado para operar" },
];

const projectStatuses = [
  { id: 1, code: "ACTIVE", name: "Activo", description: "Proyecto operativo" },
  { id: 2, code: "CLOSED", name: "Cerrado", description: "Proyecto finalizado" },
  { id: 3, code: "CANCELLED", name: "Cancelado", description: "Proyecto cancelado" },
];

const taskStatuses = [
  { id: 1, code: "ASSIGNED", name: "Asignada", description: "Tarea asignada pendiente de iniciar" },
  { id: 2, code: "IN_PROGRESS", name: "En proceso", description: "Tarea en ejecucion" },
  { id: 3, code: "DONE", name: "Terminada", description: "Tarea completada" },
];

const taskPriorities = [
  { id: 1, code: "LOW", name: "Baja", description: "Prioridad baja" },
  { id: 2, code: "MEDIUM", name: "Media", description: "Prioridad media" },
  { id: 3, code: "HIGH", name: "Alta", description: "Prioridad alta" },
];

async function upsertCatalog<T extends { id: number }>(
  items: T[],
  upsert: (item: T) => Promise<unknown>,
) {
  for (const item of items) {
    await upsert(item);
  }
}

async function main() {
  await upsertCatalog(roles, (role) =>
    prisma.role.upsert({
      where: { id: role.id },
      update: {
        name: role.name,
        description: role.description,
      },
      create: role,
    }),
  );

  await upsertCatalog(employeeStatuses, (status) =>
    prisma.employeeStatus.upsert({
      where: { id: status.id },
      update: {
        code: status.code,
        name: status.name,
        description: status.description,
      },
      create: status,
    }),
  );

  await upsertCatalog(projectStatuses, (status) =>
    prisma.projectStatus.upsert({
      where: { id: status.id },
      update: {
        code: status.code,
        name: status.name,
        description: status.description,
      },
      create: status,
    }),
  );

  await upsertCatalog(taskStatuses, (status) =>
    prisma.taskStatus.upsert({
      where: { id: status.id },
      update: {
        code: status.code,
        name: status.name,
        description: status.description,
      },
      create: status,
    }),
  );

  await upsertCatalog(taskPriorities, (priority) =>
    prisma.taskPriority.upsert({
      where: { id: priority.id },
      update: {
        code: priority.code,
        name: priority.name,
        description: priority.description,
      },
      create: priority,
    }),
  );
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
