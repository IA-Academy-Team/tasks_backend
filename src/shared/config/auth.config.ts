import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import bcrypt from "bcrypt";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { sendEmail } from "../utils/mailer.utils.js";
import prisma from "../../../prisma/prisma.client.js";
import {
  BACKEND_URL,
  BETTER_AUTH_BASE_PATH,
  FRONTEND_ORIGINS,
  NODE_ENV,
  PORT,
} from "./env.config.js";

const getOrigin = (value: string): string | null => {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const TRUSTED_ORIGINS = Array.from(
  new Set([
    ...FRONTEND_ORIGINS,
    getOrigin(BACKEND_URL),
    `http://localhost:${PORT}`,
    `http://127.0.0.1:${PORT}`,
  ].filter((origin): origin is string => Boolean(origin))),
);

export const auth = betterAuth({
  appName: "taskapp",
  database: prismaAdapter(prisma, {
    provider: "postgresql",
    usePlural: false,
  }),

  logger: {
    level: NODE_ENV === "production" ? "error" : "debug",
  },

  advanced: {
    database: {
      generateId: "serial",
    },
  },

  baseURL: BACKEND_URL,
  basePath: BETTER_AUTH_BASE_PATH,

  trustedOrigins: TRUSTED_ORIGINS,

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
      const supportReference = token.slice(0, 8).toUpperCase();
      const html = `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Restablece tu contraseña</title>
  </head>
  <body style="margin:0;padding:0;background-color:#0a162b;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Restablece tu contraseña de forma segura desde este enlace.
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#0a162b;">
      <tr>
        <td align="center" style="padding:28px 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background-color:#112445;border:1px solid #244170;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:26px 28px 20px 28px;background-color:#13294f;border-bottom:1px solid #244170;">
                <p style="margin:0 0 8px 0;font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:12px;line-height:16px;letter-spacing:0.12em;text-transform:uppercase;color:#62d6ff;font-weight:700;">
                  Tasks
                </p>
                <h1 style="margin:0;font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:28px;line-height:34px;color:#f4f8ff;font-weight:800;">
                  Restablece tu contraseña
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 10px 28px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#dbe7ff;">
                <p style="margin:0 0 14px 0;font-size:16px;line-height:24px;">
                  Hola${user.name ? ` ${user.name}` : ""},
                </p>
                <p style="margin:0 0 16px 0;font-size:15px;line-height:23px;color:#c4d7fb;">
                  Recibimos una solicitud para cambiar tu contraseña. Para continuar, usa el botón de abajo.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 18px 0;">
                  <tr>
                    <td align="center" bgcolor="#1fd2bf" style="border-radius:10px;">
                      <a
                        href="${url}"
                        style="display:inline-block;padding:13px 24px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:15px;line-height:20px;font-weight:700;color:#072338;text-decoration:none;"
                      >
                        Restablecer contraseña
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px 0;font-size:13px;line-height:20px;color:#9fb8e6;">
                  Si el botón no funciona, copia y pega este enlace en tu navegador:
                </p>
                <p style="margin:0 0 12px 0;font-size:13px;line-height:20px;word-break:break-all;">
                  <a href="${url}" style="color:#62d6ff;text-decoration:underline;">${url}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px 24px 28px;background-color:#0f1f3c;border-top:1px solid #244170;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
                <p style="margin:0 0 8px 0;font-size:13px;line-height:20px;color:#9fb8e6;">
                  Si no solicitaste este cambio, puedes ignorar este mensaje.
                </p>
                <p style="margin:0 0 12px 0;font-size:13px;line-height:20px;color:#9fb8e6;">
                  Este enlace es temporal y se invalida automáticamente por seguridad.
                </p>
                <p style="margin:0;font-size:11px;line-height:16px;letter-spacing:0.06em;text-transform:uppercase;color:#6f8fc5;">
                  Referencia: ${supportReference}
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:14px 0 0 0;font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:11px;line-height:16px;color:#6f8fc5;">
            Tasks · Plataforma de gestión operativa
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
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
        async before(user) {
          return { data: user };
        },
      },
    },
  },
});
