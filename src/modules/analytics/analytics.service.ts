import type { Prisma } from "../../../generated/prisma/client.js";
import prisma from "../../../prisma/prisma.client.js";
import type {
  AdminDashboardQuery,
  OverdueAlertsQuery,
  TaskComplianceReportQuery,
} from "./analytics.schemas.js";

const TASK_STATUS_NAMES = {
  assigned: "Asignada",
  inProgress: "En proceso",
  done: "Terminada",
} as const;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

type AnalyticsDateFilterField = "plannedStartDate" | "dueDate";

type AnalyticsBaseFilters = {
  dateFrom?: Date | undefined;
  dateTo?: Date | undefined;
  projectId?: number | undefined;
  areaId?: number | undefined;
  employeeId?: number | undefined;
};

export type TaskComplianceStatus = "on_time" | "estimate_delayed" | "date_overdue";
export type OverdueAlertReason = "DATE_OVERDUE" | "ESTIMATE_OVERDUE";

interface AnalyticsTaskRecord {
  id: number;
  title: string;
  plannedStartDate: Date;
  dueDate: Date;
  estimatedMinutes: number | null;
  reportedActualMinutes: number | null;
  completionEvidence: string | null;
  createdAt: Date;
  updatedAt: Date;
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
  statusTransitions: Array<{
    changedAt: Date;
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

interface TaskComplianceMetrics {
  actualMinutes: number;
  deviationMinutes: number | null;
  isEstimateDelayed: boolean | null;
  isDateOverdue: boolean;
  completedAt: string | null;
  complianceStatus: TaskComplianceStatus;
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

export interface AdminDashboardProjectProductivityDto extends DashboardAggregate {
  projectId: number;
  projectName: string;
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
  projectProductivity: AdminDashboardProjectProductivityDto[];
}

export interface TaskComplianceReportRowDto {
  taskId: number;
  title: string;
  projectId: number;
  projectName: string;
  areaId: number;
  areaName: string;
  assigneeEmployeeId: number | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  status: string;
  priority: string;
  plannedStartDate: string;
  dueDate: string;
  completedAt: string | null;
  estimatedMinutes: number | null;
  actualMinutes: number;
  deviationMinutes: number | null;
  isEstimateDelayed: boolean | null;
  isDateOverdue: boolean;
  complianceStatus: TaskComplianceStatus;
  complianceLabel: string;
}

export interface TaskComplianceReportDto {
  filters: {
    dateFrom: string | null;
    dateTo: string | null;
    projectId: number | null;
    areaId: number | null;
    employeeId: number | null;
    compliance: TaskComplianceReportQuery["compliance"];
    limit: number;
  };
  summary: {
    totalTasks: number;
    onTimeTasks: number;
    estimateDelayedTasks: number;
    dateOverdueTasks: number;
  };
  rows: TaskComplianceReportRowDto[];
}

export interface OverdueAlertDto {
  taskId: number;
  title: string;
  projectId: number;
  projectName: string;
  areaId: number;
  areaName: string;
  assigneeName: string | null;
  assigneeEmail: string | null;
  status: string;
  priority: string;
  dueDate: string;
  estimatedMinutes: number | null;
  actualMinutes: number;
  deviationMinutes: number | null;
  reason: OverdueAlertReason;
  reasonLabel: string;
  daysOverdue: number | null;
}

export interface OverdueAlertsDto {
  generatedAt: string;
  filters: {
    dateFrom: string | null;
    dateTo: string | null;
    projectId: number | null;
    areaId: number | null;
    employeeId: number | null;
    limit: number;
  };
  counters: {
    totalAlerts: number;
    dateOverdueAlerts: number;
    estimateOverdueAlerts: number;
  };
  alerts: OverdueAlertDto[];
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

const getComplianceLabel = (status: TaskComplianceStatus): string => {
  if (status === "date_overdue") return "Atraso por fecha";
  if (status === "estimate_delayed") return "Atraso estimado";
  return "En tiempo";
};

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

const resolveTaskActualMinutes = (task: AnalyticsTaskRecord, now: Date): number => {
  if (task.reportedActualMinutes !== null) {
    return task.reportedActualMinutes;
  }

  return computeActualMinutes(task.workSessions, now).actualMinutes;
};

const getTaskCompletedAtDate = (task: AnalyticsTaskRecord): Date | null =>
  task.statusTransitions[0]?.changedAt ?? null;

const computeTaskComplianceMetrics = (
  task: AnalyticsTaskRecord,
  now: Date,
): TaskComplianceMetrics => {
  const completedAtDate = getTaskCompletedAtDate(task);
  const completedAt = completedAtDate?.toISOString() ?? null;
  const actualMinutes = resolveTaskActualMinutes(task, now);
  const deviationMinutes = task.estimatedMinutes === null
    ? null
    : actualMinutes - task.estimatedMinutes;
  const isEstimateDelayed = task.estimatedMinutes === null
    ? null
    : actualMinutes > task.estimatedMinutes;

  const dueDay = toUtcDayNumber(task.dueDate);
  const completionReference = task.status.name === TASK_STATUS_NAMES.done
    ? (completedAtDate ?? task.updatedAt)
    : now;
  const referenceDay = toUtcDayNumber(completionReference);
  const isDateOverdue = referenceDay > dueDay;
  const complianceStatus: TaskComplianceStatus = isDateOverdue
    ? "date_overdue"
    : isEstimateDelayed
      ? "estimate_delayed"
      : "on_time";

  return {
    actualMinutes,
    deviationMinutes,
    isEstimateDelayed,
    isDateOverdue,
    completedAt,
    complianceStatus,
  };
};

const buildTaskWhereClausesFromFilters = (
  filters: AnalyticsBaseFilters,
  dateField: AnalyticsDateFilterField,
): Prisma.TaskWhereInput[] => {
  const whereClauses: Prisma.TaskWhereInput[] = [
    { deletedAt: null },
    { projectId: { not: null } },
  ];

  if (filters.projectId !== undefined) {
    whereClauses.push({ projectId: filters.projectId });
  }

  if (filters.areaId !== undefined) {
    whereClauses.push({
      project: {
        areaId: filters.areaId,
      },
    });
  }

  if (filters.employeeId !== undefined) {
    whereClauses.push({
      assigneeMembership: {
        employeeId: filters.employeeId,
      },
    });
  }

  if (filters.dateFrom || filters.dateTo) {
    const dateRange = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { lte: filters.dateTo } : {}),
    };

    whereClauses.push(
      dateField === "plannedStartDate"
        ? { plannedStartDate: dateRange }
        : { dueDate: dateRange },
    );
  }

  return whereClauses;
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

const analyticsTaskInclude = {
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

export const getEmployeeDashboard = async (authUserId: number): Promise<EmployeeDashboardDto> => {
  const tasks = await prisma.task.findMany({
    where: {
      deletedAt: null,
      OR: [
        {
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
        {
          projectId: null,
          assigneeEmployee: {
            userId: authUserId,
          },
        },
      ],
    },
    orderBy: [{ dueDate: "asc" }, { id: "desc" }],
    include: analyticsTaskInclude,
  });

  const typedTasks = tasks as unknown as AnalyticsTaskRecord[];
  const now = new Date();
  const todayDay = toUtcDayNumber(now);
  const upcomingLimitDay = todayDay + (7 * DAY_IN_MS);

  const computedTasks = typedTasks.map((task) => ({
    task,
    metrics: { actualMinutes: resolveTaskActualMinutes(task, now) },
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
      projectId: item.task.project?.id ?? 0,
      projectName: item.task.project?.name ?? "Tarea suelta",
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
  const whereClauses = buildTaskWhereClausesFromFilters(query, "plannedStartDate");

  const tasks = await prisma.task.findMany({
    where: {
      AND: whereClauses,
    },
    orderBy: [{ plannedStartDate: "desc" }, { id: "desc" }],
    include: analyticsTaskInclude,
  });

  const now = new Date();
  const typedTasks = tasks as unknown as AnalyticsTaskRecord[];
  const tasksWithMetrics = typedTasks.map((task) => ({
    task,
    statusName: task.status.name,
    estimatedMinutes: task.estimatedMinutes,
    actualMinutes: resolveTaskActualMinutes(task, now),
  }));

  const teamSummary = buildAggregate(tasksWithMetrics);

  const employeeMap = new Map<number, {
    employeeId: number;
    userId: number;
    employeeName: string;
    employeeEmail: string;
    tasks: typeof tasksWithMetrics;
  }>();

  const projectMap = new Map<number, {
    projectId: number;
    projectName: string;
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

    const projectId = item.task.project.id;
    const existingProject = projectMap.get(projectId);
    if (existingProject) {
      existingProject.tasks.push(item);
    } else {
      projectMap.set(projectId, {
        projectId,
        projectName: item.task.project.name,
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

  const projectProductivity: AdminDashboardProjectProductivityDto[] = Array.from(projectMap.values())
    .map((entry) => ({
      projectId: entry.projectId,
      projectName: entry.projectName,
      ...buildAggregate(entry.tasks),
    }))
    .sort((a, b) => (
      b.completionRate - a.completionRate
      || b.totalTasks - a.totalTasks
      || a.projectName.localeCompare(b.projectName)
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
    projectProductivity,
  };
};

export const getTaskComplianceReport = async (
  query: TaskComplianceReportQuery,
): Promise<TaskComplianceReportDto> => {
  const whereClauses = buildTaskWhereClausesFromFilters(query, "dueDate");

  const tasks = await prisma.task.findMany({
    where: {
      AND: whereClauses,
    },
    orderBy: [{ dueDate: "asc" }, { id: "desc" }],
    include: analyticsTaskInclude,
  });

  const now = new Date();
  const typedTasks = tasks as unknown as AnalyticsTaskRecord[];

  const reportRows = typedTasks.map((task) => {
    const metrics = computeTaskComplianceMetrics(task, now);

    return {
      taskId: task.id,
      title: task.title,
      projectId: task.project.id,
      projectName: task.project.name,
      areaId: task.project.area?.id ?? 0,
      areaName: task.project.area?.name ?? "Sin area",
      assigneeEmployeeId: task.assigneeMembership?.employee.id ?? null,
      assigneeName: task.assigneeMembership?.employee.user.name ?? null,
      assigneeEmail: task.assigneeMembership?.employee.user.email ?? null,
      status: task.status.name,
      priority: task.priority.name,
      plannedStartDate: toIsoDate(task.plannedStartDate),
      dueDate: toIsoDate(task.dueDate),
      completedAt: metrics.completedAt,
      estimatedMinutes: task.estimatedMinutes ?? null,
      actualMinutes: metrics.actualMinutes,
      deviationMinutes: metrics.deviationMinutes,
      isEstimateDelayed: metrics.isEstimateDelayed,
      isDateOverdue: metrics.isDateOverdue,
      complianceStatus: metrics.complianceStatus,
      complianceLabel: getComplianceLabel(metrics.complianceStatus),
    } satisfies TaskComplianceReportRowDto;
  });

  const complianceFilteredRows = query.compliance === "all"
    ? reportRows
    : reportRows.filter((row) => row.complianceStatus === query.compliance);

  const complianceSortWeight: Record<TaskComplianceStatus, number> = {
    date_overdue: 0,
    estimate_delayed: 1,
    on_time: 2,
  };

  const sortedRows = [...complianceFilteredRows].sort((a, b) => (
    complianceSortWeight[a.complianceStatus] - complianceSortWeight[b.complianceStatus]
    || Date.parse(a.dueDate) - Date.parse(b.dueDate)
    || b.taskId - a.taskId
  ));

  const rows = sortedRows.slice(0, query.limit);
  const onTimeTasks = complianceFilteredRows.filter((row) => row.complianceStatus === "on_time").length;
  const estimateDelayedTasks = complianceFilteredRows
    .filter((row) => row.complianceStatus === "estimate_delayed").length;
  const dateOverdueTasks = complianceFilteredRows
    .filter((row) => row.complianceStatus === "date_overdue").length;

  return {
    filters: {
      dateFrom: query.dateFrom ? toIsoDate(query.dateFrom) : null,
      dateTo: query.dateTo ? toIsoDate(query.dateTo) : null,
      projectId: query.projectId ?? null,
      areaId: query.areaId ?? null,
      employeeId: query.employeeId ?? null,
      compliance: query.compliance,
      limit: query.limit,
    },
    summary: {
      totalTasks: complianceFilteredRows.length,
      onTimeTasks,
      estimateDelayedTasks,
      dateOverdueTasks,
    },
    rows,
  };
};

export const getOverdueAlerts = async (query: OverdueAlertsQuery): Promise<OverdueAlertsDto> => {
  const whereClauses = buildTaskWhereClausesFromFilters(query, "dueDate");
  whereClauses.push({
    status: {
      name: {
        not: TASK_STATUS_NAMES.done,
      },
    },
  });

  const tasks = await prisma.task.findMany({
    where: {
      AND: whereClauses,
    },
    orderBy: [{ dueDate: "asc" }, { id: "desc" }],
    include: analyticsTaskInclude,
  });

  const now = new Date();
  const todayDay = toUtcDayNumber(now);
  const typedTasks = tasks as unknown as AnalyticsTaskRecord[];

  const alerts = typedTasks.flatMap((task) => {
    const metrics = computeTaskComplianceMetrics(task, now);
    const isEstimateOverdue = task.estimatedMinutes !== null && metrics.actualMinutes > task.estimatedMinutes;
    let reason: OverdueAlertReason | null = null;

    if (metrics.isDateOverdue) {
      reason = "DATE_OVERDUE";
    } else if (isEstimateOverdue) {
      reason = "ESTIMATE_OVERDUE";
    }

    if (!reason) {
      return [];
    }

    const dueDay = toUtcDayNumber(task.dueDate);
    const daysOverdue = reason === "DATE_OVERDUE"
      ? Math.max(1, Math.floor((todayDay - dueDay) / DAY_IN_MS))
      : null;

    return [{
      taskId: task.id,
      title: task.title,
      projectId: task.project.id,
      projectName: task.project.name,
      areaId: task.project.area?.id ?? 0,
      areaName: task.project.area?.name ?? "Sin area",
      assigneeName: task.assigneeMembership?.employee.user.name ?? null,
      assigneeEmail: task.assigneeMembership?.employee.user.email ?? null,
      status: task.status.name,
      priority: task.priority.name,
      dueDate: toIsoDate(task.dueDate),
      estimatedMinutes: task.estimatedMinutes ?? null,
      actualMinutes: metrics.actualMinutes,
      deviationMinutes: metrics.deviationMinutes,
      reason,
      reasonLabel: reason === "DATE_OVERDUE" ? "Atraso por fecha" : "Atraso por estimacion",
      daysOverdue,
    } satisfies OverdueAlertDto];
  });

  const sortedAlerts = alerts.sort((a, b) => (
    Number(b.reason === "DATE_OVERDUE") - Number(a.reason === "DATE_OVERDUE")
    || (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0)
    || (b.deviationMinutes ?? 0) - (a.deviationMinutes ?? 0)
    || Date.parse(a.dueDate) - Date.parse(b.dueDate)
    || b.taskId - a.taskId
  ));

  const limitedAlerts = sortedAlerts.slice(0, query.limit);
  const dateOverdueAlerts = limitedAlerts.filter((alert) => alert.reason === "DATE_OVERDUE").length;
  const estimateOverdueAlerts = limitedAlerts.filter((alert) => alert.reason === "ESTIMATE_OVERDUE").length;

  return {
    generatedAt: now.toISOString(),
    filters: {
      dateFrom: query.dateFrom ? toIsoDate(query.dateFrom) : null,
      dateTo: query.dateTo ? toIsoDate(query.dateTo) : null,
      projectId: query.projectId ?? null,
      areaId: query.areaId ?? null,
      employeeId: query.employeeId ?? null,
      limit: query.limit,
    },
    counters: {
      totalAlerts: limitedAlerts.length,
      dateOverdueAlerts,
      estimateOverdueAlerts,
    },
    alerts: limitedAlerts,
  };
};
