/** Admin auth module — public API. */
export { adminAuthController } from "./admin-auth.controller";
export { adminAuthService, COOKIE_NAME, ACCESS_COOKIE, REFRESH_COOKIE } from "./admin-auth.service";
export { requireAdmin, actorFromSession } from "./guard";
export type { AdminUser, AdminSession } from "./admin-auth.types";
