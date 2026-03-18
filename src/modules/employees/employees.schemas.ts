import { z } from "zod";

const nullableTrimmedString = z.preprocess(
  (value) => (value === "" ? null : value),
  z.union([z.string().trim(), z.null()]),
);

const imageUrlSchema = nullableTrimmedString
  .refine((value) => value === null || /^https?:\/\//i.test(value), {
    message: "image must be a valid http/https url",
  })
  .refine((value) => value === null || value.length <= 2000, {
    message: "image must contain at most 2000 characters",
  });

export const employeesListQuerySchema = z.object({
  status: z.enum(["all", "active", "inactive"]).optional().default("all"),
});

export const employeeIdParamsSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
});

export const createEmployeeSchema = z.object({
  name: z.string().trim().min(2).max(150),
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(8).max(72),
  phoneNumber: nullableTrimmedString
    .refine((value) => value === null || value.length <= 30, {
      message: "phoneNumber must contain at most 30 characters",
    })
    .optional(),
  image: imageUrlSchema.optional(),
  emailVerified: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

export const updateEmployeeSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  phoneNumber: nullableTrimmedString
    .refine((value) => value === null || value.length <= 30, {
      message: "phoneNumber must contain at most 30 characters",
    })
    .optional(),
  image: imageUrlSchema.optional(),
  emailVerified: z.boolean().optional(),
}).refine((payload) => Object.keys(payload).length > 0, {
  message: "At least one editable field is required",
});

export const updateEmployeeStatusSchema = z.object({
  isActive: z.boolean(),
});

export const employeeAssignmentsListQuerySchema = z.object({
  status: z.enum(["all", "active", "inactive"]).optional().default("all"),
});

export const assignEmployeeAreaSchema = z.object({
  areaId: z.coerce.number().int().positive(),
});

export const unassignEmployeeAreaSchema = z.object({
  areaId: z.coerce.number().int().positive().optional(),
});

export type EmployeesListQuery = z.infer<typeof employeesListQuerySchema>;
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type UpdateEmployeeStatusInput = z.infer<typeof updateEmployeeStatusSchema>;
export type EmployeeAssignmentsListQuery = z.infer<typeof employeeAssignmentsListQuerySchema>;
export type AssignEmployeeAreaInput = z.infer<typeof assignEmployeeAreaSchema>;
export type UnassignEmployeeAreaInput = z.infer<typeof unassignEmployeeAreaSchema>;
