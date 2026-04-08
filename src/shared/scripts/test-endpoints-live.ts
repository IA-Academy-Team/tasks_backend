import http from "node:http";
import { pathToFileURL } from "node:url";
import prisma from "../../../prisma/prisma.client.js";
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

const asNumber = (value: unknown, message: string): number => {
  const numeric = typeof value === "number" ? value : Number(value);
  assertCondition(Number.isFinite(numeric), message);
  return numeric;
};

const getCreatedTaskId = (responsePayload: unknown, message: string): number => {
  const payload = asRecord(responsePayload);
  const data = asRecord(payload.data);

  if ("id" in data) {
    return asNumber(data.id, message);
  }

  if ("task" in data) {
    const task = asRecord(data.task);
    return asNumber(task.id, message);
  }

  throw new Error(message);
};

const fetchJson = async (
  baseUrl: string,
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    expectedStatus?: number | number[];
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

  const expectedStatuses = Array.isArray(options.expectedStatus)
    ? options.expectedStatus
    : [options.expectedStatus ?? 200];
  const rawText = await response.text();
  const payload = rawText ? JSON.parse(rawText) : null;

  if (!expectedStatuses.includes(response.status)) {
    throw new Error(
      `Unexpected status for ${options.method ?? "GET"} ${path}. Expected ${expectedStatuses.join(" | ")}, got ${response.status}. Payload: ${rawText}`,
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
  const employeeAlphaJar = new CookieJar();
  const employeeBetaJar = new CookieJar();
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const employeeAlphaEmail = `qa.employee.alpha.${suffix}@taskapp.local`;
  const employeeBetaEmail = `qa.employee.beta.${suffix}@taskapp.local`;

  let adminUserId = 0;
  let areaMainId = 0;
  let areaOtherId = 0;
  let areaInactiveId = 0;

  let employeeAlphaId = 0;
  let employeeBetaId = 0;

  let projectMainId = 0;

  let membershipAlphaId = 0;
  let membershipBetaId = 0;

  let taskAlphaId = 0;
  let taskBetaId = 0;
  let taskUnassignedId = 0;

  let restoredAdminName = "";

  try {
    await step("health endpoint", async () => {
      const payload = asRecord(await fetchJson(baseUrl, "/health"));
      assertCondition(payload.status === "ok", "Health status must be ok");
    });

    await step("auth status and docs endpoints", async () => {
      await fetchJson(baseUrl, "/api/auth/status");
      const docsResponse = await fetch(`${baseUrl}/api/docs`, {
        headers: {
          origin: DEFAULT_ORIGIN,
        },
      });
      assertCondition(docsResponse.status === 200, "Docs endpoint should return 200");
    });

    await step("session unauthenticated", async () => {
      const payload = asRecord(await fetchJson(baseUrl, "/api/auth/session"));
      assertCondition(payload.authenticated === false, "Session should be unauthenticated before login");
    });

    await step("invalid credentials return auth error", async () => {
      await fetchJson(baseUrl, "/api/auth/handler/sign-in/email", {
        method: "POST",
        expectedStatus: [400, 401, 403],
        body: {
          email: "admin@taskapp.local",
          password: "invalid-password",
          rememberMe: true,
        },
      });
    });

    await step("protected route without auth returns 401", async () => {
      await fetchJson(baseUrl, "/api/projects", { expectedStatus: 401 });
      await fetchJson(baseUrl, "/api/route-does-not-exist", { expectedStatus: 404 });
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
      const sessionData = asRecord(payload.data);
      const user = asRecord(sessionData.user);
      adminUserId = asNumber(user.id, "Expected authenticated admin user id");
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

    await step("areas endpoints cover CRUD + validation", async () => {
      await fetchJson(baseUrl, "/api/areas?status=unexpected", {
        jar: adminJar,
        expectedStatus: 400,
      });

      const areasResponse = asRecord(await fetchJson(baseUrl, "/api/areas?status=active", { jar: adminJar }));
      const areas = asArray(areasResponse.data);
      assertCondition(areas.length > 0, "Expected at least one active area from seeds");

      const mainArea = asRecord(await fetchJson(baseUrl, "/api/areas", {
        method: "POST",
        jar: adminJar,
        expectedStatus: 201,
        body: {
          name: `QA Main Area ${suffix}`,
          description: "Area principal para escenarios E2E",
          isActive: true,
        },
      }));
      areaMainId = asNumber(asRecord(mainArea.data).id, "Expected created main area id");

      const otherArea = asRecord(await fetchJson(baseUrl, "/api/areas", {
        method: "POST",
        jar: adminJar,
        expectedStatus: 201,
        body: {
          name: `QA Other Area ${suffix}`,
          description: "Area secundaria para validar mismatch",
          isActive: true,
        },
      }));
      areaOtherId = asNumber(asRecord(otherArea.data).id, "Expected created secondary area id");

      const inactiveArea = asRecord(await fetchJson(baseUrl, "/api/areas", {
        method: "POST",
        jar: adminJar,
        expectedStatus: 201,
        body: {
          name: `QA Inactive Area ${suffix}`,
          description: "Area inactiva para validar restricciones",
          isActive: false,
        },
      }));
      areaInactiveId = asNumber(asRecord(inactiveArea.data).id, "Expected created inactive area id");

      await fetchJson(baseUrl, "/api/areas", {
        method: "POST",
        jar: adminJar,
        expectedStatus: 409,
        body: {
          name: `QA Main Area ${suffix}`,
          description: "Intento duplicado",
        },
      });

      await fetchJson(baseUrl, `/api/areas/${areaMainId}`, { jar: adminJar });

      await fetchJson(baseUrl, `/api/areas/${areaMainId}`, {
        method: "PATCH",
        jar: adminJar,
        body: { description: "Area principal actualizada en pruebas E2E" },
      });
    });

    await step("employees endpoints cover CRUD + validation + assignments", async () => {
      await fetchJson(baseUrl, "/api/employees", {
        method: "POST",
        jar: adminJar,
        expectedStatus: 400,
        body: {
          name: "Invalid Email",
          email: `invalid-email-${suffix}`,
          password: "Password123!",
        },
      });

      const createdEmployeeAlpha = asRecord(await fetchJson(baseUrl, "/api/employees", {
        method: "POST",
        jar: adminJar,
        expectedStatus: 201,
        body: {
          name: `QA Employee Alpha ${suffix}`,
          email: employeeAlphaEmail,
          password: "Alpha123!",
          emailVerified: true,
        },
      }));
      employeeAlphaId = asNumber(asRecord(createdEmployeeAlpha.data).id, "Expected alpha employee id");

      const createdEmployeeBeta = asRecord(await fetchJson(baseUrl, "/api/employees", {
        method: "POST",
        jar: adminJar,
        expectedStatus: 201,
        body: {
          name: `QA Employee Beta ${suffix}`,
          email: employeeBetaEmail,
          password: "Beta12345!",
          emailVerified: true,
        },
      }));
      employeeBetaId = asNumber(asRecord(createdEmployeeBeta.data).id, "Expected beta employee id");

      await fetchJson(baseUrl, "/api/employees", {
        method: "POST",
        jar: adminJar,
        expectedStatus: 409,
        body: {
          name: `QA Employee Alpha Duplicate ${suffix}`,
          email: employeeAlphaEmail,
          password: "Alpha123!",
        },
      });

      await fetchJson(baseUrl, `/api/employees/${employeeAlphaId}`, { jar: adminJar });

      await fetchJson(baseUrl, `/api/employees/${employeeAlphaId}`, {
        method: "PATCH",
        jar: adminJar,
        body: {
          phoneNumber: "+573009998877",
        },
      });

      await fetchJson(baseUrl, `/api/employees/${employeeAlphaId}/area-assignments`, {
        method: "POST",
        jar: adminJar,
        expectedStatus: 201,
        body: { areaId: areaMainId },
      });

      await fetchJson(baseUrl, `/api/employees/${employeeAlphaId}/area-assignments`, {
        method: "POST",
        jar: adminJar,
        expectedStatus: 409,
        body: { areaId: areaMainId },
      });

      await fetchJson(baseUrl, `/api/employees/${employeeAlphaId}/area-assignments`, {
        method: "POST",
        jar: adminJar,
        expectedStatus: 409,
        body: { areaId: areaInactiveId },
      });

      await fetchJson(baseUrl, `/api/employees/${employeeBetaId}/area-assignments`, {
        method: "POST",
        jar: adminJar,
        expectedStatus: 201,
        body: { areaId: areaOtherId },
      });

      await fetchJson(baseUrl, `/api/employees/${employeeAlphaId}/area-assignments?status=all`, { jar: adminJar });
      await fetchJson(baseUrl, `/api/employees/${employeeAlphaId}/project-memberships?status=all`, { jar: adminJar });
    });

    await step("projects endpoints cover CRUD + lifecycle", async () => {
      await fetchJson(baseUrl, "/api/projects?status=unexpected", {
        jar: adminJar,
        expectedStatus: 400,
      });

      await fetchJson(baseUrl, "/api/projects?status=all", { jar: adminJar });

      await fetchJson(baseUrl, "/api/projects", {
        method: "POST",
        jar: adminJar,
        expectedStatus: 400,
        body: {
          areaId: areaMainId,
          name: `QA Invalid Dates ${suffix}`,
          startDate: "2026-03-20",
          endDate: "2026-03-01",
        },
      });

      const createdProject = asRecord(await fetchJson(baseUrl, "/api/projects", {
        method: "POST",
        jar: adminJar,
        expectedStatus: 201,
        body: {
          areaId: areaMainId,
          name: `QA Project Main ${suffix}`,
          description: "Proyecto principal para pruebas E2E",
          startDate: "2026-03-01",
          endDate: "2026-03-30",
        },
      }));
      projectMainId = asNumber(asRecord(createdProject.data).id, "Expected project id");

      await fetchJson(baseUrl, "/api/projects", {
        method: "POST",
        jar: adminJar,
        expectedStatus: 409,
        body: {
          areaId: areaMainId,
          name: `QA Project Main ${suffix}`,
          description: "Intento duplicado",
          startDate: "2026-03-02",
        },
      });

      const projectWithoutDependencies = asRecord(await fetchJson(baseUrl, "/api/projects", {
        method: "POST",
        jar: adminJar,
        expectedStatus: 201,
        body: {
          areaId: areaMainId,
          name: `QA Project Empty ${suffix}`,
          description: "Proyecto para validar borrado fisico",
        },
      }));
      const projectWithoutDependenciesId = asNumber(
        asRecord(projectWithoutDependencies.data).id,
        "Expected empty project id",
      );

      const deleteEmptyProject = asRecord(await fetchJson(
        baseUrl,
        `/api/projects/${projectWithoutDependenciesId}`,
        {
          method: "DELETE",
          jar: adminJar,
        },
      ));
      const deleteEmptyProjectData = asRecord(deleteEmptyProject.data);
      assertCondition(
        deleteEmptyProjectData.mode === "deleted",
        "Expected empty project deletion mode to be deleted",
      );

      await fetchJson(baseUrl, `/api/projects/${projectMainId}`, { jar: adminJar });

      await fetchJson(baseUrl, `/api/projects/${projectMainId}`, {
        method: "PATCH",
        jar: adminJar,
        body: {
          description: "Proyecto principal actualizado E2E",
        },
      });

      await fetchJson(baseUrl, `/api/projects/${projectMainId}/status`, {
        method: "PATCH",
        jar: adminJar,
        body: { status: "active" },
      });
    });

    await step("project memberships cover assign/reassign/unassign cases", async () => {
      await fetchJson(baseUrl, `/api/projects/${projectMainId}/memberships`, {
        method: "POST",
        jar: adminJar,
        expectedStatus: 409,
        body: { employeeId: employeeBetaId },
      });

      const createdMembershipAlpha = asRecord(await fetchJson(
        baseUrl,
        `/api/projects/${projectMainId}/memberships`,
        {
          method: "POST",
          jar: adminJar,
          expectedStatus: 201,
          body: { employeeId: employeeAlphaId },
        },
      ));
      membershipAlphaId = asNumber(
        asRecord(createdMembershipAlpha.data).id,
        "Expected project membership for employee alpha",
      );

      await fetchJson(baseUrl, `/api/projects/${projectMainId}/memberships`, {
        method: "POST",
        jar: adminJar,
        expectedStatus: 409,
        body: { employeeId: employeeAlphaId },
      });

      await fetchJson(
        baseUrl,
        `/api/projects/${projectMainId}/memberships/${membershipAlphaId}/reassign`,
        {
          method: "PATCH",
          jar: adminJar,
          expectedStatus: 409,
          body: { toEmployeeId: employeeAlphaId },
        },
      );

      await fetchJson(baseUrl, `/api/employees/${employeeBetaId}/area-assignments`, {
        method: "POST",
        jar: adminJar,
        expectedStatus: 201,
        body: { areaId: areaMainId },
      });

      const reassigned = asRecord(await fetchJson(
        baseUrl,
        `/api/projects/${projectMainId}/memberships/${membershipAlphaId}/reassign`,
        {
          method: "PATCH",
          jar: adminJar,
          body: { toEmployeeId: employeeBetaId },
        },
      ));
      membershipBetaId = asNumber(
        asRecord(asRecord(reassigned.data).toMembership).id,
        "Expected reassigned membership for employee beta",
      );

      const createdMembershipAlphaAgain = asRecord(await fetchJson(
        baseUrl,
        `/api/projects/${projectMainId}/memberships`,
        {
          method: "POST",
          jar: adminJar,
          expectedStatus: 201,
          body: { employeeId: employeeAlphaId },
        },
      ));
      membershipAlphaId = asNumber(
        asRecord(createdMembershipAlphaAgain.data).id,
        "Expected fresh active membership for employee alpha",
      );

      await fetchJson(baseUrl, `/api/projects/${projectMainId}/memberships?status=all`, { jar: adminJar });
      await fetchJson(baseUrl, `/api/employees/${employeeAlphaId}/project-memberships?status=active`, {
        jar: adminJar,
      });
    });

    await step("tasks endpoints cover CRUD + workflow + role restrictions", async () => {
      await fetchJson(baseUrl, "/api/tasks?status=unknown", {
        jar: adminJar,
        expectedStatus: 400,
      });

      await fetchJson(baseUrl, "/api/tasks", {
        method: "POST",
        jar: adminJar,
        expectedStatus: 400,
        body: {
          projectId: projectMainId,
          title: `QA Task Invalid Dates ${suffix}`,
          plannedStartDate: "2026-03-10",
          dueDate: "2026-03-08",
          taskPriorityId: 2,
        },
      });

      await fetchJson(baseUrl, "/api/tasks", {
        method: "POST",
        jar: adminJar,
        expectedStatus: 404,
        body: {
          projectId: projectMainId,
          title: `QA Task Invalid Priority ${suffix}`,
          plannedStartDate: "2026-03-02",
          dueDate: "2026-03-08",
          taskPriorityId: 99999,
          assigneeMembershipId: membershipAlphaId,
        },
      });

      const unassignedTask = await fetchJson(baseUrl, "/api/tasks", {
        method: "POST",
        jar: adminJar,
        expectedStatus: 201,
        body: {
          projectId: projectMainId,
          title: `QA Task Unassigned ${suffix}`,
          description: "No tiene assignee activo",
          plannedStartDate: "2026-03-01",
          dueDate: "2026-03-10",
          taskPriorityId: 2,
          assigneeMembershipId: null,
          estimatedMinutes: 30,
        },
      });
      taskUnassignedId = getCreatedTaskId(unassignedTask, "Expected unassigned task id");

      await fetchJson(baseUrl, `/api/tasks/${taskUnassignedId}/status`, {
        method: "PATCH",
        jar: adminJar,
        expectedStatus: 409,
        body: { toStatus: "in_progress" },
      });

      const firstTask = await fetchJson(baseUrl, "/api/tasks", {
        method: "POST",
        jar: adminJar,
        expectedStatus: 201,
        body: {
          projectId: projectMainId,
          title: `QA Task Primary ${suffix}`,
          description: "Tarea primaria para validar flujo",
          plannedStartDate: "2026-03-02",
          dueDate: "2026-03-08",
          taskPriorityId: 2,
          assigneeMembershipId: membershipAlphaId,
          estimatedMinutes: 120,
        },
      });
      taskAlphaId = getCreatedTaskId(firstTask, "Expected task alpha id");

      const secondTask = await fetchJson(baseUrl, "/api/tasks", {
        method: "POST",
        jar: adminJar,
        expectedStatus: 201,
        body: {
          projectId: projectMainId,
          title: `QA Task Beta ${suffix}`,
          description: "Tarea para validar flujo beta",
          plannedStartDate: "2026-03-03",
          dueDate: "2026-03-09",
          taskPriorityId: 3,
          assigneeMembershipId: membershipBetaId,
          estimatedMinutes: 90,
        },
      });
      taskBetaId = getCreatedTaskId(secondTask, "Expected task beta id");

      const taskAlphaPayload = asRecord(await fetchJson(baseUrl, `/api/tasks/${taskAlphaId}`, { jar: adminJar }));
      const taskAlphaData = asRecord(taskAlphaPayload.data);
      assertCondition(
        Object.hasOwn(taskAlphaData, "actualMinutes")
          && Object.hasOwn(taskAlphaData, "deviationMinutes")
          && Object.hasOwn(taskAlphaData, "isEstimateDelayed")
          && Object.hasOwn(taskAlphaData, "isDateOverdue")
          && Object.hasOwn(taskAlphaData, "completedAt")
          && Object.hasOwn(taskAlphaData, "hasOpenWorkSession"),
        "Task DTO is missing expected metrics fields",
      );

      await fetchJson(baseUrl, `/api/tasks/${taskAlphaId}`, {
        method: "PATCH",
        jar: adminJar,
        body: {
          description: "Tarea primaria actualizada",
          estimatedMinutes: 150,
        },
      });

      await fetchJson(baseUrl, `/api/tasks/${taskAlphaId}/status`, {
        method: "PATCH",
        jar: adminJar,
        expectedStatus: 409,
        body: {
          toStatus: "done",
          actualMinutes: 45,
          notes: "Transicion invalida directa a done",
        },
      });

      await fetchJson(
        baseUrl,
        `/api/tasks?projectId=${projectMainId}&status=all&includeDeleted=false`,
        { jar: adminJar },
      );
    });

    await step("employee beta permissions and transitions", async () => {
      await fetchJson(baseUrl, "/api/auth/handler/sign-in/email", {
        method: "POST",
        jar: employeeBetaJar,
        body: {
          email: employeeBetaEmail,
          password: "Beta12345!",
          rememberMe: true,
        },
      });

      await fetchJson(baseUrl, "/api/auth/access/admin", {
        jar: employeeBetaJar,
        expectedStatus: 403,
      });
      await fetchJson(baseUrl, "/api/auth/access/employee", {
        jar: employeeBetaJar,
      });

      await fetchJson(baseUrl, "/api/areas", {
        jar: employeeBetaJar,
        expectedStatus: 403,
      });

      await fetchJson(baseUrl, "/api/analytics/dashboard/admin", {
        jar: employeeBetaJar,
        expectedStatus: 403,
      });

      await fetchJson(baseUrl, "/api/analytics/dashboard/employee", { jar: employeeBetaJar });

      await fetchJson(baseUrl, `/api/tasks/${taskAlphaId}/status`, {
        method: "PATCH",
        jar: employeeBetaJar,
        expectedStatus: 403,
        body: { toStatus: "in_progress", notes: "Intento no autorizado" },
      });

      await fetchJson(baseUrl, `/api/tasks/${taskBetaId}/status`, {
        method: "PATCH",
        jar: employeeBetaJar,
        body: { toStatus: "in_progress", notes: "Inicio employee beta" },
      });

      await fetchJson(baseUrl, "/api/auth/handler/sign-out", {
        method: "POST",
        jar: employeeBetaJar,
      });
    });

    await step("employee alpha transitions + notifications", async () => {
      await fetchJson(baseUrl, "/api/auth/handler/sign-in/email", {
        method: "POST",
        jar: employeeAlphaJar,
        body: {
          email: employeeAlphaEmail,
          password: "Alpha123!",
          rememberMe: true,
        },
      });

      await fetchJson(baseUrl, `/api/tasks/${taskAlphaId}/status`, {
        method: "PATCH",
        jar: employeeAlphaJar,
        body: { toStatus: "in_progress", notes: "Inicio employee alpha" },
      });

      await fetchJson(baseUrl, `/api/tasks/${taskAlphaId}/status`, {
        method: "PATCH",
        jar: employeeAlphaJar,
        body: {
          toStatus: "done",
          actualMinutes: 165,
          notes: "Cierre employee alpha",
        },
      });

      const historyResponse = asRecord(await fetchJson(baseUrl, `/api/tasks/${taskAlphaId}/history`, {
        jar: employeeAlphaJar,
      }));
      const historyEntries = asArray(historyResponse.data).map(asRecord);
      assertCondition(historyEntries.length >= 3, "Expected task history entries for full workflow");

      for (let index = 1; index < historyEntries.length; index += 1) {
        const previousEntry = historyEntries[index - 1];
        const currentEntry = historyEntries[index];
        assertCondition(
          previousEntry !== undefined && currentEntry !== undefined,
          "History entries are required for chronology validation",
        );
        const previousChangedAt = String(previousEntry.changedAt);
        const currentChangedAt = String(currentEntry.changedAt);
        assertCondition(
          Date.parse(currentChangedAt) >= Date.parse(previousChangedAt),
          "Task history must be ordered ascending by changedAt",
        );
      }

      const notificationsResponse = asRecord(await fetchJson(
        baseUrl,
        "/api/notifications?status=all&limit=100",
        { jar: employeeAlphaJar },
      ));
      const notificationsData = asRecord(notificationsResponse.data);
      const notifications = asArray(notificationsData.notifications).map(asRecord);
      assertCondition(notifications.length > 0, "Expected generated notifications for employee alpha");
      const firstNotification = notifications[0];
      assertCondition(firstNotification !== undefined, "Expected first notification record");

      const firstNotificationId = asNumber(
        firstNotification.id,
        "Expected first notification id for employee alpha",
      );

      await fetchJson(baseUrl, `/api/notifications/${firstNotificationId}/read`, {
        method: "PATCH",
        jar: employeeAlphaJar,
      });

      await fetchJson(baseUrl, "/api/notifications/99999999/read", {
        method: "PATCH",
        jar: employeeAlphaJar,
        expectedStatus: 404,
      });

      await fetchJson(baseUrl, "/api/notifications/read-all", {
        method: "PATCH",
        jar: employeeAlphaJar,
      });

      const unreadAfterMarkAll = asRecord(await fetchJson(
        baseUrl,
        "/api/notifications?status=unread&limit=100",
        { jar: employeeAlphaJar },
      ));
      const unreadData = asRecord(unreadAfterMarkAll.data);
      assertCondition(
        asNumber(unreadData.unreadCount, "Expected unreadCount value") === 0,
        "Expected all notifications to be marked as read",
      );

      await fetchJson(baseUrl, "/api/auth/handler/sign-out", {
        method: "POST",
        jar: employeeAlphaJar,
      });
    });

    await step("admin-only analytics endpoints", async () => {
      const dashboard = asRecord(await fetchJson(baseUrl, "/api/analytics/dashboard/admin", { jar: adminJar }));
      const dashboardData = asRecord(dashboard.data);
      assertCondition(Object.hasOwn(dashboardData, "teamSummary"), "Expected teamSummary in admin dashboard");

      await fetchJson(baseUrl, "/api/analytics/reports/compliance?limit=20&compliance=all", { jar: adminJar });
      await fetchJson(baseUrl, "/api/analytics/alerts/overdue?limit=20", { jar: adminJar });
      await fetchJson(baseUrl, "/api/analytics/reports/compliance?limit=0", {
        jar: adminJar,
        expectedStatus: 400,
      });
    });

    await step("task transition validation and cleanup checks", async () => {
      await prisma.taskWorkSession.updateMany({
        where: {
          taskId: taskBetaId,
          endedAt: null,
        },
        data: {
          endedAt: new Date(),
          endedByUserId: adminUserId,
        },
      });

      await fetchJson(baseUrl, `/api/tasks/${taskBetaId}/status`, {
        method: "PATCH",
        jar: adminJar,
        expectedStatus: 200,
        body: {
          toStatus: "done",
          actualMinutes: 120,
          notes: "Intento sin sesion abierta",
        },
      });
    });

    await step("admin cleanup operations and archival expectations", async () => {
      await fetchJson(baseUrl, `/api/tasks/${taskAlphaId}`, {
        method: "DELETE",
        jar: adminJar,
      });
      await fetchJson(baseUrl, `/api/tasks/${taskBetaId}`, {
        method: "DELETE",
        jar: adminJar,
      });
      await fetchJson(baseUrl, `/api/tasks/${taskUnassignedId}`, {
        method: "DELETE",
        jar: adminJar,
      });

      await fetchJson(baseUrl, `/api/tasks/${taskAlphaId}`, {
        method: "DELETE",
        jar: adminJar,
      });

      await fetchJson(
        baseUrl,
        `/api/projects/${projectMainId}/memberships/${membershipAlphaId}/unassign`,
        {
          method: "PATCH",
          jar: adminJar,
        },
      );

      await fetchJson(
        baseUrl,
        `/api/projects/${projectMainId}/memberships/${membershipBetaId}/unassign`,
        {
          method: "PATCH",
          jar: adminJar,
        },
      );

      const projectDeleteResult = asRecord(await fetchJson(baseUrl, `/api/projects/${projectMainId}`, {
        method: "DELETE",
        jar: adminJar,
      }));
      const projectDeleteData = asRecord(projectDeleteResult.data);
      assertCondition(
        projectDeleteData.mode === "archived" || projectDeleteData.mode === "deleted",
        "Expected project deletion mode to be archived or deleted",
      );

      await fetchJson(baseUrl, `/api/employees/${employeeAlphaId}/area-assignments`, {
        method: "POST",
        jar: adminJar,
        expectedStatus: 201,
        body: { areaId: areaOtherId },
      });
      await fetchJson(baseUrl, `/api/employees/${employeeBetaId}/area-assignments`, {
        method: "POST",
        jar: adminJar,
        expectedStatus: 201,
        body: { areaId: areaOtherId },
      });

      await fetchJson(baseUrl, `/api/areas/${areaInactiveId}`, { method: "DELETE", jar: adminJar });

      const mainAreaDeleteAfterReassign = asRecord(await fetchJson(baseUrl, `/api/areas/${areaMainId}`, {
        method: "DELETE",
        jar: adminJar,
      }));
      assertCondition(
        ["archived", "deleted"].includes(String(asRecord(mainAreaDeleteAfterReassign.data).mode)),
        "Expected main area deletion mode to be archived or deleted after reassignment",
      );

      if (restoredAdminName) {
        await fetchJson(baseUrl, "/api/me", {
          method: "PATCH",
          jar: adminJar,
          body: { name: restoredAdminName },
        });
      }

      await fetchJson(baseUrl, "/api/auth/handler/sign-out", { method: "POST", jar: adminJar });
      const payload = asRecord(await fetchJson(baseUrl, "/api/auth/session", { jar: adminJar }));
      assertCondition(payload.authenticated === false, "Session should be closed after sign-out");
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
