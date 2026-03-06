import { Router } from "express";
import {
  BACKEND_URL,
  BETTER_AUTH_BASE_PATH,
} from "../../shared/config/env.config.js";
import { authHandlerMiddleware } from "./auth.handler.js";
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

authRouter.use(authHandlerMiddleware);
