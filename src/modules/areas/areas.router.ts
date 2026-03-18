import { Router } from "express";
import { z } from "zod";
import { AppError } from "../../shared/http/app-error.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import {
  areaIdParamsSchema,
  areasListQuerySchema,
  createAreaSchema,
  updateAreaSchema,
  updateAreaStatusSchema,
} from "./areas.schemas.js";
import {
  createArea,
  deleteArea,
  getAreaById,
  listAreas,
  updateArea,
  updateAreaStatus,
} from "./areas.service.js";

export const areasRouter = Router();

areasRouter.use(requireAuth, requireRole("admin"));

areasRouter.get("/", async (req, res, next) => {
  try {
    const query = areasListQuerySchema.parse(req.query);
    const areas = await listAreas(query);

    res.status(200).json({ data: areas });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid areas query", error.flatten()));
      return;
    }

    next(error);
  }
});

areasRouter.get("/:areaId", async (req, res, next) => {
  try {
    const { areaId } = areaIdParamsSchema.parse(req.params);
    const area = await getAreaById(areaId);

    res.status(200).json({ data: area });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid area identifier", error.flatten()));
      return;
    }

    next(error);
  }
});

areasRouter.post("/", async (req, res, next) => {
  try {
    const payload = createAreaSchema.parse(req.body);
    const area = await createArea(payload);

    res.status(201).json({ data: area });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid area payload", error.flatten()));
      return;
    }

    next(error);
  }
});

areasRouter.patch("/:areaId", async (req, res, next) => {
  try {
    const { areaId } = areaIdParamsSchema.parse(req.params);
    const payload = updateAreaSchema.parse(req.body);
    const area = await updateArea(areaId, payload);

    res.status(200).json({ data: area });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid area payload", error.flatten()));
      return;
    }

    next(error);
  }
});

areasRouter.patch("/:areaId/status", async (req, res, next) => {
  try {
    const { areaId } = areaIdParamsSchema.parse(req.params);
    const payload = updateAreaStatusSchema.parse(req.body);
    const area = await updateAreaStatus(areaId, payload);

    res.status(200).json({ data: area });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid area status payload", error.flatten()));
      return;
    }

    next(error);
  }
});

areasRouter.delete("/:areaId", async (req, res, next) => {
  try {
    const { areaId } = areaIdParamsSchema.parse(req.params);
    const result = await deleteArea(areaId);

    res.status(200).json({ data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid area identifier", error.flatten()));
      return;
    }

    next(error);
  }
});
