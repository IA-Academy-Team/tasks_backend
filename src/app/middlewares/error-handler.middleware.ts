import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../shared/http/app-error.js";

export const errorHandlerMiddleware = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const appError = error instanceof AppError
    ? error
    : new AppError(500, "INTERNAL_SERVER_ERROR", "Unexpected server error");

  if (!(error instanceof AppError)) {
    console.error(error);
  }

  res.status(appError.statusCode).json({
    error: appError.message,
    code: appError.code,
    details: appError.details ?? null,
  });
};
