import type { NextFunction, Request, Response } from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "../../shared/config/auth.config.js";

const nodeHandler = toNodeHandler(auth);

export const authHandlerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  void nodeHandler(req, res).catch(next);
};
