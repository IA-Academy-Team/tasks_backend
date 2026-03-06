import { Router } from "express";
import { z } from "zod";
import { AppError } from "../../shared/http/app-error.js";
import {
  requireAuth,
  requireRole,
  type AuthenticatedRequest,
} from "../auth/auth.middleware.js";
import {
  adminDashboardQuerySchema,
  overdueAlertsQuerySchema,
  taskComplianceReportQuerySchema,
} from "./analytics.schemas.js";
import {
  getAdminDashboard,
  getEmployeeDashboard,
  getOverdueAlerts,
  getTaskComplianceReport,
} from "./analytics.service.js";

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth);

analyticsRouter.get("/dashboard/employee", requireRole("employee"), async (req, res, next) => {
  try {
    const authenticatedRequest = req as unknown as AuthenticatedRequest;
    const dashboard = await getEmployeeDashboard(authenticatedRequest.auth.user.id);

    res.status(200).json({ data: dashboard });
  } catch (error) {
    next(error);
  }
});

analyticsRouter.get("/dashboard/admin", requireRole("admin"), async (req, res, next) => {
  try {
    const query = adminDashboardQuerySchema.parse(req.query);
    const dashboard = await getAdminDashboard(query);

    res.status(200).json({ data: dashboard });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid admin dashboard query", error.flatten()));
      return;
    }

    next(error);
  }
});

analyticsRouter.get("/reports/compliance", requireRole("admin"), async (req, res, next) => {
  try {
    const query = taskComplianceReportQuerySchema.parse(req.query);
    const report = await getTaskComplianceReport(query);

    res.status(200).json({ data: report });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid compliance report query", error.flatten()));
      return;
    }

    next(error);
  }
});

analyticsRouter.get("/alerts/overdue", requireRole("admin"), async (req, res, next) => {
  try {
    const query = overdueAlertsQuerySchema.parse(req.query);
    const alerts = await getOverdueAlerts(query);

    res.status(200).json({ data: alerts });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid overdue alerts query", error.flatten()));
      return;
    }

    next(error);
  }
});
