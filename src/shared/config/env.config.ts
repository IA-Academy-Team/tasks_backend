import dotenv from 'dotenv';
dotenv.config({
  // hace que no muestre logs del env mientras se ejecuta en test
  quiet: process.env.NODE_ENV === "test",
});

// normaliza los valores de las variables de entorno
const normalize = (value: string | undefined, fallback = '') =>
  (value ?? fallback).toString().trim();
const toPositiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(normalize(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

// base de datos
export const DB_HOST = normalize(process.env.DB_HOST, 'localhost');
export const DB_PORT = Number(normalize(process.env.DB_PORT, '5432'));
export const DB_NAME = normalize(process.env.DB_NAME, 'viaticapp_dev');
export const DB_USER = normalize(process.env.DB_USER, 'root');
export const DB_PASSWORD = normalize(process.env.DB_PASSWORD, '');

// prisma
// convierte todo a utf-8 y escapa caracteres especiales
const DB_PASSWORD_ENCODED = encodeURIComponent(DB_PASSWORD);
export const DATABASE_URL = normalize(
  process.env.DATABASE_URL,
  `postgresql://${DB_USER}:${DB_PASSWORD_ENCODED}@${DB_HOST}:${DB_PORT}/${DB_NAME}`
);

// recuperar constraseña
export const SMTP_HOST = normalize(process.env.SMTP_HOST, 'smtp.mailtrap.io');
export const SMTP_PORT = Number(normalize(process.env.SMTP_PORT, '2525'));
export const SMTP_SECURE = normalize(process.env.SMTP_SECURE, 'false') === 'true';
export const SMTP_USER = normalize(process.env.SMTP_USER);
export const SMTP_PASS = normalize(process.env.SMTP_PASS);
export const MAIL_FROM = normalize(process.env.MAIL_FROM);

// CORS y puerto
export const FRONTEND_URL = normalize(process.env.FRONTEND_URL, 'http://localhost:5173');
export const PORT = Number(normalize(process.env.PORT, '3000'));
export const PROD_HOST = normalize(process.env.PROD_HOST, 'https://sdfsfasdfjls.com.co');
export const DEV_HOST = normalize(process.env.DEV_HOST, 'http://localhost:13131313');
export const NODE_ENV = normalize(process.env.NODE_ENV, 'development');
export const API_PREFIX = normalize(process.env.API_PREFIX, '/api');
export const BACKEND_URL = normalize(
  process.env.BACKEND_URL || process.env.BETTER_AUTH_URL,
  `http://localhost:${PORT}`
);
export const BETTER_AUTH_BASE_PATH = normalize(
  process.env.BETTER_AUTH_BASE_PATH,
  `${API_PREFIX}/auth/handler`
);

const FRONTEND_ORIGIN_CANDIDATES = NODE_ENV === "production"
  ? [FRONTEND_URL, DEV_HOST, "http://127.0.0.1:5173"]
  : [DEV_HOST, FRONTEND_URL, "http://127.0.0.1:5173"];

export const FRONTEND_ORIGINS = Array.from(
  new Set(
    FRONTEND_ORIGIN_CANDIDATES
      .map((origin) => normalize(origin))
      .filter(Boolean),
  ),
);

export const FRONTEND_ORIGIN = FRONTEND_ORIGINS[0] ?? FRONTEND_URL;

// seguridad base (rate limit)
export const RATE_LIMIT_ENABLED = normalize(process.env.RATE_LIMIT_ENABLED, "true") !== "false";
export const RATE_LIMIT_WINDOW_MS = toPositiveInteger(process.env.RATE_LIMIT_WINDOW_MS, 60_000);
export const RATE_LIMIT_MAX = toPositiveInteger(process.env.RATE_LIMIT_MAX, 180);
export const RATE_LIMIT_AUTH_WINDOW_MS = toPositiveInteger(process.env.RATE_LIMIT_AUTH_WINDOW_MS, 60_000);
export const RATE_LIMIT_AUTH_MAX = toPositiveInteger(process.env.RATE_LIMIT_AUTH_MAX, 20);
