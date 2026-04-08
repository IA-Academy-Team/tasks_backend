import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../shared/http/app-error.js";

export const errorHandlerMiddleware = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const appError = error instanceof AppError
    ? error
    : new AppError(500, "INTERNAL_SERVER_ERROR", "Unexpected server error");
  const requestId = res.locals.requestId ?? "unknown";

  if (!(error instanceof AppError)) {
    console.error({
      requestId,
      method: req.method,
      path: req.originalUrl,
      error,
    });
  }

  res.status(appError.statusCode).json({
    error: appError.message,
    code: appError.code,
    details: appError.details ?? null,
    requestId,
    timestamp: new Date().toISOString(),
  });
};
