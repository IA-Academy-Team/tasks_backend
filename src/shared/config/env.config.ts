import dotenv from 'dotenv';
dotenv.config({
  // hace que no muestre logs del env mientras se ejecuta en test
  quiet: process.env.NODE_ENV === "test",
});

// normaliza los valores de las variables de entorno
const normalize = (value: string | undefined, fallback = '') =>
  (value ?? fallback).toString().trim();

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

const detectLocalhost = (value: string) =>
  value.includes("localhost") || value.includes("127.0.0.1");

export const IS_LOCALHOST = detectLocalhost(FRONTEND_URL) || detectLocalhost(DEV_HOST);

// Prefer the actual frontend origin for CORS/websockets in production.
export const FRONTEND_ORIGIN = IS_LOCALHOST ? (FRONTEND_URL || DEV_HOST) : FRONTEND_URL;