import prisma from "../../../prisma/prisma.client.js";
import { AppError } from "../../shared/http/app-error.js";
import type {
  AreasListQuery,
  CreateAreaInput,
  UpdateAreaInput,
  UpdateAreaStatusInput,
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

interface AreaMetrics {
  activeMemberCount: number;
  activeProjectCount: number;
}

const buildAreaMetricsMap = async (areaIds: number[]): Promise<Map<number, AreaMetrics>> => {
  if (areaIds.length === 0) {
    return new Map();
  }

  const [activeMemberCounts, activeProjectCounts] = await Promise.all([
    prisma.employeeAreaAssignment.groupBy({
      by: ["areaId"],
      where: {
        areaId: { in: areaIds },
        endedAt: null,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.project.groupBy({
      by: ["areaId"],
      where: {
        areaId: { in: areaIds },
        status: {
          name: "Activo",
        },
      },
      _count: {
        _all: true,
      },
    }),
  ]);

  const metrics = new Map<number, AreaMetrics>();

  for (const areaId of areaIds) {
    metrics.set(areaId, {
      activeMemberCount: 0,
      activeProjectCount: 0,
    });
  }

  for (const count of activeMemberCounts) {
    const current = metrics.get(count.areaId);
    if (!current) continue;
    current.activeMemberCount = count._count._all;
  }

  for (const count of activeProjectCounts) {
    const current = metrics.get(count.areaId);
    if (!current) continue;
    current.activeProjectCount = count._count._all;
  }

  return metrics;
};

const mapArea = (area: {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}, metrics: AreaMetrics): AreaDto => {
  return {
    id: area.id,
    name: area.name,
    description: area.description ?? null,
    isActive: area.isActive,
    activeMemberCount: metrics.activeMemberCount,
    activeProjectCount: metrics.activeProjectCount,
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

  const metrics = await buildAreaMetricsMap(areas.map((area) => area.id));
  return areas.map((area) => mapArea(area, metrics.get(area.id) ?? {
    activeMemberCount: 0,
    activeProjectCount: 0,
  }));
};

export const getAreaById = async (areaId: number): Promise<AreaDto> => {
  const area = await getAreaOrThrow(areaId);
  const metrics = await buildAreaMetricsMap([area.id]);
  return mapArea(area, metrics.get(area.id) ?? {
    activeMemberCount: 0,
    activeProjectCount: 0,
  });
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

  const metrics = await buildAreaMetricsMap([area.id]);
  return mapArea(area, metrics.get(area.id) ?? {
    activeMemberCount: 0,
    activeProjectCount: 0,
  });
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

  const metrics = await buildAreaMetricsMap([area.id]);
  return mapArea(area, metrics.get(area.id) ?? {
    activeMemberCount: 0,
    activeProjectCount: 0,
  });
};

export const updateAreaStatus = async (
  areaId: number,
  payload: UpdateAreaStatusInput,
): Promise<AreaDto> => updateArea(areaId, { isActive: payload.isActive });

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
