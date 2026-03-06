import { Router } from "express";
import { authRouter } from "../../modules/auth/auth.router.js";
import { usersRouter } from "../../modules/users/users.router.js";
import { healthRouter } from "./health.router.js";

export const apiV1Router = Router();

apiV1Router.use("/health", healthRouter);
apiV1Router.use("/auth", authRouter);
apiV1Router.use("/me", usersRouter);
