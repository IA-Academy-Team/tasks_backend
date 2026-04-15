import { z } from "zod";

const nullableTrimmedString = z.preprocess(
  (value) => (value === "" ? null : value),
  z.union([z.string().trim(), z.null()]),
);

const isHttpUrl = (value: string) => /^https?:\/\//i.test(value);
const isBase64ImageDataUrl = (value: string) =>
  /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\r\n]+$/i.test(value);
const isSupportedImageValue = (value: string) => isHttpUrl(value) || isBase64ImageDataUrl(value);
const imageLengthIsValid = (value: string) => {
  if (isHttpUrl(value)) {
    return value.length <= 2000;
  }

  if (isBase64ImageDataUrl(value)) {
    return value.length <= 120_000;
  }

  return false;
};

export const updateMyProfileSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  phoneNumber: nullableTrimmedString
    .refine((value) => value === null || value.length <= 30, {
      message: "phoneNumber must contain at most 30 characters",
    })
    .optional(),
  image: nullableTrimmedString
    .refine((value) => value === null || isSupportedImageValue(value), {
      message: "image must be a valid http/https url or data:image/...;base64 value",
    })
    .refine((value) => value === null || imageLengthIsValid(value), {
      message: "image is too long",
    })
    .optional(),
}).refine((payload) => Object.keys(payload).length > 0, {
  message: "At least one editable field is required",
});

export type UpdateMyProfileInput = z.infer<typeof updateMyProfileSchema>;
