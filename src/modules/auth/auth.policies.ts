export type AuthRole = "admin" | "employee";

export type AuthResource =
  | "dashboard"
  | "projects"
  | "projectBoard"
  | "profile"
  | "members";

const ROLE_POLICIES: Record<AuthRole, AuthResource[]> = {
  admin: ["dashboard", "projects", "projectBoard", "profile", "members"],
  employee: ["dashboard", "projects", "projectBoard", "profile"],
};

export const getAllowedResourcesByRole = (role: AuthRole): AuthResource[] =>
  ROLE_POLICIES[role];

export const canAccessResource = (
  role: AuthRole,
  resource: AuthResource,
): boolean => ROLE_POLICIES[role].includes(resource);
