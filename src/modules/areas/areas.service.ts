import prisma from "../../../prisma/prisma.client.js";
import { AppError } from "../../shared/http/app-error.js";
import { emitRealtimeEvent } from "../notifications/notifications.socket.js";
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
    if (count.areaId === null) continue;
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
  const created = mapArea(area, metrics.get(area.id) ?? {
    activeMemberCount: 0,
    activeProjectCount: 0,
  });
  emitRealtimeEvent("area:created", {
    area: created,
    issuedAt: new Date().toISOString(),
  }, "admin");
  emitRealtimeEvent("analytics:updated", {
    entity: "area",
    action: "created",
    areaId: created.id,
    issuedAt: new Date().toISOString(),
  }, "admin");
  return created;
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
  const updated = mapArea(area, metrics.get(area.id) ?? {
    activeMemberCount: 0,
    activeProjectCount: 0,
  });
  emitRealtimeEvent("area:updated", {
    area: updated,
    issuedAt: new Date().toISOString(),
  }, "admin");
  emitRealtimeEvent("analytics:updated", {
    entity: "area",
    action: "updated",
    areaId: updated.id,
    issuedAt: new Date().toISOString(),
  }, "admin");
  return updated;
};

export const updateAreaStatus = async (
  areaId: number,
  payload: UpdateAreaStatusInput,
): Promise<AreaDto> => updateArea(areaId, { isActive: payload.isActive });

export const deleteArea = async (areaId: number): Promise<DeleteAreaResult> => {
  await getAreaOrThrow(areaId);

  await prisma.$transaction(async (tx) => {
    const now = new Date();

    // Desasocia empleados activos de esta area.
    await tx.employeeAreaAssignment.updateMany({
      where: {
        areaId,
        endedAt: null,
      },
      data: {
        endedAt: now,
        endedByUserId: null,
      },
    });

    // Desasocia proyectos de esta area.
    await tx.project.updateMany({
      where: { areaId },
      data: { areaId: null },
    });

    // Elimina historial de asignaciones para permitir borrado fisico del area.
    await tx.employeeAreaAssignment.deleteMany({
      where: { areaId },
    });

    await tx.area.delete({
      where: { id: areaId },
    });
  });

  const result = { id: areaId, mode: "deleted" } as const;
  emitRealtimeEvent("area:deleted", {
    areaId,
    mode: result.mode,
    issuedAt: new Date().toISOString(),
  }, "admin");
  emitRealtimeEvent("analytics:updated", {
    entity: "area",
    action: "deleted",
    areaId,
    issuedAt: new Date().toISOString(),
  }, "admin");
  return result;
};
