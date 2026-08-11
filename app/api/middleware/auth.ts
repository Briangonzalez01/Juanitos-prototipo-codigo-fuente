import { env } from "../env";

type User = { id: string; role: string };
type User = { id: string; role: string; allowedAreas?: string[] };

export function getUser(request?: Request, payload?: Record<string, unknown>): User {
  // Stub: prefer explicit headers, then payload, then default dev user
  const roleHeader = request?.headers.get("x-user-role") ?? (payload && typeof payload.userRole === "string" ? String(payload.userRole) : null);
  const idHeader = request?.headers.get("x-user-id") ?? (payload && typeof payload.userId === "string" ? String(payload.userId) : null);
  const areasHeader = request?.headers.get("x-user-areas") ?? null; // comma separated names
  const role = roleHeader ?? (env.NODE_ENV === "production" ? "user" : "dev");
  const id = idHeader ?? "local-dev";
  const allowedAreas = areasHeader ? areasHeader.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
  return { id, role, allowedAreas };
}

function isAdminRole(role: string) {
  return role === "admin" || role === "dev";
}

export function requireUser(request?: Request, payload?: Record<string, unknown>) {
  const user = getUser(request, payload);
  if (!user.role) throw new Error("FORBIDDEN");
  return user;
}

export function requireAdmin(request?: Request, payload?: Record<string, unknown>) {
  const user = getUser(request, payload);
  if (!isAdminRole(user.role)) throw new Error("FORBIDDEN");
  return user;
}

export default { getUser, requireUser, requireAdmin };
