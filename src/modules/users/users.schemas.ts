import { z } from "zod";

const nullableTrimmedString = z.preprocess(
  (value) => (value === "" ? null : value),
  z.union([z.string().trim(), z.null()]),
);

export const updateMyProfileSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  phoneNumber: nullableTrimmedString
    .refine((value) => value === null || value.length <= 30, {
      message: "phoneNumber must contain at most 30 characters",
    })
    .optional(),
  image: nullableTrimmedString
    .refine((value) => value === null || /^https?:\/\//i.test(value), {
      message: "image must be a valid http/https url",
    })
    .refine((value) => value === null || value.length <= 2000, {
      message: "image must contain at most 2000 characters",
    })
    .optional(),
}).refine((payload) => Object.keys(payload).length > 0, {
  message: "At least one editable field is required",
});

export type UpdateMyProfileInput = z.infer<typeof updateMyProfileSchema>;

