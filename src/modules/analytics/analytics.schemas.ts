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

export const adminDashboardQuerySchema = z.object({
  dateFrom: optionalDateQuery,
  dateTo: optionalDateQuery,
  projectId: z.coerce.number().int().positive().optional(),
  areaId: z.coerce.number().int().positive().optional(),
  employeeId: z.coerce.number().int().positive().optional(),
}).refine((query) => !query.dateFrom || !query.dateTo || query.dateTo >= query.dateFrom, {
  message: "dateTo must be greater than or equal to dateFrom",
  path: ["dateTo"],
});

export type AdminDashboardQuery = z.infer<typeof adminDashboardQuerySchema>;
