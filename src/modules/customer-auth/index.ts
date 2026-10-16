/** Customer-auth module — public API. */
export { customerAuthService } from "./customer-auth.service";
export type { CustomerPublic, AuthResult, AuthTokens } from "./customer-auth.service";
export { customerAccountService, type AddressInput } from "./customer-account.service";
export { requireCustomer } from "./guard";
export {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  type RegisterDto,
  type LoginDto,
  type ChangePasswordDto,
  type ForgotPasswordDto,
  type ResetPasswordDto,
} from "./customer-auth.schema";
export {
  updateProfileSchema,
  addressSchema,
  wishlistSchema,
  type UpdateProfileDto,
  type AddressDto,
  type WishlistDto,
} from "./customer-account.schema";
