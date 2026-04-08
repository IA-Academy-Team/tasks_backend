import { Router } from "express";
import {
  BACKEND_URL,
  BETTER_AUTH_BASE_PATH,
} from "../../shared/config/env.config.js";
import { authHandlerMiddleware } from "./auth.handler.js";
import { requireAuth, requireRole, type AuthenticatedRequest } from "./auth.middleware.js";
import { canAccessResource, getAllowedResourcesByRole } from "./auth.policies.js";
import { getCurrentAuthSession } from "./auth.service.js";

export const authRouter = Router();

authRouter.get("/status", (_req, res) => {
  res.status(200).json({
    module: "auth",
    status: "ready",
    handlerPath: BETTER_AUTH_BASE_PATH,
    baseUrl: BACKEND_URL,
  });
});

authRouter.get("/session", async (req, res, next) => {
  try {
    const currentSession = await getCurrentAuthSession(req.headers);

    res.status(200).json({
      authenticated: Boolean(currentSession),
      data: currentSession,
    });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/access/me", requireAuth, (req, res) => {
  const authenticatedRequest = req as AuthenticatedRequest;
  const userRole = authenticatedRequest.auth.user.role;

  res.status(200).json({
    user: authenticatedRequest.auth.user,
    allowedResources: getAllowedResourcesByRole(userRole),
  });
});

authRouter.get(
  "/access/admin",
  requireAuth,
  requireRole("admin"),
  (req, res) => {
    const authenticatedRequest = req as AuthenticatedRequest;
    const userRole = authenticatedRequest.auth.user.role;

    res.status(200).json({
      access: "granted",
      resource: "members",
      canAccess: canAccessResource(userRole, "members"),
      user: authenticatedRequest.auth.user,
    });
  },
);

authRouter.get(
  "/access/employee",
  requireAuth,
  requireRole("employee", "admin"),
  (req, res) => {
    const authenticatedRequest = req as AuthenticatedRequest;
    const userRole = authenticatedRequest.auth.user.role;

    res.status(200).json({
      access: "granted",
      resource: "projects",
      canAccess: canAccessResource(userRole, "projects"),
      user: authenticatedRequest.auth.user,
    });
  },
);

authRouter.use(authHandlerMiddleware);
