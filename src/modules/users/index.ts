/** Users / RBAC module — public API. */
export { userController } from "./user.controller";
export { userService, type Actor, type CreatedUser } from "./user.service";
export { roleRepository } from "./role.repository";
export { getUserRepository } from "./user.repository";
export {
  createUserSchema,
  updateUserSchema,
  setStatusSchema,
  type CreateUserDto,
  type UpdateUserDto,
  type SetStatusDto,
} from "./user.schema";
export {
  RESOURCES,
  ACTIONS,
  RESOURCE_LABELS,
  PRESET_ROLES,
  can,
  canView,
  hasPermission,
  expandPermissions,
  findPresetRole,
} from "./rbac";
export type {
  Action,
  Resource,
  Permission,
  Role,
  AdminUser,
  ResolvedUser,
  UserStatus,
} from "./user.types";
