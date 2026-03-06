import { Router } from "express";
import { analyticsRouter } from "../../modules/analytics/analytics.router.js";
import { areasRouter } from "../../modules/areas/areas.router.js";
import { authRouter } from "../../modules/auth/auth.router.js";
import { employeesRouter } from "../../modules/employees/employees.router.js";
import { projectsRouter } from "../../modules/projects/projects.router.js";
import { tasksRouter } from "../../modules/tasks/tasks.router.js";
import { usersRouter } from "../../modules/users/users.router.js";
import { healthRouter } from "./health.router.js";

export const apiV1Router = Router();

apiV1Router.use("/health", healthRouter);
apiV1Router.use("/auth", authRouter);
apiV1Router.use("/me", usersRouter);
apiV1Router.use("/areas", areasRouter);
apiV1Router.use("/employees", employeesRouter);
apiV1Router.use("/projects", projectsRouter);
apiV1Router.use("/tasks", tasksRouter);
apiV1Router.use("/analytics", analyticsRouter);
