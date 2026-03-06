import { Router } from "express";
import { z } from "zod";
import { AppError } from "../../shared/http/app-error.js";
import {
  requireAuth,
  requireRole,
  type AuthenticatedRequest,
} from "../auth/auth.middleware.js";
import {
  createTaskSchema,
  taskIdParamsSchema,
  tasksListQuerySchema,
  updateTaskSchema,
} from "./tasks.schemas.js";
import {
  createTask,
  deleteTask,
  getTaskById,
  listTasks,
  updateTask,
} from "./tasks.service.js";

export const tasksRouter = Router();

tasksRouter.use(requireAuth);

tasksRouter.get("/", async (req, res, next) => {
  try {
    const query = tasksListQuerySchema.parse(req.query);
    const tasks = await listTasks(query);

    res.status(200).json({ data: tasks });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid tasks query", error.flatten()));
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

tasksRouter.post("/", requireRole("admin"), async (req, res, next) => {
  try {
    const payload = createTaskSchema.parse(req.body);
    const authenticatedRequest = req as unknown as AuthenticatedRequest;
    const actorUserId = authenticatedRequest.auth.user.id;
    const task = await createTask(payload, actorUserId);

    res.status(201).json({ data: task });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid task payload", error.flatten()));
      return;
    }

    next(error);
  }
});

tasksRouter.patch("/:taskId", requireRole("admin"), async (req, res, next) => {
  try {
    const { taskId } = taskIdParamsSchema.parse(req.params);
    const payload = updateTaskSchema.parse(req.body);
    const task = await updateTask(taskId, payload);

    res.status(200).json({ data: task });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid task payload", error.flatten()));
      return;
    }

    next(error);
  }
});

tasksRouter.delete("/:taskId", requireRole("admin"), async (req, res, next) => {
  try {
    const { taskId } = taskIdParamsSchema.parse(req.params);
    const result = await deleteTask(taskId);

    res.status(200).json({ data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid task identifier", error.flatten()));
      return;
    }

    next(error);
  }
});
