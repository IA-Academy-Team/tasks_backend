import type { IncomingHttpHeaders } from "node:http";
import { fromNodeHeaders } from "better-auth/node";
import prisma from "../../../prisma/prisma.client.js";
import { auth } from "../../shared/config/auth.config.js";

export interface CurrentAuthSession {
  session: {
    id: number;
    expiresAt: string;
    ipAddress: string | null;
    userAgent: string | null;
  };
  user: {
    id: number;
    name: string;
    email: string;
    role: "admin" | "employee" | "leader";
    roleId: number;
    isActive: boolean;
    emailVerified: boolean;
    phoneNumber: string | null;
    image: string | null;
  };
}

const toNumericId = (value: unknown) => {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isInteger(parsed)) {
      return parsed;
    }
  }

  return null;
};

const normalizeRoleName = (roleName: string): "admin" | "employee" | "leader" => {
  if (roleName === "admin" || roleName === "leader") {
    return roleName;
  }

  return "employee";
};

export const getCurrentAuthSession = async (
  headers: IncomingHttpHeaders,
): Promise<CurrentAuthSession | null> => {
  const currentSession = await auth.api.getSession({
    headers: fromNodeHeaders(headers),
  });

  if (!currentSession) {
    return null;
  }

  const userId = toNumericId(currentSession.user.id);
  const sessionId = toNumericId(currentSession.session.id);

  if (!userId || !sessionId) {
    return null;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });

  if (!dbUser) {
    return null;
  }

  return {
    session: {
      id: sessionId,
      expiresAt: currentSession.session.expiresAt.toISOString(),
      ipAddress: currentSession.session.ipAddress ?? null,
      userAgent: currentSession.session.userAgent ?? null,
    },
    user: {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: normalizeRoleName(dbUser.role.name),
      roleId: dbUser.roleId,
      isActive: dbUser.isActive,
      emailVerified: dbUser.emailVerified,
      phoneNumber: dbUser.phoneNumber ?? null,
      image: dbUser.image ?? null,
    },
  };
};
