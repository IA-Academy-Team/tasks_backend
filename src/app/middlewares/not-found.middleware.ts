import type { Request, Response } from "express";

export const notFoundMiddleware = (req: Request, res: Response) => {
  res.status(404).json({
    error: "Resource not found",
    code: "NOT_FOUND",
    details: {
      method: req.method,
      path: req.originalUrl,
    },
  });
};
