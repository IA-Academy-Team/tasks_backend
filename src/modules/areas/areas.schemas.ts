import { z } from "zod";

const nullableTrimmedString = z.preprocess(
  (value) => (value === "" ? null : value),
  z.union([z.string().trim(), z.null()]),
);

export const areasListQuerySchema = z.object({
  status: z.enum(["all", "active", "inactive"]).optional().default("all"),
});

export const createAreaSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: nullableTrimmedString
    .refine((value) => value === null || value.length <= 5000, {
      message: "description must contain at most 5000 characters",
    })
    .optional(),
  isActive: z.boolean().optional().default(true),
});

export const updateAreaSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: nullableTrimmedString
    .refine((value) => value === null || value.length <= 5000, {
      message: "description must contain at most 5000 characters",
    })
    .optional(),
  isActive: z.boolean().optional(),
}).refine((payload) => Object.keys(payload).length > 0, {
  message: "At least one editable field is required",
});

export const updateAreaStatusSchema = z.object({
  isActive: z.boolean(),
});

export const areaIdParamsSchema = z.object({
  areaId: z.coerce.number().int().positive(),
});

export type AreasListQuery = z.infer<typeof areasListQuerySchema>;
export type CreateAreaInput = z.infer<typeof createAreaSchema>;
export type UpdateAreaInput = z.infer<typeof updateAreaSchema>;
export type UpdateAreaStatusInput = z.infer<typeof updateAreaStatusSchema>;
