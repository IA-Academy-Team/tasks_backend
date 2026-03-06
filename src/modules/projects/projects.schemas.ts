import { z } from "zod";

const nullableTrimmedString = z.preprocess(
  (value) => (value === "" ? null : value),
  z.union([z.string().trim(), z.null()]),
);

const nullableDateInput = z.preprocess(
  (value) => (value === "" ? null : value),
  z.union([z.coerce.date(), z.null()]),
);

export const projectsListQuerySchema = z.object({
  status: z.enum(["all", "active", "closed", "cancelled"]).optional().default("all"),
  areaId: z.coerce.number().int().positive().optional(),
});

export const projectIdParamsSchema = z.object({
  projectId: z.coerce.number().int().positive(),
});

export const projectMembershipIdParamsSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  membershipId: z.coerce.number().int().positive(),
});

export const createProjectSchema = z.object({
  areaId: z.coerce.number().int().positive(),
  name: z.string().trim().min(2).max(160),
  description: nullableTrimmedString
    .refine((value) => value === null || value.length <= 5000, {
      message: "description must contain at most 5000 characters",
    })
    .optional(),
  startDate: nullableDateInput.optional(),
  endDate: nullableDateInput.optional(),
}).refine((payload) => (
  !payload.startDate
  || !payload.endDate
  || payload.endDate >= payload.startDate
), {
  message: "endDate must be greater than or equal to startDate",
  path: ["endDate"],
});

export const updateProjectSchema = z.object({
  areaId: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(2).max(160).optional(),
  description: nullableTrimmedString
    .refine((value) => value === null || value.length <= 5000, {
      message: "description must contain at most 5000 characters",
    })
    .optional(),
  startDate: nullableDateInput.optional(),
  endDate: nullableDateInput.optional(),
}).refine((payload) => Object.keys(payload).length > 0, {
  message: "At least one editable field is required",
});

export const updateProjectStatusSchema = z.object({
  status: z.enum(["active", "closed", "cancelled"]),
  endDate: nullableDateInput.optional(),
});

export const projectMembershipsListQuerySchema = z.object({
  status: z.enum(["all", "active", "inactive"]).optional().default("all"),
});

export const assignProjectMembershipSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
});

export const reassignProjectMembershipSchema = z.object({
  toEmployeeId: z.coerce.number().int().positive(),
});

export type ProjectsListQuery = z.infer<typeof projectsListQuerySchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type UpdateProjectStatusInput = z.infer<typeof updateProjectStatusSchema>;
export type ProjectMembershipsListQuery = z.infer<typeof projectMembershipsListQuerySchema>;
export type AssignProjectMembershipInput = z.infer<typeof assignProjectMembershipSchema>;
export type ReassignProjectMembershipInput = z.infer<typeof reassignProjectMembershipSchema>;
