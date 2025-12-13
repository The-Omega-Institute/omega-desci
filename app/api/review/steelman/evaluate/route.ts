import { NextResponse } from "next/server";
import type { Paper } from "@/lib/mockData";
import type {
  DefenseEvaluation,
  DefenseResponse,
  SteelmanAttackSet,
} from "@/lib/review/steelman";
import { evaluateDefenseResponses } from "@/lib/review/steelman";

export const runtime = "nodejs";

type RequestBody = {
  paper: Paper;
  attackSet: SteelmanAttackSet;
  responses: DefenseResponse[];
  engine?: "auto" | "simulated";
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

async function generateGeminiDefenseEval(args: {
  apiKey: string;
  paper: Paper;
  attackSet: SteelmanAttackSet;
  responses: DefenseResponse[];
}): Promise<Omit<DefenseEvaluation, "id" | "createdAt" | "paperId" | "engine" | "model">> {
  const { apiKey, paper, attackSet, responses } = args;

  const prompt = [
    "You are evaluating an author defense against steelman attacks.",
    "Goal: quantify response quality per attack and overall, focusing on evidence alignment and executable counter-tests.",
    "Do NOT assume access to the full PDF; use only the provided record info + author responses.",
    "",
    "Return ONLY valid JSON (no markdown, no extra text).",
    "Verdicts: pass | needs_evidence | fail | na. Scores: 0.0..1.0",
    "",
    "JSON schema:",
    "{",
    '  "rubricVersion": "steelman-defense-v1",',
    '  "overallScore": 0.0,',
    '  "summary": { "verdict": "needs_evidence", "oneLine": "..." },',
    '  "items": [',
    '    { "attackId": "atk-1", "verdict": "needs_evidence", "score": 0.0, "rationale": "...", "evidenceUsed": ["..."], "proposedTests": ["..."], "missing": ["..."] }',
    "  ]",
    "}",
    "",
    "Scoring guidance (be strict):",
    "- Missing response -> fail, score 0.0",
    "- Evidence links/citations and explicit boundaries increase score",
    "- Counter-tests / thresholds / controls increase score",
    "- Handwavy responses without tests should be needs_evidence",
    "",
    "Paper record:",
    `- Title: ${paper.title}`,
    `- DOI: ${paper.doi}`,
    `- Abstract: ${paper.abstract || "N/A"}`,
    `- Code: ${paper.codeAvailable ? "yes" : "no"}${paper.codeUrl ? ` (${paper.codeUrl})` : ""}`,
    `- Data: ${paper.dataAvailable ? "yes" : "no"}`,
    `- Falsifiability: ${paper.falsifiabilityPath || "N/A"}`,
    "",
    "Attacks:",
    JSON.stringify(attackSet.attacks),
    "",
    "Author responses:",
    JSON.stringify(responses),
  ].join("\n");

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1400 },
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

  return parsed as Omit<DefenseEvaluation, "id" | "createdAt" | "paperId" | "engine" | "model">;
}

export async function POST(request: Request) {
  let body: RequestBody | null = null;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const paper = body?.paper;
  const attackSet = body?.attackSet;
  const responses = body?.responses;
  if (!paper || typeof paper !== "object" || !paper.id || !paper.title) {
    return NextResponse.json({ error: "Missing paper payload." }, { status: 400 });
  }
  if (!attackSet || typeof attackSet !== "object" || !Array.isArray(attackSet.attacks)) {
    return NextResponse.json({ error: "Missing attackSet payload." }, { status: 400 });
  }
  if (!Array.isArray(responses)) {
    return NextResponse.json({ error: "Missing responses payload." }, { status: 400 });
  }

  const engine = body.engine || "auto";
  const apiKey = process.env.GEMINI_API_KEY?.trim() || "";

  if (engine === "simulated" || !apiKey) {
    const evaluation = evaluateDefenseResponses({ paper, attackSet, responses });
    return NextResponse.json({ evaluation }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const generated = await generateGeminiDefenseEval({ apiKey, paper, attackSet, responses });
    if (
      !generated ||
      (generated as DefenseEvaluation).rubricVersion !== "steelman-defense-v1" ||
      !Array.isArray((generated as DefenseEvaluation).items)
    ) {
      throw new Error("Gemini output does not match schema.");
    }

    const evaluation: DefenseEvaluation = {
      ...(generated as DefenseEvaluation),
      id: makeId("defense"),
      paperId: paper.id,
      createdAt: new Date().toISOString(),
      engine: "gemini",
      model: "gemini-1.5-flash",
    };

    return NextResponse.json({ evaluation }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    const evaluation = evaluateDefenseResponses({ paper, attackSet, responses });
    return NextResponse.json({ evaluation }, { headers: { "Cache-Control": "no-store" } });
  }
}

