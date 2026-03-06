export type AuthRole = "admin" | "employee";

export type AuthResource =
  | "dashboard"
  | "projects"
  | "projectBoard"
  | "members";

const ROLE_POLICIES: Record<AuthRole, AuthResource[]> = {
  admin: ["dashboard", "projects", "projectBoard", "members"],
  employee: ["dashboard", "projects", "projectBoard"],
};

export const getAllowedResourcesByRole = (role: AuthRole): AuthResource[] =>
  ROLE_POLICIES[role];

export const canAccessResource = (
  role: AuthRole,
  resource: AuthResource,
): boolean => ROLE_POLICIES[role].includes(resource);

