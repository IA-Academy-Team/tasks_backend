import { Router } from "express";
import { z } from "zod";
import { AppError } from "../../shared/http/app-error.js";
import { requireAuth, type AuthenticatedRequest } from "../auth/auth.middleware.js";
import { updateMyProfileSchema } from "./users.schemas.js";
import { getCurrentUserProfile, updateCurrentUserProfile } from "./users.service.js";

export const usersRouter = Router();

usersRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const authenticatedRequest = req as AuthenticatedRequest;
    const userId = authenticatedRequest.auth.user.id;
    const profile = await getCurrentUserProfile(userId);

    res.status(200).json({ data: profile });
  } catch (error) {
    next(error);
  }
});

usersRouter.patch("/", requireAuth, async (req, res, next) => {
  try {
    const authenticatedRequest = req as AuthenticatedRequest;
    const userId = authenticatedRequest.auth.user.id;
    const payload = updateMyProfileSchema.parse(req.body);
    const profile = await updateCurrentUserProfile(userId, payload);

    res.status(200).json({ data: profile });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid profile payload", error.flatten()));
      return;
    }

    next(error);
  }
});

