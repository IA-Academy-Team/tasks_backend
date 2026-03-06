import express from "express";
import { apiV1Router } from "./routes/v1.router.js";
import { corsMiddleware } from "./middlewares/cors.middleware.js";
import { errorHandlerMiddleware } from "./middlewares/error-handler.middleware.js";
import { notFoundMiddleware } from "./middlewares/not-found.middleware.js";
import { requestLoggerMiddleware } from "./middlewares/request-logger.middleware.js";

export const createApp = () => {
  const app = express();

  app.disable("x-powered-by");

  app.use(requestLoggerMiddleware);
  app.use(corsMiddleware);
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.use("/api/v1", apiV1Router);

  app.use(notFoundMiddleware);
  app.use(errorHandlerMiddleware);

  return app;
};
