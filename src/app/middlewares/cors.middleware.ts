import type { NextFunction, Request, Response } from "express";
import { FRONTEND_ORIGIN } from "../../shared/config/env.config.js";

const CORS_HEADERS = [
  "Content-Type",
  "Authorization",
  "X-Requested-With",
];

const CORS_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

export const corsMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const requestOrigin = req.headers.origin;
  const allowOrigin = requestOrigin && requestOrigin === FRONTEND_ORIGIN
    ? requestOrigin
    : FRONTEND_ORIGIN;

  res.header("Access-Control-Allow-Origin", allowOrigin);
  res.header("Vary", "Origin");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Headers", CORS_HEADERS.join(", "));
  res.header("Access-Control-Allow-Methods", CORS_METHODS.join(", "));

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
};
