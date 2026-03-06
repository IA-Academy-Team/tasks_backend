import { z } from "zod";

const optionalDateQuery = z.preprocess(
  (value) => {
    if (value === "" || value === undefined || value === null) {
      return undefined;
    }
    return value;
  },
  z.coerce.date().optional(),
);

const optionalPositiveIntQuery = z.coerce.number().int().positive().optional();

const analyticsBaseFiltersSchema = z.object({
  dateFrom: optionalDateQuery,
  dateTo: optionalDateQuery,
  projectId: optionalPositiveIntQuery,
  areaId: optionalPositiveIntQuery,
  employeeId: optionalPositiveIntQuery,
}).refine((query) => !query.dateFrom || !query.dateTo || query.dateTo >= query.dateFrom, {
  message: "dateTo must be greater than or equal to dateFrom",
  path: ["dateTo"],
});

export const adminDashboardQuerySchema = analyticsBaseFiltersSchema;

export const taskComplianceReportQuerySchema = analyticsBaseFiltersSchema.extend({
  compliance: z.enum(["all", "on_time", "estimate_delayed", "date_overdue"]).optional().default("all"),
  limit: z.coerce.number().int().min(1).max(500).optional().default(200),
});

export const overdueAlertsQuerySchema = analyticsBaseFiltersSchema.extend({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type AdminDashboardQuery = z.infer<typeof adminDashboardQuerySchema>;
export type TaskComplianceReportQuery = z.infer<typeof taskComplianceReportQuerySchema>;
export type OverdueAlertsQuery = z.infer<typeof overdueAlertsQuerySchema>;
