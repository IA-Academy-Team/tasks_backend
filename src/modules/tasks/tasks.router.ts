import { Router } from "express";
import { z } from "zod";
import { AppError } from "../../shared/http/app-error.js";
import {
  requireAuth,
  requireRole,
  type AuthenticatedRequest,
} from "../auth/auth.middleware.js";
import {
  createStandaloneTaskSchema,
  createTaskSchema,
  standaloneTasksListQuerySchema,
  taskIdParamsSchema,
  tasksListQuerySchema,
  transitionTaskStatusSchema,
  updateTaskSchema,
} from "./tasks.schemas.js";
import {
  createStandaloneTask,
  createTask,
  deleteTask,
  getTaskById,
  getTaskHistory,
  listStandaloneTasks,
  listTasks,
  transitionTaskStatus,
  updateTask,
} from "./tasks.service.js";

export const tasksRouter = Router();

tasksRouter.use(requireAuth);

tasksRouter.get("/", async (req, res, next) => {
  try {
    const query = tasksListQuerySchema.parse(req.query);
    const authenticatedRequest = req as unknown as AuthenticatedRequest;
    const tasks = await listTasks(query, {
      userId: authenticatedRequest.auth.user.id,
      role: authenticatedRequest.auth.user.role,
    });

    res.status(200).json({ data: tasks });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid tasks query", error.flatten()));
      return;
    }

    next(error);
  }
});

tasksRouter.get("/standalone", async (req, res, next) => {
  try {
    const query = standaloneTasksListQuerySchema.parse(req.query);
    const authenticatedRequest = req as unknown as AuthenticatedRequest;
    const tasks = await listStandaloneTasks(query, {
      userId: authenticatedRequest.auth.user.id,
      role: authenticatedRequest.auth.user.role,
    });

    res.status(200).json({ data: tasks });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid standalone tasks query", error.flatten()));
      return;
    }

    next(error);
  }
});

tasksRouter.get("/:taskId", async (req, res, next) => {
  try {
    const { taskId } = taskIdParamsSchema.parse(req.params);
    const task = await getTaskById(taskId);

    res.status(200).json({ data: task });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid task identifier", error.flatten()));
      return;
    }

    next(error);
  }
});

tasksRouter.get("/:taskId/history", async (req, res, next) => {
  try {
    const { taskId } = taskIdParamsSchema.parse(req.params);
    const history = await getTaskHistory(taskId);

    res.status(200).json({ data: history });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid task identifier", error.flatten()));
      return;
    }

    next(error);
  }
});

tasksRouter.post("/", requireRole("admin", "leader", "employee"), async (req, res, next) => {
  try {
    const payload = createTaskSchema.parse(req.body);
    const authenticatedRequest = req as unknown as AuthenticatedRequest;
    const result = await createTask(payload, {
      userId: authenticatedRequest.auth.user.id,
      role: authenticatedRequest.auth.user.role,
    });

    res.status(201).json({ data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid task payload", error.flatten()));
      return;
    }

    next(error);
  }
});

tasksRouter.post("/standalone", async (req, res, next) => {
  try {
    const payload = createStandaloneTaskSchema.parse(req.body);
    const authenticatedRequest = req as unknown as AuthenticatedRequest;
    const result = await createStandaloneTask(payload, {
      userId: authenticatedRequest.auth.user.id,
      role: authenticatedRequest.auth.user.role,
    });

    res.status(201).json({ data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid standalone task payload", error.flatten()));
      return;
    }

    next(error);
  }
});

tasksRouter.patch("/:taskId", async (req, res, next) => {
  try {
    const { taskId } = taskIdParamsSchema.parse(req.params);
    const payload = updateTaskSchema.parse(req.body);
    const authenticatedRequest = req as unknown as AuthenticatedRequest;
    const task = await updateTask(taskId, payload, {
      userId: authenticatedRequest.auth.user.id,
      role: authenticatedRequest.auth.user.role,
    });

    res.status(200).json({ data: task });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid task payload", error.flatten()));
      return;
    }

    next(error);
  }
});

tasksRouter.patch("/:taskId/status", async (req, res, next) => {
  try {
    const { taskId } = taskIdParamsSchema.parse(req.params);
    const payload = transitionTaskStatusSchema.parse(req.body);
    const authenticatedRequest = req as unknown as AuthenticatedRequest;
    const result = await transitionTaskStatus(taskId, payload, {
      userId: authenticatedRequest.auth.user.id,
      role: authenticatedRequest.auth.user.role,
    });

    res.status(200).json({ data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid task status payload", error.flatten()));
      return;
    }

    next(error);
  }
});

tasksRouter.delete("/:taskId", requireRole("admin", "leader"), async (req, res, next) => {
  try {
    const { taskId } = taskIdParamsSchema.parse(req.params);
    const authenticatedRequest = req as unknown as AuthenticatedRequest;
    const result = await deleteTask(taskId, {
      userId: authenticatedRequest.auth.user.id,
      role: authenticatedRequest.auth.user.role,
    });

    res.status(200).json({ data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid task identifier", error.flatten()));
      return;
    }

    next(error);
  }
});
