import http from "node:http";
import { PORT } from "../../shared/config/env.config.js";
import { createApp } from "../create-app.js";

export const startServer = async () => {
  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
      console.log(`Health check at http://localhost:${PORT}/api/health`);
      resolve();
    });
  });

  return server;
};
