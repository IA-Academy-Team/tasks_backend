import express from "express";
import morgan from "morgan";
import { apiV1Router } from "./routes/v1.router.js";
import { corsMiddleware } from "./middlewares/cors.middleware.js";
import { errorHandlerMiddleware } from "./middlewares/error-handler.middleware.js";
import { notFoundMiddleware } from "./middlewares/not-found.middleware.js";

export const createApp = () => {
  const app = express();

  app.use(morgan('dev'))
  app.disable("x-powered-by");

  app.use(corsMiddleware);
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.use("/api", apiV1Router);

  app.use(notFoundMiddleware);
  app.use(errorHandlerMiddleware);

  return app;
};
