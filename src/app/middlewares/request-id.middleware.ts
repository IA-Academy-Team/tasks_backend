import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const REQUEST_ID_HEADER = "x-request-id";

declare global {
  namespace Express {
    interface Locals {
      requestId?: string;
    }
  }
}

export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const incomingRequestId = req.headers[REQUEST_ID_HEADER];
  const normalizedHeader = Array.isArray(incomingRequestId)
    ? incomingRequestId[0]
    : incomingRequestId;

  const requestId = (typeof normalizedHeader === "string" && normalizedHeader.trim())
    ? normalizedHeader.trim()
    : randomUUID();

  res.locals.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
};

