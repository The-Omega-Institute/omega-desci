import { NextResponse } from "next/server";
import schema from "@/lib/review/protocol/omega-review-protocol-v1.schema.json";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(schema, {
    headers: {
      "Cache-Control": "public, max-age=3600",
    },
  });
}

