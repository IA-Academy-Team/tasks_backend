import prisma from "../../../prisma/prisma.client.js";
import { AppError } from "../../shared/http/app-error.js";
import type { AuthRole } from "../auth/auth.policies.js";
import type { UpdateMyProfileInput } from "./users.schemas.js";

export interface UserProfileDto {
  id: number;
  name: string;
  email: string;
  role: AuthRole;
  roleId: number;
  isActive: boolean;
  emailVerified: boolean;
  phoneNumber: string | null;
  image: string | null;
  createdAt: string;
  updatedAt: string;
}

const normalizeRoleName = (roleName: string): AuthRole =>
  roleName === "admin" ? "admin" : "employee";

const toUserProfileDto = (user: {
  id: number;
  name: string;
  email: string;
  roleId: number;
  isActive: boolean;
  emailVerified: boolean;
  phoneNumber: string | null;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
  role: { name: string };
}): UserProfileDto => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: normalizeRoleName(user.role.name),
  roleId: user.roleId,
  isActive: user.isActive,
  emailVerified: user.emailVerified,
  phoneNumber: user.phoneNumber,
  image: user.image,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
});

export const getCurrentUserProfile = async (
  userId: number,
): Promise<UserProfileDto> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });

  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "Authenticated user not found");
  }

  return toUserProfileDto(user);
};

export const updateCurrentUserProfile = async (
  userId: number,
  payload: UpdateMyProfileInput,
): Promise<UserProfileDto> => {
  const data: {
    name?: string;
    phoneNumber?: string | null;
    image?: string | null;
  } = {};

  if (payload.name !== undefined) {
    data.name = payload.name;
  }

  if (payload.phoneNumber !== undefined) {
    data.phoneNumber = payload.phoneNumber;
  }

  if (payload.image !== undefined) {
    data.image = payload.image;
  }

  await prisma.user.update({
    where: { id: userId },
    data,
  }).catch((error) => {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      throw new AppError(404, "USER_NOT_FOUND", "Authenticated user not found");
    }

    throw error;
  });

  return getCurrentUserProfile(userId);
};
