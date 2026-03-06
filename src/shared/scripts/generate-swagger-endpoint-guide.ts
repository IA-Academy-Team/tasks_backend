import { mkdir, readFile, writeFile } from "node:fs/promises";

interface OpenApiLike {
  paths?: Record<string, Record<string, { summary?: string; tags?: string[]; security?: unknown }>>;
}

const inputFile = new URL("../docs/openapi.generated.json", import.meta.url);
const docsDirectory = new URL("../../../docs/", import.meta.url);
const outputFile = new URL("../../../docs/api-endpoints.md", import.meta.url);

const toSecurityLabel = (operation: { security?: unknown }): string =>
  operation.security ? "Sí" : "No";

const run = async () => {
  const raw = await readFile(inputFile, "utf-8");
  const document = JSON.parse(raw) as OpenApiLike;
  const paths = document.paths ?? {};

  const rows: Array<{ method: string; path: string; summary: string; tag: string; secured: string }> = [];

  for (const [path, operations] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(operations)) {
      rows.push({
        method: method.toUpperCase(),
        path,
        summary: operation.summary ?? "-",
        tag: operation.tags?.[0] ?? "-",
        secured: toSecurityLabel(operation),
      });
    }
  }

  rows.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

  const markdown = [
    "# API Endpoint Guide",
    "",
    "Documento generado automáticamente desde `openapi.generated.json`.",
    "",
    "| Método | Ruta | Módulo | Requiere Auth | Resumen |",
    "|---|---|---|---|---|",
    ...rows.map((row) => `| ${row.method} | \`${row.path}\` | ${row.tag} | ${row.secured} | ${row.summary} |`),
    "",
  ].join("\n");

  await mkdir(docsDirectory, { recursive: true });
  await writeFile(outputFile, markdown, "utf-8");
  console.log(`Endpoint guide generated at ${outputFile.pathname}`);
};

void run();

