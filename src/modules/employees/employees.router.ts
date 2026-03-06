import { Router } from "express";
import { z } from "zod";
import { AppError } from "../../shared/http/app-error.js";
import {
  requireAuth,
  requireRole,
  type AuthenticatedRequest,
} from "../auth/auth.middleware.js";
import {
  createEmployeeSchema,
  employeeIdParamsSchema,
  employeesListQuerySchema,
  updateEmployeeSchema,
  updateEmployeeStatusSchema,
} from "./employees.schemas.js";
import {
  createEmployee,
  getEmployeeById,
  listEmployees,
  updateEmployee,
  updateEmployeeStatus,
} from "./employees.service.js";

export const employeesRouter = Router();

employeesRouter.use(requireAuth, requireRole("admin"));

employeesRouter.get("/", async (req, res, next) => {
  try {
    const query = employeesListQuerySchema.parse(req.query);
    const employees = await listEmployees(query);

    res.status(200).json({ data: employees });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid employees query", error.flatten()));
      return;
    }

    next(error);
  }
});

employeesRouter.get("/:employeeId", async (req, res, next) => {
  try {
    const { employeeId } = employeeIdParamsSchema.parse(req.params);
    const employee = await getEmployeeById(employeeId);

    res.status(200).json({ data: employee });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid employee identifier", error.flatten()));
      return;
    }

    next(error);
  }
});

employeesRouter.post("/", async (req, res, next) => {
  try {
    const payload = createEmployeeSchema.parse(req.body);
    const employee = await createEmployee(payload);

    res.status(201).json({ data: employee });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid employee payload", error.flatten()));
      return;
    }

    next(error);
  }
});

employeesRouter.patch("/:employeeId", async (req, res, next) => {
  try {
    const { employeeId } = employeeIdParamsSchema.parse(req.params);
    const payload = updateEmployeeSchema.parse(req.body);
    const employee = await updateEmployee(employeeId, payload);

    res.status(200).json({ data: employee });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid employee payload", error.flatten()));
      return;
    }

    next(error);
  }
});

employeesRouter.patch("/:employeeId/status", async (req, res, next) => {
  try {
    const { employeeId } = employeeIdParamsSchema.parse(req.params);
    const payload = updateEmployeeStatusSchema.parse(req.body);
    const authenticatedRequest = req as unknown as AuthenticatedRequest;
    const actorUserId = authenticatedRequest.auth.user.id;
    const employee = await updateEmployeeStatus(employeeId, payload.isActive, actorUserId);

    res.status(200).json({ data: employee });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid employee status payload", error.flatten()));
      return;
    }

    next(error);
  }
});
