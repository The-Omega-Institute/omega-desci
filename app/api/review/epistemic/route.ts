import { NextResponse } from "next/server";
import type { Paper } from "@/lib/mockData";
import { generateMockEpistemicReview, type EpistemicReview } from "@/lib/review/epistemic";
import type { ClaimEvidence, EvidencePointer } from "@/lib/review/evidence";

export const runtime = "nodejs";

type RequestBody = {
  paper: Paper;
  engine?: "auto" | "simulated";
  userContext?: string;
  evidencePointers?: EvidencePointer[];
  claimEvidence?: ClaimEvidence[];
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

async function generateGeminiEpistemicReview(args: {
  apiKey: string;
  paper: Paper;
  userContext?: string;
  evidencePointers?: EvidencePointer[];
  claimEvidence?: ClaimEvidence[];
}): Promise<Omit<EpistemicReview, "id" | "createdAt" | "paperId" | "engine" | "model">> {
  const { apiKey, paper } = args;
  const userContext = (args.userContext || "").trim();
  const evidencePointers = args.evidencePointers || [];
  const claimEvidence = args.claimEvidence || [];

  const prompt = [
    "You are an epistemic reviewer for a DeSci publishing platform.",
    "Goal: produce a structured, verifiable critique using an epistemic rubric (not vague scoring).",
    "",
    "Return ONLY valid JSON (no markdown, no extra text).",
    "Use verdict values: \"pass\" | \"needs_evidence\" | \"fail\" | \"na\".",
    "",
    "JSON schema (must match keys/types):",
    "{",
    '  "rubricVersion": "epistemic-rubric-v1",',
    '  "summary": { "verdict": "needs_evidence", "confidence": 0.0, "oneLine": "..." },',
    '  "alignment": [',
    '    { "claim": "...", "status": "needs_evidence", "evidence": ["..."], "gaps": ["..."], "counterTests": ["..."] }',
    "  ],",
    '  "extracted": { "claims": ["..."], "assumptions": ["..."], "testablePredictions": ["..."] },',
    '  "sections": [',
    '    { "id": "claims", "title": "Claim Clarity & Scope", "checks": [',
    '      { "id": "claims.core", "label": "Core claim is stated explicitly", "verdict": "needs_evidence", "rationale": "...", "evidence": ["..."], "counterTests": ["..."], "followups": ["..."] }',
    "    ] }",
    "  ],",
    '  "actionItems": ["..."],',
    '  "limitations": ["..."]',
    "}",
    "",
    "Rubric guidance (apply based only on the provided record info; do NOT pretend you read the full PDF):",
    "- Prefer evidence-linked critiques: cite phrases from the abstract/metadata as evidence when possible.",
    "- If info is missing at record level, verdict should usually be \"needs_evidence\" (not \"fail\").",
    "- Ensure followups are actionable and test-oriented (pre-registration, controls, thresholds).",
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
    claimEvidence.length ? `- Author claims (with evidence ids): ${JSON.stringify(claimEvidence)}` : "",
    userContext ? `- Additional context: ${userContext}` : "",
  ]
    .filter(Boolean)
    .join("\n");

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

  return parsed as Omit<EpistemicReview, "id" | "createdAt" | "paperId" | "engine" | "model">;
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
  const claimEvidence = Array.isArray(body.claimEvidence) ? body.claimEvidence : [];

  const apiKey = process.env.GEMINI_API_KEY?.trim() || "";

  if (engine === "simulated" || !apiKey) {
    const review = generateMockEpistemicReview(paper, { userContext, evidencePointers, claimEvidence });
    return NextResponse.json({ review }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const generated = await generateGeminiEpistemicReview({
      apiKey,
      paper,
      userContext,
      evidencePointers,
      claimEvidence,
    });
    if (
      !generated ||
      typeof generated !== "object" ||
      !("rubricVersion" in generated) ||
      !("summary" in generated) ||
      !("sections" in generated) ||
      !Array.isArray((generated as EpistemicReview).sections)
    ) {
      throw new Error("Gemini output does not match schema.");
    }
    const review: EpistemicReview = {
      ...generated,
      id: globalThis.crypto?.randomUUID?.() || `review-${Date.now()}`,
      paperId: paper.id,
      createdAt: new Date().toISOString(),
      engine: "gemini",
      model: "gemini-1.5-flash",
    };
    return NextResponse.json({ review }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    const review = generateMockEpistemicReview(paper, { userContext, evidencePointers, claimEvidence });
    return NextResponse.json({ review }, { headers: { "Cache-Control": "no-store" } });
  }
}
