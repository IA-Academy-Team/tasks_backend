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
