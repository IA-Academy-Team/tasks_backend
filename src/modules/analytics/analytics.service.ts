import type { Prisma } from "../../../generated/prisma/client.js";
import prisma from "../../../prisma/prisma.client.js";
import type { AdminDashboardQuery } from "./analytics.schemas.js";

const TASK_STATUS_NAMES = {
  assigned: "Asignada",
  inProgress: "En proceso",
  done: "Terminada",
} as const;

interface AnalyticsTaskRecord {
  id: number;
  title: string;
  plannedStartDate: Date;
  dueDate: Date;
  estimatedMinutes: number | null;
  createdAt: Date;
  status: {
    name: string;
  };
  priority: {
    name: string;
  };
  project: {
    id: number;
    name: string;
    area: {
      id: number;
      name: string;
    };
  };
  assigneeMembership: {
    employee: {
      id: number;
      user: {
        id: number;
        name: string;
        email: string;
      };
    };
  } | null;
  workSessions: Array<{
    startedAt: Date;
    endedAt: Date | null;
  }>;
}

interface TaskComputedMetrics {
  actualMinutes: number;
}

interface DashboardAggregate {
  totalTasks: number;
  assignedTasks: number;
  inProgressTasks: number;
  doneTasks: number;
  completionRate: number;
  totalEstimatedMinutes: number;
  totalActualMinutes: number;
  totalDeviationMinutes: number;
}

export interface EmployeeDashboardUpcomingTaskDto {
  id: number;
  title: string;
  status: string;
  priority: string;
  projectId: number;
  projectName: string;
  dueDate: string;
  estimatedMinutes: number | null;
  actualMinutes: number;
}

export interface EmployeeDashboardDto {
  summary: {
    assignedTasks: number;
    inProgressTasks: number;
    doneTasks: number;
    upcomingTasks: number;
    activeTasksAccumulatedMinutes: number;
  };
  upcomingTasks: EmployeeDashboardUpcomingTaskDto[];
}

export interface AdminDashboardEmployeeProductivityDto extends DashboardAggregate {
  employeeId: number;
  userId: number;
  employeeName: string;
  employeeEmail: string;
}

export interface AdminDashboardAreaProductivityDto extends DashboardAggregate {
  areaId: number;
  areaName: string;
}

export interface AdminDashboardDto {
  filters: {
    dateFrom: string | null;
    dateTo: string | null;
    projectId: number | null;
    areaId: number | null;
    employeeId: number | null;
  };
  teamSummary: DashboardAggregate;
  employeeProductivity: AdminDashboardEmployeeProductivityDto[];
  areaProductivity: AdminDashboardAreaProductivityDto[];
}

const toIsoDate = (value: Date) => value.toISOString().slice(0, 10);

const toUtcDayNumber = (value: Date): number => {
  const iso = toIsoDate(value);
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  return Date.UTC(year, month - 1, day);
};

const round2 = (value: number): number => Math.round(value * 100) / 100;

const computeActualMinutes = (
  workSessions: AnalyticsTaskRecord["workSessions"],
  now: Date,
): TaskComputedMetrics => {
  let totalMs = 0;

  for (const session of workSessions) {
    const startedAtMs = session.startedAt.getTime();
    const endedAtMs = (session.endedAt ?? now).getTime();
    if (endedAtMs > startedAtMs) {
      totalMs += endedAtMs - startedAtMs;
    }
  }

  return { actualMinutes: Math.max(0, Math.round(totalMs / 60000)) };
};

const createEmptyAggregate = (): DashboardAggregate => ({
  totalTasks: 0,
  assignedTasks: 0,
  inProgressTasks: 0,
  doneTasks: 0,
  completionRate: 0,
  totalEstimatedMinutes: 0,
  totalActualMinutes: 0,
  totalDeviationMinutes: 0,
});

const buildAggregate = (
  tasks: Array<{ statusName: string; estimatedMinutes: number | null; actualMinutes: number }>,
): DashboardAggregate => {
  const aggregate = createEmptyAggregate();

  for (const task of tasks) {
    aggregate.totalTasks += 1;
    if (task.statusName === TASK_STATUS_NAMES.assigned) aggregate.assignedTasks += 1;
    if (task.statusName === TASK_STATUS_NAMES.inProgress) aggregate.inProgressTasks += 1;
    if (task.statusName === TASK_STATUS_NAMES.done) aggregate.doneTasks += 1;

    aggregate.totalEstimatedMinutes += task.estimatedMinutes ?? 0;
    aggregate.totalActualMinutes += task.actualMinutes;
  }

  aggregate.totalDeviationMinutes = aggregate.totalActualMinutes - aggregate.totalEstimatedMinutes;
  aggregate.completionRate = aggregate.totalTasks === 0
    ? 0
    : round2((aggregate.doneTasks / aggregate.totalTasks) * 100);

  return aggregate;
};

const baseAnalyticsTaskInclude = {
  status: {
    select: { name: true },
  },
  priority: {
    select: { name: true },
  },
  project: {
    select: {
      id: true,
      name: true,
      area: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  assigneeMembership: {
    select: {
      employee: {
        select: {
          id: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  },
  workSessions: {
    select: {
      startedAt: true,
      endedAt: true,
    },
  },
} satisfies Prisma.TaskInclude;

export const getEmployeeDashboard = async (authUserId: number): Promise<EmployeeDashboardDto> => {
  const tasks = await prisma.task.findMany({
    where: {
      deletedAt: null,
      assigneeMembership: {
        unassignedAt: null,
        employee: {
          userId: authUserId,
        },
      },
      project: {
        status: {
          name: "Activo",
        },
      },
    },
    orderBy: [{ dueDate: "asc" }, { id: "desc" }],
    include: baseAnalyticsTaskInclude,
  });

  const typedTasks = tasks as unknown as AnalyticsTaskRecord[];
  const now = new Date();
  const todayDay = toUtcDayNumber(now);
  const upcomingLimitDay = todayDay + (7 * 24 * 60 * 60 * 1000);

  const computedTasks = typedTasks.map((task) => ({
    task,
    metrics: computeActualMinutes(task.workSessions, now),
  }));

  const assignedTasks = computedTasks.filter((item) => item.task.status.name === TASK_STATUS_NAMES.assigned);
  const inProgressTasks = computedTasks.filter((item) => item.task.status.name === TASK_STATUS_NAMES.inProgress);
  const doneTasks = computedTasks.filter((item) => item.task.status.name === TASK_STATUS_NAMES.done);
  const activeTasksAccumulatedMinutes = [...assignedTasks, ...inProgressTasks]
    .reduce((sum, item) => sum + item.metrics.actualMinutes, 0);

  const upcomingTasks = computedTasks
    .filter((item) => {
      if (item.task.status.name === TASK_STATUS_NAMES.done) return false;
      const dueDay = toUtcDayNumber(item.task.dueDate);
      return dueDay >= todayDay && dueDay <= upcomingLimitDay;
    })
    .map((item) => ({
      id: item.task.id,
      title: item.task.title,
      status: item.task.status.name,
      priority: item.task.priority.name,
      projectId: item.task.project.id,
      projectName: item.task.project.name,
      dueDate: toIsoDate(item.task.dueDate),
      estimatedMinutes: item.task.estimatedMinutes ?? null,
      actualMinutes: item.metrics.actualMinutes,
    }))
    .slice(0, 10);

  return {
    summary: {
      assignedTasks: assignedTasks.length,
      inProgressTasks: inProgressTasks.length,
      doneTasks: doneTasks.length,
      upcomingTasks: upcomingTasks.length,
      activeTasksAccumulatedMinutes,
    },
    upcomingTasks,
  };
};

export const getAdminDashboard = async (query: AdminDashboardQuery): Promise<AdminDashboardDto> => {
  const whereClauses: Prisma.TaskWhereInput[] = [{ deletedAt: null }];

  if (query.projectId !== undefined) {
    whereClauses.push({ projectId: query.projectId });
  }

  if (query.areaId !== undefined) {
    whereClauses.push({
      project: {
        areaId: query.areaId,
      },
    });
  }

  if (query.employeeId !== undefined) {
    whereClauses.push({
      assigneeMembership: {
        employeeId: query.employeeId,
      },
    });
  }

  if (query.dateFrom || query.dateTo) {
    whereClauses.push({
      plannedStartDate: {
        ...(query.dateFrom ? { gte: query.dateFrom } : {}),
        ...(query.dateTo ? { lte: query.dateTo } : {}),
      },
    });
  }

  const tasks = await prisma.task.findMany({
    where: {
      AND: whereClauses,
    },
    orderBy: [{ plannedStartDate: "desc" }, { id: "desc" }],
    include: baseAnalyticsTaskInclude,
  });

  const now = new Date();
  const typedTasks = tasks as unknown as AnalyticsTaskRecord[];
  const tasksWithMetrics = typedTasks.map((task) => ({
    task,
    statusName: task.status.name,
    estimatedMinutes: task.estimatedMinutes,
    actualMinutes: computeActualMinutes(task.workSessions, now).actualMinutes,
  }));

  const teamSummary = buildAggregate(tasksWithMetrics);

  const employeeMap = new Map<number, {
    employeeId: number;
    userId: number;
    employeeName: string;
    employeeEmail: string;
    tasks: typeof tasksWithMetrics;
  }>();

  const areaMap = new Map<number, {
    areaId: number;
    areaName: string;
    tasks: typeof tasksWithMetrics;
  }>();

  for (const item of tasksWithMetrics) {
    const assigneeEmployee = item.task.assigneeMembership?.employee;
    if (assigneeEmployee) {
      const existing = employeeMap.get(assigneeEmployee.id);
      if (existing) {
        existing.tasks.push(item);
      } else {
        employeeMap.set(assigneeEmployee.id, {
          employeeId: assigneeEmployee.id,
          userId: assigneeEmployee.user.id,
          employeeName: assigneeEmployee.user.name,
          employeeEmail: assigneeEmployee.user.email,
          tasks: [item],
        });
      }
    }

    const areaId = item.task.project.area.id;
    const existingArea = areaMap.get(areaId);
    if (existingArea) {
      existingArea.tasks.push(item);
    } else {
      areaMap.set(areaId, {
        areaId,
        areaName: item.task.project.area.name,
        tasks: [item],
      });
    }
  }

  const employeeProductivity: AdminDashboardEmployeeProductivityDto[] = Array.from(employeeMap.values())
    .map((entry) => ({
      employeeId: entry.employeeId,
      userId: entry.userId,
      employeeName: entry.employeeName,
      employeeEmail: entry.employeeEmail,
      ...buildAggregate(entry.tasks),
    }))
    .sort((a, b) => (
      b.completionRate - a.completionRate
      || b.totalTasks - a.totalTasks
      || a.employeeName.localeCompare(b.employeeName)
    ));

  const areaProductivity: AdminDashboardAreaProductivityDto[] = Array.from(areaMap.values())
    .map((entry) => ({
      areaId: entry.areaId,
      areaName: entry.areaName,
      ...buildAggregate(entry.tasks),
    }))
    .sort((a, b) => (
      b.completionRate - a.completionRate
      || b.totalTasks - a.totalTasks
      || a.areaName.localeCompare(b.areaName)
    ));

  return {
    filters: {
      dateFrom: query.dateFrom ? toIsoDate(query.dateFrom) : null,
      dateTo: query.dateTo ? toIsoDate(query.dateTo) : null,
      projectId: query.projectId ?? null,
      areaId: query.areaId ?? null,
      employeeId: query.employeeId ?? null,
    },
    teamSummary,
    employeeProductivity,
    areaProductivity,
  };
};
