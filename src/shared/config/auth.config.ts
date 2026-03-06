import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { bearer } from "better-auth/plugins";
import bcrypt from "bcrypt";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { sendEmail } from "../utils/mailer.utils.js";
import prisma from "../../../prisma/prisma.client.js";

const ALLOWED_EMAIL_DOMAINS = new Set([
  "campuslands.com",
  "fundacioncampuslands.com",
]);

const DOMAIN_ERROR_CODE = "EMAIL_DOMAIN_NOT_ALLOWED";

const isAllowedEmail = (email?: string | null) => {
  if (!email) return false;
  const domain = email.split("@").pop()?.toLowerCase();
  return Boolean(domain && ALLOWED_EMAIL_DOMAINS.has(domain));
};

export const auth = betterAuth({
  appName: "taskapp",
  database: prismaAdapter(prisma, {
    provider: "postgresql",
    usePlural: true,
  }),

  logger: {
    level: "debug",
  },

  advanced: {
    database: {
      generateId: "serial",
    },
  },

  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3004",
  basePath: "/auth/handler",

  trustedOrigins: [
    process.env.FRONTEND_URL || "http://localhost:5173",
    "http://127.0.0.1:5173",
  ],

  user: {
    modelName: "User",
    fields: {
      emailVerified: "emailVerified",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
    additionalFields: {
      phoneNumber: {
        type: "string",
        fieldName: "phoneNumber",
        required: false,
      },
      roleId: {
        type: "number",
        fieldName: "roleId",
        required: false,
        defaultValue: 1,
      },
      isActive: {
        type: "boolean",
        fieldName: "isActive",
        required: false,
        returned: false,
      },
    },
  },

  account: {
    modelName: "Account",
    fields: {
      providerId: "providerId",
      accountId: "providerAccountId",
      userId: "userId",
      accessToken: "accessToken",
      refreshToken: "refreshToken",
      idToken: "idToken",
      accessTokenExpiresAt: "accessTokenExpiresAt",
      refreshTokenExpiresAt: "refreshTokenExpiresAt",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
      allowDifferentEmails: false,
      updateUserInfoOnLink: true,
    },
  },

  session: {
    modelName: "Session",
    fields: {
      userId: "userId",
      expiresAt: "expiresAt",
      ipAddress: "ipAddress",
      userAgent: "userAgent",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
  },

  verification: {
    modelName: "Verification",
    fields: {
      value: "value",
      identifier: "identifier",
      expiresAt: "expiresAt",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
  },

  emailAndPassword: {
    enabled: true,
    password: {
      hash: async (password) => bcrypt.hash(password, 10),
      verify: async ({ hash, password }) => bcrypt.compare(password, hash),
    },
    sendResetPassword: async ({ user, url, token }) => {
      const subject = "Restablece tu contraseña";
      const text = `Hola${user.name ? ` ${user.name}` : ""},\n\nUsa este enlace para restablecer tu contraseña:\n${url}\n\nSi no solicitaste este cambio, puedes ignorar este mensaje.`;
      const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h2 style="color:#0ea5e9;">Restablece tu contraseña</h2>
          <p>Hola${user.name ? ` ${user.name}` : ""},</p>
          <p>Recibimos una solicitud para restablecer tu contraseña.</p>
          <p>
            <a href="${url}" style="color:#0ea5e9; font-weight:bold;">Haz clic aqui para continuar</a>
          </p>
          <p style="color:#6b7280;">Si no solicitaste este cambio, puedes ignorar este mensaje.</p>
          <p style="color:#9ca3af; font-size:12px;">Token: ${token}</p>
        </div>
      `;
      console.info('[Auth] reset-password:send', { email: user.email, url });
      if (process.env.NODE_ENV === "production") {
        void sendEmail({ to: user.email, subject, text, html });
      } else {
        await sendEmail({ to: user.email, subject, text, html });
      }    
    },
    onPasswordReset: async ({ user }) => {
      console.info('[Auth] reset-password:done', { email: user.email });
    },
  },

  socialProviders: {},

  plugins: [bearer()],

  databaseHooks: {
    user: {
      create: {
        async before(user, ctx) {
          const email = typeof user.email === "string" ? user.email : "";
          if (isAllowedEmail(email)) {
            return { data: user };
          }

          throw new APIError("FORBIDDEN", {
            message: DOMAIN_ERROR_CODE,
            code: DOMAIN_ERROR_CODE,
          });
        },
      },
    },
    session: {
      create: {
        async before(session, ctx) {
          if (!ctx) return;
          const user = await ctx.context.internalAdapter.findUserById(
            session.userId
          );
          if (!user || isAllowedEmail(user.email)) return;

          throw new APIError("FORBIDDEN", {
            message: DOMAIN_ERROR_CODE,
            code: DOMAIN_ERROR_CODE,
          });
        },
      },
    },
  },
});
