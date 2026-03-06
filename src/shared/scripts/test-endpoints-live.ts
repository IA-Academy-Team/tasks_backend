import http from "node:http";
import { pathToFileURL } from "node:url";
import { createApp } from "../../app/create-app.js";

type JsonRecord = Record<string, unknown>;
const DEFAULT_ORIGIN = process.env.DEV_HOST?.trim()
  || process.env.FRONTEND_URL?.trim()
  || "http://localhost:5173";

class CookieJar {
  private readonly cookies = new Map<string, string>();

  applyToHeaders(headers: Headers) {
    const serialized = [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
    if (serialized) {
      headers.set("cookie", serialized);
    }
  }

  absorbFromResponse(response: Response) {
    const maybeHeaders = response.headers as Headers & { getSetCookie?: () => string[] };
    const setCookies = typeof maybeHeaders.getSetCookie === "function"
      ? maybeHeaders.getSetCookie()
      : (() => {
          const single = response.headers.get("set-cookie");
          return single ? [single] : [];
        })();

    for (const rawCookie of setCookies) {
      const pair = rawCookie.split(";")[0];
      if (!pair) continue;

      const separatorIndex = pair.indexOf("=");
      if (separatorIndex <= 0) continue;

      const name = pair.slice(0, separatorIndex).trim();
      const value = pair.slice(separatorIndex + 1).trim();
      if (!name) continue;

      if (!value) {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, value);
      }
    }
  }
}

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const asRecord = (value: unknown): JsonRecord => {
  assertCondition(
    typeof value === "object" && value !== null && !Array.isArray(value),
    "Expected JSON object response",
  );
  return value as JsonRecord;
};

const asArray = (value: unknown): unknown[] => {
  assertCondition(Array.isArray(value), "Expected JSON array response");
  return value;
};

const fetchJson = async (
  baseUrl: string,
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    expectedStatus?: number;
    jar?: CookieJar;
  } = {},
) => {
  const headers = new Headers();
  headers.set("content-type", "application/json");
  headers.set("origin", DEFAULT_ORIGIN);
  options.jar?.applyToHeaders(headers);

  const requestInit: RequestInit = {
    method: options.method ?? "GET",
    headers,
  };
  if (options.body !== undefined) {
    requestInit.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${baseUrl}${path}`, requestInit);

  options.jar?.absorbFromResponse(response);

  const expected = options.expectedStatus ?? 200;
  const rawText = await response.text();
  const payload = rawText ? JSON.parse(rawText) : null;

  if (response.status !== expected) {
    throw new Error(
      `Unexpected status for ${options.method ?? "GET"} ${path}. Expected ${expected}, got ${response.status}. Payload: ${rawText}`,
    );
  }

  return payload;
};

const step = async (name: string, action: () => Promise<void>) => {
  process.stdout.write(`• ${name}... `);
  await action();
  console.log("ok");
};

export const runLiveEndpointsScenario = async () => {
  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(0, "127.0.0.1");
  });
  const address = server.address();
  assertCondition(!!address && typeof address !== "string", "Unable to resolve ephemeral server port");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const adminJar = new CookieJar();
  const employeeJar = new CookieJar();
  const suffix = `${Date.now()}`;

  let createdAreaId = 0;
  let createdEmployeeId = 0;
  let createdProjectId = 0;
  let createdMembershipId = 0;
  let firstTaskId = 0;
  let secondTaskId = 0;
  let restoredAdminName = "";

  try {
    await step("health endpoint", async () => {
      const payload = asRecord(await fetchJson(baseUrl, "/api/health"));
      assertCondition(payload.status === "ok", "Health status must be ok");
    });

    await step("auth status endpoint", async () => {
      await fetchJson(baseUrl, "/api/auth/status");
    });

    await step("session unauthenticated", async () => {
      const payload = asRecord(await fetchJson(baseUrl, "/api/auth/session"));
      assertCondition(payload.authenticated === false, "Session should be unauthenticated before login");
    });

    await step("protected route without auth returns 401", async () => {
      await fetchJson(baseUrl, "/api/projects", { expectedStatus: 401 });
    });

    await step("admin sign-in", async () => {
      await fetchJson(baseUrl, "/api/auth/handler/sign-in/email", {
        method: "POST",
        jar: adminJar,
        body: {
          email: "admin@taskapp.local",
          password: "admin123",
          rememberMe: true,
        },
      });
    });

    await step("session authenticated after sign-in", async () => {
      const payload = asRecord(await fetchJson(baseUrl, "/api/auth/session", { jar: adminJar }));
      assertCondition(payload.authenticated === true, "Admin session should be authenticated");
    });

    await step("auth access endpoints", async () => {
      await fetchJson(baseUrl, "/api/auth/access/me", { jar: adminJar });
      await fetchJson(baseUrl, "/api/auth/access/admin", { jar: adminJar });
      await fetchJson(baseUrl, "/api/auth/access/employee", { jar: adminJar });
    });

    await step("profile get/patch/restore", async () => {
      const profile = asRecord(await fetchJson(baseUrl, "/api/me", { jar: adminJar }));
      const profileData = asRecord(profile.data);
      const originalName = String(profileData.name);
      restoredAdminName = originalName;

      await fetchJson(baseUrl, "/api/me", {
        method: "PATCH",
        jar: adminJar,
        body: { name: `${originalName} QA` },
      });

      await fetchJson(baseUrl, "/api/me", {
        method: "PATCH",
        jar: adminJar,
        body: { name: originalName },
      });
    });

    let activeAreaId = 0;
    let targetEmployeeId = 0;

    await step("areas CRUD", async () => {
      const areasResponse = asRecord(await fetchJson(baseUrl, "/api/areas?status=active", { jar: adminJar }));
      const areas = asArray(areasResponse.data);
      assertCondition(areas.length > 0, "Expected at least one active area from seeds");
      activeAreaId = Number(asRecord(areas[0]).id);

      const createdArea = asRecord(await fetchJson(baseUrl, "/api/areas", {
        method: "POST",
        jar: adminJar,
        expectedStatus: 201,
        body: {
          name: `QA Area ${suffix}`,
          description: "Area temporal para pruebas Fase 6",
          isActive: true,
        },
      }));
      createdAreaId = Number(asRecord(createdArea.data).id);

      await fetchJson(baseUrl, `/api/areas/${createdAreaId}`, { jar: adminJar });

      await fetchJson(baseUrl, `/api/areas/${createdAreaId}`, {
        method: "PATCH",
        jar: adminJar,
        body: { description: "Area temporal actualizada Fase 6" },
      });

      await fetchJson(baseUrl, `/api/areas/${createdAreaId}`, {
        method: "DELETE",
        jar: adminJar,
      });
    });

    await step("employees CRUD + assignments + memberships listing", async () => {
      const employeesResponse = asRecord(await fetchJson(baseUrl, "/api/employees?status=active", { jar: adminJar }));
      const employees = asArray(employeesResponse.data).map(asRecord);
      const laura = employees.find((employee) => employee.email === "laura.operaciones@taskapp.local");
      assertCondition(laura, "Expected seeded employee laura.operaciones@taskapp.local");
      targetEmployeeId = Number(laura.id);
      const lauraAreaId = Number(laura.currentAreaId);
      assertCondition(Number.isInteger(lauraAreaId) && lauraAreaId > 0, "Expected Laura to have active area");
      activeAreaId = lauraAreaId;

      const createdEmployee = asRecord(await fetchJson(baseUrl, "/api/employees", {
        method: "POST",
        jar: adminJar,
        expectedStatus: 201,
        body: {
          name: `QA Employee ${suffix}`,
          email: `qa.employee.${suffix}@taskapp.local`,
          password: "QATesting123!",
          isActive: true,
          emailVerified: true,
        },
      }));
      createdEmployeeId = Number(asRecord(createdEmployee.data).id);

      await fetchJson(baseUrl, `/api/employees/${createdEmployeeId}`, { jar: adminJar });

      await fetchJson(baseUrl, `/api/employees/${createdEmployeeId}`, {
        method: "PATCH",
        jar: adminJar,
        body: {
          phoneNumber: "+573009998877",
        },
      });

      await fetchJson(baseUrl, `/api/employees/${createdEmployeeId}/status`, {
        method: "PATCH",
        jar: adminJar,
        body: { isActive: false },
      });

      await fetchJson(baseUrl, `/api/employees/${createdEmployeeId}/status`, {
        method: "PATCH",
        jar: adminJar,
        body: { isActive: true },
      });

      await fetchJson(baseUrl, `/api/employees/${createdEmployeeId}/area-assignments?status=all`, { jar: adminJar });

      await fetchJson(baseUrl, `/api/employees/${createdEmployeeId}/area-assignments`, {
        method: "POST",
        jar: adminJar,
        expectedStatus: 201,
        body: { areaId: activeAreaId },
      });

      await fetchJson(baseUrl, `/api/employees/${createdEmployeeId}/project-memberships?status=all`, { jar: adminJar });
    });

    await step("projects CRUD + memberships + lifecycle", async () => {
      await fetchJson(baseUrl, "/api/projects?status=all", { jar: adminJar });

      const createdProject = asRecord(await fetchJson(baseUrl, "/api/projects", {
        method: "POST",
        jar: adminJar,
        expectedStatus: 201,
        body: {
          areaId: activeAreaId,
          name: `QA Project ${suffix}`,
          description: "Proyecto temporal de pruebas Fase 6",
          startDate: "2026-03-01",
          endDate: "2026-03-30",
        },
      }));
      createdProjectId = Number(asRecord(createdProject.data).id);

      await fetchJson(baseUrl, `/api/projects/${createdProjectId}`, { jar: adminJar });

      await fetchJson(baseUrl, `/api/projects/${createdProjectId}`, {
        method: "PATCH",
        jar: adminJar,
        body: {
          description: "Proyecto temporal actualizado Fase 6",
        },
      });

      await fetchJson(baseUrl, `/api/projects/${createdProjectId}/status`, {
        method: "PATCH",
        jar: adminJar,
        body: { status: "active" },
      });

      const createdMembership = asRecord(await fetchJson(baseUrl, `/api/projects/${createdProjectId}/memberships`, {
        method: "POST",
        jar: adminJar,
        expectedStatus: 201,
        body: { employeeId: createdEmployeeId },
      }));
      createdMembershipId = Number(asRecord(createdMembership.data).id);

      await fetchJson(baseUrl, `/api/projects/${createdProjectId}/memberships?status=all`, { jar: adminJar });

      const reassigned = asRecord(await fetchJson(
        baseUrl,
        `/api/projects/${createdProjectId}/memberships/${createdMembershipId}/reassign`,
        {
          method: "PATCH",
          jar: adminJar,
          body: { toEmployeeId: targetEmployeeId },
        },
      ));
      createdMembershipId = Number(asRecord(asRecord(reassigned.data).toMembership).id);
    });

    await step("tasks CRUD + workflow + history + soft delete", async () => {
      const firstTask = asRecord(await fetchJson(baseUrl, "/api/tasks", {
        method: "POST",
        jar: adminJar,
        expectedStatus: 201,
        body: {
          projectId: createdProjectId,
          title: `QA Task Primary ${suffix}`,
          description: "Tarea primaria para validar flujo",
          plannedStartDate: "2026-03-02",
          dueDate: "2026-03-08",
          taskPriorityId: 2,
          assigneeMembershipId: createdMembershipId,
          estimatedMinutes: 120,
        },
      }));
      firstTaskId = Number(asRecord(firstTask.data).id);

      await fetchJson(baseUrl, `/api/tasks/${firstTaskId}`, { jar: adminJar });

      await fetchJson(baseUrl, `/api/tasks/${firstTaskId}`, {
        method: "PATCH",
        jar: adminJar,
        body: {
          description: "Tarea primaria actualizada",
          estimatedMinutes: 150,
        },
      });

      await fetchJson(baseUrl, `/api/tasks/${firstTaskId}/status`, {
        method: "PATCH",
        jar: adminJar,
        body: { toStatus: "in_progress", notes: "Inicio admin" },
      });

      await fetchJson(baseUrl, `/api/tasks/${firstTaskId}/status`, {
        method: "PATCH",
        jar: adminJar,
        body: { toStatus: "done", notes: "Cierre admin" },
      });

      await fetchJson(baseUrl, `/api/tasks/${firstTaskId}/history`, { jar: adminJar });

      const secondTask = asRecord(await fetchJson(baseUrl, "/api/tasks", {
        method: "POST",
        jar: adminJar,
        expectedStatus: 201,
        body: {
          projectId: createdProjectId,
          title: `QA Task Employee ${suffix}`,
          description: "Tarea para validar transición employee",
          plannedStartDate: "2026-03-03",
          dueDate: "2026-03-09",
          taskPriorityId: 3,
          assigneeMembershipId: createdMembershipId,
          estimatedMinutes: 90,
        },
      }));
      secondTaskId = Number(asRecord(secondTask.data).id);

      await fetchJson(
        baseUrl,
        `/api/tasks?projectId=${createdProjectId}&status=all&includeDeleted=false`,
        { jar: adminJar },
      );
    });

    await step("admin analytics endpoints", async () => {
      await fetchJson(baseUrl, "/api/analytics/dashboard/admin", { jar: adminJar });
      await fetchJson(baseUrl, "/api/analytics/reports/compliance?limit=50&compliance=all", { jar: adminJar });
      await fetchJson(baseUrl, "/api/analytics/alerts/overdue?limit=20", { jar: adminJar });
    });

    await step("admin sign-out", async () => {
      await fetchJson(baseUrl, "/api/auth/handler/sign-out", { method: "POST", jar: adminJar });
      const payload = asRecord(await fetchJson(baseUrl, "/api/auth/session", { jar: adminJar }));
      assertCondition(payload.authenticated === false, "Session should be closed after sign-out");
    });

    await step("employee sign-in and permission checks", async () => {
      await fetchJson(baseUrl, "/api/auth/handler/sign-in/email", {
        method: "POST",
        jar: employeeJar,
        body: {
          email: "laura.operaciones@taskapp.local",
          password: "laura123",
          rememberMe: true,
        },
      });

      await fetchJson(baseUrl, "/api/auth/access/admin", {
        jar: employeeJar,
        expectedStatus: 403,
      });

      await fetchJson(baseUrl, "/api/areas", {
        jar: employeeJar,
        expectedStatus: 403,
      });

      await fetchJson(baseUrl, "/api/projects?status=all", { jar: employeeJar });
      await fetchJson(baseUrl, "/api/analytics/dashboard/employee", { jar: employeeJar });
      await fetchJson(baseUrl, "/api/analytics/dashboard/admin", {
        jar: employeeJar,
        expectedStatus: 403,
      });
    });

    await step("employee task transition on assigned task", async () => {
      await fetchJson(baseUrl, `/api/tasks/${secondTaskId}/status`, {
        method: "PATCH",
        jar: employeeJar,
        body: { toStatus: "in_progress", notes: "Inicio employee" },
      });
      await fetchJson(baseUrl, `/api/tasks/${secondTaskId}/status`, {
        method: "PATCH",
        jar: employeeJar,
        body: { toStatus: "done", notes: "Cierre employee" },
      });
    });

    await step("employee sign-out", async () => {
      await fetchJson(baseUrl, "/api/auth/handler/sign-out", { method: "POST", jar: employeeJar });
    });

    await step("admin cleanup operations", async () => {
      await fetchJson(baseUrl, "/api/auth/handler/sign-in/email", {
        method: "POST",
        jar: adminJar,
        body: {
          email: "admin@taskapp.local",
          password: "admin123",
          rememberMe: true,
        },
      });

      await fetchJson(baseUrl, `/api/tasks/${firstTaskId}`, {
        method: "DELETE",
        jar: adminJar,
      });
      await fetchJson(baseUrl, `/api/tasks/${secondTaskId}`, {
        method: "DELETE",
        jar: adminJar,
      });

      await fetchJson(
        baseUrl,
        `/api/projects/${createdProjectId}/memberships/${createdMembershipId}/unassign`,
        {
          method: "PATCH",
          jar: adminJar,
        },
      );

      await fetchJson(baseUrl, `/api/projects/${createdProjectId}`, {
        method: "DELETE",
        jar: adminJar,
      });

      await fetchJson(baseUrl, `/api/employees/${createdEmployeeId}/status`, {
        method: "PATCH",
        jar: adminJar,
        body: { isActive: false },
      });

      if (restoredAdminName) {
        await fetchJson(baseUrl, "/api/me", {
          method: "PATCH",
          jar: adminJar,
          body: { name: restoredAdminName },
        });
      }
    });

    console.log("\n✅ test:endpoints:live completed successfully.");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
};

const isMainModule = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isMainModule) {
  void runLiveEndpointsScenario().catch((error) => {
    console.error("\n❌ test:endpoints:live failed");
    console.error(error);
    process.exit(1);
  });
}
