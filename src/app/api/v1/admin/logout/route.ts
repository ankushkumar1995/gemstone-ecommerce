import { handle } from "@/core/http";
import { adminAuthController } from "@/modules/admin-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  return handle(() => adminAuthController.logout());
}
