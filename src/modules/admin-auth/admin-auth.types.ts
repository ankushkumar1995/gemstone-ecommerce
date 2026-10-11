/**
 * Admin auth domain — types.
 *
 * Kept intentionally small for the demo phase. In a later phase this becomes
 * a real users collection + hashed passwords + NextAuth. The shapes here are
 * what the rest of the admin app depends on.
 */

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "admin";
}

export interface AdminSession {
  user: AdminUser;
  /** epoch ms when the session expires */
  expiresAt: number;
}
