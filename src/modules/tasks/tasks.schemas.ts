import { z } from "zod";

const nullableTrimmedString = z.preprocess(
  (value) => (value === "" ? null : value),
  z.union([z.string().trim(), z.null()]),
);

const queryBoolean = z.preprocess((value) => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return value;
}, z.boolean());

const nullablePositiveInt = z.preprocess(
  (value) => (value === "" ? null : value),
  z.union([z.coerce.number().int().positive(), z.null()]),
);

export const taskIdParamsSchema = z.object({
  taskId: z.coerce.number().int().positive(),
});

export const tasksListQuerySchema = z.object({
  projectId: z.coerce.number().int().positive().optional(),
  status: z.enum(["all", "assigned", "in_progress", "done"]).optional().default("all"),
  includeDeleted: queryBoolean.optional().default(false),
});

export const createTaskSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  title: z.string().trim().min(3).max(160),
  description: nullableTrimmedString
    .refine((value) => value === null || value.length <= 5000, {
      message: "description must contain at most 5000 characters",
    })
    .optional(),
  plannedStartDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  taskPriorityId: z.coerce.number().int().positive().optional().default(2),
  assigneeMembershipId: nullablePositiveInt.optional(),
  estimatedMinutes: nullablePositiveInt.optional(),
}).refine((payload) => payload.dueDate >= payload.plannedStartDate, {
  message: "dueDate must be greater than or equal to plannedStartDate",
  path: ["dueDate"],
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  description: nullableTrimmedString
    .refine((value) => value === null || value.length <= 5000, {
      message: "description must contain at most 5000 characters",
    })
    .optional(),
  plannedStartDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  taskPriorityId: z.coerce.number().int().positive().optional(),
  assigneeMembershipId: nullablePositiveInt.optional(),
  estimatedMinutes: nullablePositiveInt.optional(),
}).refine((payload) => Object.keys(payload).length > 0, {
  message: "At least one editable field is required",
});

export type TasksListQuery = z.infer<typeof tasksListQuerySchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
