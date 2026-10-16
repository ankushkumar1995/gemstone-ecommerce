/**
 * /api/v1/roles  (admin)
 *   GET → list available roles (preset) with their permissions
 */

import { handle } from "@/core/http";
import { userController } from "@/modules/users";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(() => userController.listRoles());
}
