import nodemailer from "nodemailer";

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

let cachedTransporter: nodemailer.Transporter | null = null;

const getTransporter = () => {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // 587 => secure false (STARTTLS). 465 => secure true (TLS).
  const secure = process.env.SMTP_SECURE === "true";

  if (!host || !user || !pass) return null;

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    // Recomendado en 587:
    requireTLS: port === 587,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  return cachedTransporter;
};

export const verifyEmailTransport = async () => {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("[Mail] SMTP no configurado (faltan env vars).");
    return false;
  }
  try {
    await transporter.verify();
    console.log("[Mail] SMTP verify OK");
    return true;
  } catch (err) {
    console.error("[Mail] SMTP verify FAILED", err);
    return false;
  }
};

export const sendEmail = async ({ to, subject, text, html }: EmailPayload) => {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  const transporter = getTransporter();

  if (!from || !transporter) {
    const msg = "[Mail] SMTP no configurado. Email omitido.";
    console.warn(msg, { to, subject });

    // En desarrollo te sirve ver el contenido:
    if (process.env.NODE_ENV !== "production") {
      console.info("[Mail] Contenido:", { to, subject, text });
    }
    return;
  }

  await transporter.sendMail({ from, to, subject, text, html });
};
