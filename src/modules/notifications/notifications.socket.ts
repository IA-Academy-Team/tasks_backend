import type { IncomingHttpHeaders, Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { FRONTEND_ORIGINS } from "../../shared/config/env.config.js";
import { getCurrentAuthSession, type CurrentAuthSession } from "../auth/auth.service.js";
import type { NotificationDto } from "./notifications.service.js";

interface NotificationsSocketAuth {
  token?: string;
}

declare module "socket.io" {
  interface SocketData {
    authSession?: CurrentAuthSession;
  }
}

export interface NotificationCreatedRealtimeEvent {
  notification: NotificationDto;
  unreadCount: number;
  issuedAt: string;
}

export interface NotificationReadRealtimeEvent {
  notificationId: number;
  readAt: string;
  unreadCount: number;
  issuedAt: string;
}

export interface NotificationsReadAllRealtimeEvent {
  readAt: string;
  unreadCount: number;
  issuedAt: string;
}

let notificationsSocketServer: Server | null = null;

const getUserNotificationsRoom = (userId: number) => `notifications:user:${userId}`;

const getHandshakeToken = (socket: Socket): string | null => {
  const authPayload = socket.handshake.auth as NotificationsSocketAuth | undefined;
  if (!authPayload || typeof authPayload.token !== "string") {
    return null;
  }

  const token = authPayload.token.trim();
  return token.length > 0 ? token : null;
};

const buildHeadersForSessionLookup = (socket: Socket): IncomingHttpHeaders => {
  const headers: IncomingHttpHeaders = { ...socket.handshake.headers };
  const token = getHandshakeToken(socket);

  if (token && !headers.authorization) {
    headers.authorization = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  }

  return headers;
};

const ensureAuthenticatedSocket = async (socket: Socket) => {
  const currentSession = await getCurrentAuthSession(buildHeadersForSessionLookup(socket));
  if (!currentSession || !currentSession.user.isActive) {
    throw new Error("UNAUTHORIZED_SOCKET");
  }

  socket.data.authSession = currentSession;
};

export const initNotificationsSocketServer = (server: HttpServer): Server => {
  if (notificationsSocketServer) {
    return notificationsSocketServer;
  }

  notificationsSocketServer = new Server(server, {
    cors: {
      origin: FRONTEND_ORIGINS,
      credentials: true,
    },
  });

  notificationsSocketServer.use((socket, next) => {
    void ensureAuthenticatedSocket(socket)
      .then(() => next())
      .catch((error) => {
        next(error instanceof Error ? error : new Error("UNAUTHORIZED_SOCKET"));
      });
  });

  notificationsSocketServer.on("connection", (socket) => {
    const session = socket.data.authSession;
    if (!session) {
      socket.disconnect(true);
      return;
    }

    socket.join(getUserNotificationsRoom(session.user.id));
  });

  return notificationsSocketServer;
};

export const emitNotificationCreatedRealtime = (
  userId: number,
  payload: NotificationCreatedRealtimeEvent,
) => {
  if (!notificationsSocketServer) {
    return;
  }

  notificationsSocketServer
    .to(getUserNotificationsRoom(userId))
    .emit("notifications:new", payload);
};

export const emitNotificationReadRealtime = (
  userId: number,
  payload: NotificationReadRealtimeEvent,
) => {
  if (!notificationsSocketServer) {
    return;
  }

  notificationsSocketServer
    .to(getUserNotificationsRoom(userId))
    .emit("notifications:read", payload);
};

export const emitNotificationsReadAllRealtime = (
  userId: number,
  payload: NotificationsReadAllRealtimeEvent,
) => {
  if (!notificationsSocketServer) {
    return;
  }

  notificationsSocketServer
    .to(getUserNotificationsRoom(userId))
    .emit("notifications:read-all", payload);
};
