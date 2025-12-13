import { NextResponse } from "next/server";
import Ajv from "ajv/dist/2020";
import addFormats from "ajv-formats";
import schema from "@/lib/review/protocol/omega-review-protocol-v1.schema.json";

export const runtime = "nodejs";

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const ok = validate(body);
  if (!ok) {
    return NextResponse.json(
      {
        ok: false,
        errors: (validate.errors || []).map((e) => ({
          instancePath: e.instancePath,
          message: e.message,
          keyword: e.keyword,
          params: e.params,
        })),
      },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
