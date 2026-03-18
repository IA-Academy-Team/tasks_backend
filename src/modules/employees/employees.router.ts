import { Router } from "express";
import { z } from "zod";
import { AppError } from "../../shared/http/app-error.js";
import {
  requireAuth,
  requireRole,
  type AuthenticatedRequest,
} from "../auth/auth.middleware.js";
import {
  assignEmployeeAreaSchema,
  employeeAssignmentsListQuerySchema,
  createEmployeeSchema,
  employeeIdParamsSchema,
  employeesListQuerySchema,
  unassignEmployeeAreaSchema,
  updateEmployeeSchema,
  updateEmployeeStatusSchema,
} from "./employees.schemas.js";
import {
  createEmployee,
  deleteEmployee,
  getEmployeeById,
  listEmployeeAreaAssignments,
  listEmployeeProjectMemberships,
  listEmployees,
  assignEmployeeToArea,
  unassignEmployeeFromArea,
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

employeesRouter.delete("/:employeeId", async (req, res, next) => {
  try {
    const { employeeId } = employeeIdParamsSchema.parse(req.params);
    const authenticatedRequest = req as unknown as AuthenticatedRequest;
    const actorUserId = authenticatedRequest.auth.user.id;
    const result = await deleteEmployee(employeeId, actorUserId);

    res.status(200).json({ data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid employee identifier", error.flatten()));
      return;
    }

    next(error);
  }
});

employeesRouter.get("/:employeeId/area-assignments", async (req, res, next) => {
  try {
    const { employeeId } = employeeIdParamsSchema.parse(req.params);
    const query = employeeAssignmentsListQuerySchema.parse(req.query);
    const assignments = await listEmployeeAreaAssignments(employeeId, query);

    res.status(200).json({ data: assignments });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(
        400,
        "VALIDATION_ERROR",
        "Invalid employee area assignments query",
        error.flatten(),
      ));
      return;
    }

    next(error);
  }
});

employeesRouter.post("/:employeeId/area-assignments", async (req, res, next) => {
  try {
    const { employeeId } = employeeIdParamsSchema.parse(req.params);
    const payload = assignEmployeeAreaSchema.parse(req.body);
    const authenticatedRequest = req as unknown as AuthenticatedRequest;
    const actorUserId = authenticatedRequest.auth.user.id;
    const assignment = await assignEmployeeToArea(employeeId, payload.areaId, actorUserId);

    res.status(201).json({ data: assignment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(
        400,
        "VALIDATION_ERROR",
        "Invalid employee area assignment payload",
        error.flatten(),
      ));
      return;
    }

    next(error);
  }
});

employeesRouter.patch("/:employeeId/area-assignments/unassign", async (req, res, next) => {
  try {
    const { employeeId } = employeeIdParamsSchema.parse(req.params);
    const payload = unassignEmployeeAreaSchema.parse(req.body ?? {});
    const authenticatedRequest = req as unknown as AuthenticatedRequest;
    const actorUserId = authenticatedRequest.auth.user.id;
    const assignment = await unassignEmployeeFromArea(employeeId, actorUserId, payload.areaId);

    res.status(200).json({ data: assignment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(
        400,
        "VALIDATION_ERROR",
        "Invalid employee area unassignment payload",
        error.flatten(),
      ));
      return;
    }

    next(error);
  }
});

employeesRouter.get("/:employeeId/project-memberships", async (req, res, next) => {
  try {
    const { employeeId } = employeeIdParamsSchema.parse(req.params);
    const query = employeeAssignmentsListQuerySchema.parse(req.query);
    const memberships = await listEmployeeProjectMemberships(employeeId, query);

    res.status(200).json({ data: memberships });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(
        400,
        "VALIDATION_ERROR",
        "Invalid employee project memberships query",
        error.flatten(),
      ));
      return;
    }

    next(error);
  }
});
