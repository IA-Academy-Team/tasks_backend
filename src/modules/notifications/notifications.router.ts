import { Router } from "express";
import { z } from "zod";
import { AppError } from "../../shared/http/app-error.js";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../auth/auth.middleware.js";
import {
  notificationIdParamsSchema,
  notificationsListQuerySchema,
} from "./notifications.schemas.js";
import {
  listNotificationsForUser,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "./notifications.service.js";

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get("/", async (req, res, next) => {
  try {
    const query = notificationsListQuerySchema.parse(req.query);
    const authenticatedRequest = req as unknown as AuthenticatedRequest;
    const result = await listNotificationsForUser(authenticatedRequest.auth.user.id, query);

    res.status(200).json({ data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid notifications query", error.flatten()));
      return;
    }

    next(error);
  }
});

notificationsRouter.patch("/read-all", async (req, res, next) => {
  try {
    const authenticatedRequest = req as unknown as AuthenticatedRequest;
    const result = await markAllNotificationsAsRead(authenticatedRequest.auth.user.id);

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.patch("/:notificationId/read", async (req, res, next) => {
  try {
    const { notificationId } = notificationIdParamsSchema.parse(req.params);
    const authenticatedRequest = req as unknown as AuthenticatedRequest;
    const notification = await markNotificationAsRead(
      authenticatedRequest.auth.user.id,
      notificationId,
    );

    res.status(200).json({ data: notification });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid notification identifier", error.flatten()));
      return;
    }

    next(error);
  }
});
