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

const taskRecurrenceSchema = z.object({
  frequency: z.enum(["daily", "weekly", "monthly", "range_interval"]),
  every: z.coerce.number().int().positive().max(365).optional().default(1),
  untilDate: z.coerce.date(),
});

const baseCreateTaskObjectSchema = z.object({
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
  recurrence: taskRecurrenceSchema.optional(),
});

export const taskIdParamsSchema = z.object({
  taskId: z.coerce.number().int().positive(),
});

export const tasksListQuerySchema = z.object({
  projectId: z.coerce.number().int().positive().optional(),
  status: z.enum(["all", "assigned", "in_progress", "done"]).optional().default("all"),
  includeDeleted: queryBoolean.optional().default(false),
});

export const standaloneTasksListQuerySchema = z.object({
  status: z.enum(["all", "assigned", "in_progress", "done"]).optional().default("all"),
  includeDeleted: queryBoolean.optional().default(false),
});

export const createTaskSchema = baseCreateTaskObjectSchema.refine((payload) => payload.dueDate >= payload.plannedStartDate, {
  message: "dueDate must be greater than or equal to plannedStartDate",
  path: ["dueDate"],
}).refine((payload) => (
  !payload.recurrence
  || payload.recurrence.untilDate >= payload.dueDate
), {
  message: "recurrence.untilDate must be greater than or equal to dueDate",
  path: ["recurrence", "untilDate"],
});

export const createStandaloneTaskSchema = baseCreateTaskObjectSchema
  .omit({
    projectId: true,
    assigneeMembershipId: true,
  })
  .extend({
    assigneeEmployeeId: nullablePositiveInt.optional(),
  })
  .refine((payload) => payload.dueDate >= payload.plannedStartDate, {
    message: "dueDate must be greater than or equal to plannedStartDate",
    path: ["dueDate"],
  })
  .refine((payload) => (
    !payload.recurrence
    || payload.recurrence.untilDate >= payload.dueDate
  ), {
    message: "recurrence.untilDate must be greater than or equal to dueDate",
    path: ["recurrence", "untilDate"],
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

export const transitionTaskStatusSchema = z.object({
  toStatus: z.enum(["assigned", "in_progress", "done"]),
  notes: nullableTrimmedString
    .refine((value) => value === null || value.length <= 1000, {
      message: "notes must contain at most 1000 characters",
    })
    .optional(),
});

export type TasksListQuery = z.infer<typeof tasksListQuerySchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type StandaloneTasksListQuery = z.infer<typeof standaloneTasksListQuerySchema>;
export type CreateStandaloneTaskInput = z.infer<typeof createStandaloneTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TransitionTaskStatusInput = z.infer<typeof transitionTaskStatusSchema>;
