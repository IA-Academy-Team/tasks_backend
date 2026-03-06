import { Router } from "express";
import {
  BACKEND_URL,
  BETTER_AUTH_BASE_PATH,
} from "../../shared/config/env.config.js";
import { authHandlerMiddleware } from "./auth.handler.js";

export const authRouter = Router();

authRouter.get("/status", (_req, res) => {
  res.status(200).json({
    module: "auth",
    status: "ready",
    handlerPath: BETTER_AUTH_BASE_PATH,
    baseUrl: BACKEND_URL,
  });
});

authRouter.use(authHandlerMiddleware);
