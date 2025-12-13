import type { RiskFlag, RiskSeverity } from "@/lib/review/risk";

type Finding = {
  id: string;
  severity: RiskSeverity;
  title: string;
  detail: string;
  fix: string;
};

function uniqById(items: Finding[]) {
  const seen = new Set<string>();
  const out: Finding[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

function redactSample(text: string) {
  const t = text.trim();
  if (t.length <= 24) return t;
  return `${t.slice(0, 6)}…${t.slice(-6)}`;
}

export function scanSensitiveText(text: string): RiskFlag[] {
  const raw = (text || "").trim();
  if (!raw) return [];

  const findings: Finding[] = [];

  const patterns: Array<{
    id: string;
    severity: RiskSeverity;
    title: string;
    regex: RegExp;
    fix: string;
  }> = [
    {
      id: "safety.private_key_block",
      severity: "high",
      title: "Private key material detected",
      regex: /-----BEGIN (?:RSA|EC|OPENSSH|PGP|PRIVATE) KEY-----/i,
      fix: "Remove private keys from submissions; rotate credentials immediately if this is real.",
    },
    {
      id: "safety.openai_key",
      severity: "high",
      title: "API key detected (OpenAI-style)",
      regex: /\bsk-[A-Za-z0-9]{20,}\b/,
      fix: "Never submit API keys. Move secrets to server-side env vars and rotate the leaked key.",
    },
    {
      id: "safety.github_token",
      severity: "high",
      title: "Token detected (GitHub-style)",
      regex: /\bghp_[A-Za-z0-9]{20,}\b/,
      fix: "Never submit tokens. Revoke and rotate the token, then replace it with a scoped secret.",
    },
    {
      id: "safety.google_api_key",
      severity: "medium",
      title: "API key detected (Google-style)",
      regex: /\bAIza[0-9A-Za-z\-_]{20,}\b/,
      fix: "Remove API keys from content. Store secrets in env vars or secret manager.",
    },
    {
      id: "safety.aws_access_key",
      severity: "high",
      title: "Credential detected (AWS access key id)",
      regex: /\bAKIA[0-9A-Z]{16}\b/,
      fix: "Rotate AWS credentials and remove them from the submission.",
    },
    {
      id: "safety.email",
      severity: "low",
      title: "Email address detected",
      regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
      fix: "Consider removing personal emails; use ORCID or institutional contact page instead.",
    },
  ];

  for (const rule of patterns) {
    const match = raw.match(rule.regex);
    if (!match) continue;
    findings.push({
      id: rule.id,
      severity: rule.severity,
      title: rule.title,
      detail: `Matched: ${redactSample(match[0])}`,
      fix: rule.fix,
    });
  }

  return uniqById(findings).map((f) => ({
    id: f.id,
    severity: f.severity,
    title: f.title,
    detail: f.detail,
    fix: f.fix,
  }));
}

