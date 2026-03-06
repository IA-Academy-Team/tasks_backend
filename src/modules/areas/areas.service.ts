import prisma from "../../../prisma/prisma.client.js";
import { AppError } from "../../shared/http/app-error.js";
import type {
  AreasListQuery,
  CreateAreaInput,
  UpdateAreaInput,
} from "./areas.schemas.js";

export interface AreaDto {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  activeMemberCount: number;
  activeProjectCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DeleteAreaResult {
  id: number;
  mode: "deleted" | "archived";
}

const mapArea = async (area: {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): Promise<AreaDto> => {
  const [activeMemberCount, activeProjectCount] = await Promise.all([
    prisma.employeeAreaAssignment.count({
      where: {
        areaId: area.id,
        endedAt: null,
      },
    }),
    prisma.project.count({
      where: {
        areaId: area.id,
        status: {
          name: "Activo",
        },
      },
    }),
  ]);

  return {
    id: area.id,
    name: area.name,
    description: area.description ?? null,
    isActive: area.isActive,
    activeMemberCount,
    activeProjectCount,
    createdAt: area.createdAt.toISOString(),
    updatedAt: area.updatedAt.toISOString(),
  };
};

const getAreaOrThrow = async (areaId: number) => {
  const area = await prisma.area.findUnique({
    where: { id: areaId },
  });

  if (!area) {
    throw new AppError(404, "AREA_NOT_FOUND", "Area not found");
  }

  return area;
};

export const listAreas = async (query: AreasListQuery): Promise<AreaDto[]> => {
  const where = query.status === "all"
    ? {}
    : { isActive: query.status === "active" };

  const areas = await prisma.area.findMany({
    where,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return Promise.all(areas.map((area) => mapArea(area)));
};

export const getAreaById = async (areaId: number): Promise<AreaDto> => {
  const area = await getAreaOrThrow(areaId);
  return mapArea(area);
};

export const createArea = async (payload: CreateAreaInput): Promise<AreaDto> => {
  const area = await prisma.area.create({
    data: {
      name: payload.name,
      description: payload.description ?? null,
      isActive: payload.isActive ?? true,
    },
  }).catch((error) => {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      throw new AppError(409, "AREA_NAME_ALREADY_EXISTS", "Area name already exists");
    }

    throw error;
  });

  return mapArea(area);
};

export const updateArea = async (
  areaId: number,
  payload: UpdateAreaInput,
): Promise<AreaDto> => {
  const data: {
    name?: string;
    description?: string | null;
    isActive?: boolean;
  } = {};

  if (payload.name !== undefined) {
    data.name = payload.name;
  }

  if (payload.description !== undefined) {
    data.description = payload.description;
  }

  if (payload.isActive !== undefined) {
    data.isActive = payload.isActive;
  }

  const area = await prisma.area.update({
    where: { id: areaId },
    data,
  }).catch((error) => {
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "P2002") {
        throw new AppError(409, "AREA_NAME_ALREADY_EXISTS", "Area name already exists");
      }

      if (error.code === "P2025") {
        throw new AppError(404, "AREA_NOT_FOUND", "Area not found");
      }
    }

    throw error;
  });

  return mapArea(area);
};

export const deleteArea = async (areaId: number): Promise<DeleteAreaResult> => {
  await getAreaOrThrow(areaId);

  const [activeMemberCount, activeProjectCount] = await Promise.all([
    prisma.employeeAreaAssignment.count({
      where: {
        areaId,
        endedAt: null,
      },
    }),
    prisma.project.count({
      where: {
        areaId,
        status: {
          name: "Activo",
        },
      },
    }),
  ]);

  if (activeMemberCount > 0 || activeProjectCount > 0) {
    throw new AppError(
      409,
      "AREA_HAS_ACTIVE_DEPENDENCIES",
      "Area has active dependencies",
      {
        activeMemberCount,
        activeProjectCount,
      },
    );
  }

  const [totalAreaAssignments, totalProjects] = await Promise.all([
    prisma.employeeAreaAssignment.count({ where: { areaId } }),
    prisma.project.count({ where: { areaId } }),
  ]);

  if (totalAreaAssignments === 0 && totalProjects === 0) {
    await prisma.area.delete({
      where: { id: areaId },
    });

    return { id: areaId, mode: "deleted" };
  }

  await prisma.area.update({
    where: { id: areaId },
    data: { isActive: false },
  });

  return { id: areaId, mode: "archived" };
};

