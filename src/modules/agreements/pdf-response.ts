import "server-only";

import { NextResponse } from "next/server";
import type { ApiResponse } from "@/core/http";
import type { PdfFile } from "./agreement.service";

/**
 * A PDF download response (private, never cached). Typed as an API response
 * only so it fits the shared `handle()` wrapper; the body is the PDF bytes.
 */
export function pdfResponse(file: PdfFile, inline = false): NextResponse<ApiResponse<never>> {
  return new NextResponse(Buffer.from(file.bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(file.bytes.byteLength),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${file.filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
      "X-Copy-Source": file.source,
    },
  }) as NextResponse<ApiResponse<never>>;
}
