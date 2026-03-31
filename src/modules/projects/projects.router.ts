import { Router } from "express";
import { z } from "zod";
import { AppError } from "../../shared/http/app-error.js";
import {
  requireAuth,
  requireRole,
  type AuthenticatedRequest,
} from "../auth/auth.middleware.js";
import {
  assignProjectMembershipSchema,
  createProjectSchema,
  projectIdParamsSchema,
  projectMembershipIdParamsSchema,
  projectMembershipsListQuerySchema,
  projectsListQuerySchema,
  reassignProjectMembershipSchema,
  reassignProjectTasksSchema,
  updateProjectSchema,
  updateProjectStatusSchema,
} from "./projects.schemas.js";
import {
  assignProjectMembership,
  createProject,
  deleteProject,
  getProjectById,
  listProjectMemberships,
  listProjects,
  reassignProjectMembership,
  reassignProjectTasks,
  unassignProjectMembership,
  updateProject,
  updateProjectStatus,
} from "./projects.service.js";

export const projectsRouter = Router();

projectsRouter.use(requireAuth);

projectsRouter.get("/", async (req, res, next) => {
  try {
    const query = projectsListQuerySchema.parse(req.query);
    const authenticatedRequest = req as unknown as AuthenticatedRequest;
    const projects = await listProjects(query, {
      userId: authenticatedRequest.auth.user.id,
      role: authenticatedRequest.auth.user.role,
    });

    res.status(200).json({ data: projects });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid projects query", error.flatten()));
      return;
    }

    next(error);
  }
});

projectsRouter.get("/:projectId", async (req, res, next) => {
  try {
    const { projectId } = projectIdParamsSchema.parse(req.params);
    const authenticatedRequest = req as unknown as AuthenticatedRequest;
    const project = await getProjectById(projectId, {
      userId: authenticatedRequest.auth.user.id,
      role: authenticatedRequest.auth.user.role,
    });

    res.status(200).json({ data: project });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid project identifier", error.flatten()));
      return;
    }

    next(error);
  }
});

projectsRouter.get("/:projectId/memberships", async (req, res, next) => {
  try {
    const { projectId } = projectIdParamsSchema.parse(req.params);
    const query = projectMembershipsListQuerySchema.parse(req.query);
    const authenticatedRequest = req as unknown as AuthenticatedRequest;
    const memberships = await listProjectMemberships(projectId, query, {
      userId: authenticatedRequest.auth.user.id,
      role: authenticatedRequest.auth.user.role,
    });

    res.status(200).json({ data: memberships });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(
        400,
        "VALIDATION_ERROR",
        "Invalid project membership query",
        error.flatten(),
      ));
      return;
    }

    next(error);
  }
});

projectsRouter.post("/", requireRole("admin"), async (req, res, next) => {
  try {
    const payload = createProjectSchema.parse(req.body);
    const project = await createProject(payload);

    res.status(201).json({ data: project });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid project payload", error.flatten()));
      return;
    }

    next(error);
  }
});

projectsRouter.patch("/:projectId", requireRole("admin"), async (req, res, next) => {
  try {
    const { projectId } = projectIdParamsSchema.parse(req.params);
    const payload = updateProjectSchema.parse(req.body);
    const project = await updateProject(projectId, payload);

    res.status(200).json({ data: project });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid project payload", error.flatten()));
      return;
    }

    next(error);
  }
});

projectsRouter.patch("/:projectId/status", requireRole("admin"), async (req, res, next) => {
  try {
    const { projectId } = projectIdParamsSchema.parse(req.params);
    const payload = updateProjectStatusSchema.parse(req.body);
    const project = await updateProjectStatus(projectId, payload);

    res.status(200).json({ data: project });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(
        400,
        "VALIDATION_ERROR",
        "Invalid project status payload",
        error.flatten(),
      ));
      return;
    }

    next(error);
  }
});

projectsRouter.delete("/:projectId", requireRole("admin"), async (req, res, next) => {
  try {
    const { projectId } = projectIdParamsSchema.parse(req.params);
    const result = await deleteProject(projectId);

    res.status(200).json({ data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid project identifier", error.flatten()));
      return;
    }

    next(error);
  }
});

projectsRouter.post("/:projectId/memberships", requireRole("admin"), async (req, res, next) => {
  try {
    const { projectId } = projectIdParamsSchema.parse(req.params);
    const payload = assignProjectMembershipSchema.parse(req.body);
    const authenticatedRequest = req as unknown as AuthenticatedRequest;
    const actorUserId = authenticatedRequest.auth.user.id;
    const membership = await assignProjectMembership(projectId, payload, actorUserId);

    res.status(201).json({ data: membership });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(
        400,
        "VALIDATION_ERROR",
        "Invalid project membership payload",
        error.flatten(),
      ));
      return;
    }

    next(error);
  }
});

projectsRouter.patch(
  "/:projectId/memberships/:membershipId/unassign",
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const { projectId, membershipId } = projectMembershipIdParamsSchema.parse(req.params);
      const authenticatedRequest = req as unknown as AuthenticatedRequest;
      const actorUserId = authenticatedRequest.auth.user.id;
      const membership = await unassignProjectMembership(projectId, membershipId, actorUserId);

      res.status(200).json({ data: membership });
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(new AppError(
          400,
          "VALIDATION_ERROR",
          "Invalid project membership identifier",
          error.flatten(),
        ));
        return;
      }

      next(error);
    }
  },
);

projectsRouter.patch(
  "/:projectId/tasks/reassign",
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const { projectId } = projectIdParamsSchema.parse(req.params);
      const payload = reassignProjectTasksSchema.parse(req.body);
      const authenticatedRequest = req as unknown as AuthenticatedRequest;
      const actorUserId = authenticatedRequest.auth.user.id;
      const result = await reassignProjectTasks(projectId, payload, actorUserId);

      res.status(200).json({ data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(new AppError(
          400,
          "VALIDATION_ERROR",
          "Invalid project task reassignment payload",
          error.flatten(),
        ));
        return;
      }

      next(error);
    }
  },
);

projectsRouter.patch(
  "/:projectId/memberships/:membershipId/reassign",
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const { projectId, membershipId } = projectMembershipIdParamsSchema.parse(req.params);
      const payload = reassignProjectMembershipSchema.parse(req.body);
      const authenticatedRequest = req as unknown as AuthenticatedRequest;
      const actorUserId = authenticatedRequest.auth.user.id;
      const result = await reassignProjectMembership(projectId, membershipId, payload, actorUserId);

      res.status(200).json({ data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(new AppError(
          400,
          "VALIDATION_ERROR",
          "Invalid project membership reassignment payload",
          error.flatten(),
        ));
        return;
      }

      next(error);
    }
  },
);
