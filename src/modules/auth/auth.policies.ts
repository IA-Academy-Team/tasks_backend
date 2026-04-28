export type AuthRole = "admin" | "employee" | "leader";

export type AuthResource =
  | "dashboard"
  | "areas"
  | "employees"
  | "projects"
  | "projectBoard"
  | "profile"
  | "members";

const ROLE_POLICIES: Record<AuthRole, AuthResource[]> = {
  admin: ["dashboard", "areas", "employees", "projects", "projectBoard", "profile", "members"],
  employee: ["dashboard", "projects", "projectBoard", "profile"],
  leader: ["dashboard", "projects", "projectBoard", "profile"],
};

export const getAllowedResourcesByRole = (role: AuthRole): AuthResource[] =>
  ROLE_POLICIES[role];

export const canAccessResource = (
  role: AuthRole,
  resource: AuthResource,
): boolean => ROLE_POLICIES[role].includes(resource);
