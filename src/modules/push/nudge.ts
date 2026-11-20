/**
 * Tiny hook for write paths (repositories): "a status may have changed, run
 * the push sweep soon". Throttled inside; never throws; no heavy imports here.
 */
export function nudgePush(patch?: object | null): void {
  if (patch && !["status", "refund", "prasad", "payment", "fulfillment"].some((k) => k in patch)) return;
  void import("./push.service").then((m) => m.pushService.maybeSweep(3_000)).catch(() => undefined);
}
