import http from "node:http";
import { PORT } from "../../shared/config/env.config.js";
import { createApp } from "../create-app.js";
import { initNotificationsSocketServer } from "../../modules/notifications/notifications.socket.js";

export const startServer = async () => {
  const app = createApp();
  const server = http.createServer(app);
  initNotificationsSocketServer(server);

  await new Promise<void>((resolve) => {
    server.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
      console.log(`Health check at http://localhost:${PORT}/health`);
      console.log(`Swagger docs at http://localhost:${PORT}/api/docs`);
      resolve();
    });
  });

  return server;
};
