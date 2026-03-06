import { Router } from "express";
import { authRouter } from "../../modules/auth/auth.router.js";
import { healthRouter } from "./health.router.js";

export const apiV1Router = Router();

apiV1Router.use("/health", healthRouter);
apiV1Router.use("/auth", authRouter);
