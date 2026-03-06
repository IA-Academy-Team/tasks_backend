import type { NextFunction, Request, Response } from "express";

export const requestLoggerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const startedAt = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    console.info(JSON.stringify({
      type: "http_request",
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
    }));
  });

  next();
};
