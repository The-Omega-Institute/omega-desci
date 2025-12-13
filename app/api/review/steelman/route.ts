import { NextResponse } from "next/server";
import type { Paper } from "@/lib/mockData";
import {
  generateMockSteelmanAttackSet,
  type SteelmanAttack,
  type SteelmanAttackSet,
} from "@/lib/review/steelman";
import type { EvidencePointer } from "@/lib/review/evidence";

export const runtime = "nodejs";

type RequestBody = {
  paper: Paper;
  engine?: "auto" | "simulated";
  userContext?: string;
  evidencePointers?: EvidencePointer[];
};

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
};

function safeJsonFromText(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const slice = text.slice(start, end + 1);
  try {
    return JSON.parse(slice) as unknown;
  } catch {
    return null;
  }
}

function makeId(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ? `${prefix}-${crypto.randomUUID()}` : `${prefix}-${Date.now()}`;
}

async function generateGeminiSteelmanAttacks(args: {
  apiKey: string;
  paper: Paper;
  userContext?: string;
  evidencePointers?: EvidencePointer[];
}): Promise<{ rubricVersion: "steelman-attack-v1"; attacks: SteelmanAttack[] }> {
  const { apiKey, paper } = args;
  const userContext = (args.userContext || "").trim();
  const evidencePointers = args.evidencePointers || [];

  const prompt = [
    "You are an adversarial reviewer for a DeSci publishing platform.",
    "Task: generate the strongest possible steelman critique (not a strawman) of the paper, using ONLY the provided record-level info.",
    "Each attack must include counter-tests that could falsify/resolve the concern.",
    "",
    "Return ONLY valid JSON (no markdown, no extra text).",
    "Allowed categories: value, falsifiability, evidence, robustness, leakage, reproducibility, causality, related, ethics.",
    "Allowed severities: low, medium, high.",
    "",
    "JSON schema:",
    "{",
    '  "rubricVersion": "steelman-attack-v1",',
    '  "attacks": [',
    '    { "id": "atk-1", "category": "falsifiability", "severity": "high", "title": "...", "target": "...", "attack": "...", "evidence": ["..."], "counterTests": ["..."] }',
    "  ]",
    "}",
    "",
    "Guidance:",
    "- Prefer auditability: cite phrases from abstract/metadata in evidence when possible.",
    "- If information is missing, say so and propose what evidence/test would resolve it.",
    "- Keep attacks actionable and specific; avoid moralizing or vague negativity.",
    "- Generate 6–8 attacks that cover the highest-risk failure modes.",
    "",
    "Record:",
    `- Title: ${paper.title}`,
    `- DOI: ${paper.doi}`,
    `- Authors: ${paper.authors.map((a) => a.name).join(", ")}`,
    `- Abstract/Description: ${paper.abstract || "N/A"}`,
    `- Code available: ${paper.codeAvailable ? "yes" : "no"}${paper.codeUrl ? ` (${paper.codeUrl})` : ""}`,
    `- Data available: ${paper.dataAvailable ? "yes" : "no"}`,
    `- Falsifiability path: ${paper.falsifiabilityPath || "N/A"}`,
    evidencePointers.length ? `- Evidence pointers (structured): ${JSON.stringify(evidencePointers)}` : "",
    userContext ? `- Additional author context: ${userContext}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1200 },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini API error (${res.status}): ${text || res.statusText}`);
  }

  const data = (await res.json()) as GeminiGenerateContentResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const parsed = safeJsonFromText(text);
  if (!parsed || typeof parsed !== "object") throw new Error("Gemini returned non-JSON output.");

  return parsed as { rubricVersion: "steelman-attack-v1"; attacks: SteelmanAttack[] };
}

export async function POST(request: Request) {
  let body: RequestBody | null = null;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const paper = body?.paper;
  if (!paper || typeof paper !== "object" || !paper.id || !paper.title) {
    return NextResponse.json({ error: "Missing paper payload." }, { status: 400 });
  }

  const engine = body.engine || "auto";
  const userContext = (body.userContext || "").trim();
  const evidencePointers = Array.isArray(body.evidencePointers) ? body.evidencePointers : [];
  const apiKey = process.env.GEMINI_API_KEY?.trim() || "";

  if (engine === "simulated" || !apiKey) {
    const attackSet = generateMockSteelmanAttackSet(paper, { userContext, evidencePointers });
    return NextResponse.json({ attackSet }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const generated = await generateGeminiSteelmanAttacks({ apiKey, paper, userContext, evidencePointers });
    if (
      !generated ||
      generated.rubricVersion !== "steelman-attack-v1" ||
      !Array.isArray(generated.attacks)
    ) {
      throw new Error("Gemini output does not match schema.");
    }

    const normalizedAttacks: SteelmanAttack[] = generated.attacks.slice(0, 8).map((a, idx) => ({
      id: typeof a.id === "string" && a.id.trim() ? a.id : `atk-${idx + 1}`,
      category: a.category,
      severity: a.severity,
      title: a.title,
      target: a.target,
      attack: a.attack,
      evidence: Array.isArray(a.evidence) ? a.evidence : [],
      counterTests: Array.isArray(a.counterTests) ? a.counterTests : [],
    }));

    const attackSet: SteelmanAttackSet = {
      id: makeId("atkset"),
      rubricVersion: "steelman-attack-v1",
      engine: "gemini",
      model: "gemini-1.5-flash",
      paperId: paper.id,
      createdAt: new Date().toISOString(),
      context: userContext || undefined,
      attacks: normalizedAttacks,
    };

    return NextResponse.json({ attackSet }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    const attackSet = generateMockSteelmanAttackSet(paper, { userContext, evidencePointers });
    return NextResponse.json({ attackSet }, { headers: { "Cache-Control": "no-store" } });
  }
}
