import { readFile } from "node:fs/promises";
import { Router } from "express";

const openApiFileUrl = new URL("../../shared/docs/openapi.generated.json", import.meta.url);

const loadOpenApiDocument = async (): Promise<unknown> => {
  const raw = await readFile(openApiFileUrl, "utf-8");
  return JSON.parse(raw);
};

export const docsRouter = Router();

docsRouter.get("/openapi.json", async (_req, res, next) => {
  try {
    const document = await loadOpenApiDocument();
    res.status(200).json(document);
  } catch (error) {
    next(error);
  }
});

docsRouter.get("/docs", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>TaskApp API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body { margin: 0; background: #f8fafc; }
      .topbar { display: none; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: "/api/openapi.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        displayRequestDuration: true,
        persistAuthorization: true
      });
    </script>
  </body>
</html>`);
});

