import type { NextFunction, Request, Response } from "express";
import { NODE_ENV } from "../../shared/config/env.config.js";

const isHttpsRequest = (req: Request): boolean => {
  if (req.secure) {
    return true;
  }

  const forwardedProtoHeader = req.headers["x-forwarded-proto"];
  const forwardedProto = Array.isArray(forwardedProtoHeader)
    ? forwardedProtoHeader[0]
    : forwardedProtoHeader;

  return typeof forwardedProto === "string" && forwardedProto.toLowerCase() === "https";
};

export const securityHeadersMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("X-Download-Options", "noopen");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  if (NODE_ENV === "production" && isHttpsRequest(req)) {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }

  next();
};
