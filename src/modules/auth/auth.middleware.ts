import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../shared/http/app-error.js";
import type { CurrentAuthSession } from "./auth.service.js";
import { getCurrentAuthSession } from "./auth.service.js";
import type { AuthRole } from "./auth.policies.js";

export interface AuthenticatedRequest extends Request {
  auth: CurrentAuthSession;
}

export const requireAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const currentSession = await getCurrentAuthSession(req.headers);

    if (!currentSession) {
      next(new AppError(401, "UNAUTHORIZED", "Authentication required"));
      return;
    }

    (req as AuthenticatedRequest).auth = currentSession;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireRole = (...allowedRoles: AuthRole[]) => (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const authenticatedRequest = req as Partial<AuthenticatedRequest>;
  const role = authenticatedRequest.auth?.user.role;

  if (!role) {
    next(new AppError(401, "UNAUTHORIZED", "Authentication required"));
    return;
  }

  if (!allowedRoles.includes(role)) {
    next(new AppError(403, "FORBIDDEN", "Insufficient role permissions"));
    return;
  }

  next();
};
