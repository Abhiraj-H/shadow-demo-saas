// lib/analysis/riskScore.ts

export type RiskSeverity = "critical" | "high" | "medium" | "low";

export type RiskCategory =
  | "runtime"
  | "type"
  | "api_breaking_change"
  | "data_integrity"
  | "database"
  | "security"
  | "business_logic"
  | "performance"
  | "dependency"
  | "unknown";

export type RiskSource = "static" | "ai" | "hybrid";

export interface RiskCandidate {
  id: string;

  title: string;
  description: string;

  category: RiskCategory;
  severity: RiskSeverity;

  confidence: number;

  source: RiskSource;

  changedNodeId?: string;
  affectedNodeId?: string;

  changedSymbol?: string;
  affectedSymbol?: string;

  filePath?: string;
  line?: number;

  dependencyDepth?: number;

  failurePath?: string[];

  evidence?: string[];

  suggestedFix?: string;

  metadata?: Record<string, unknown>;
}

export interface ScoredRisk extends RiskCandidate {
  score: number;
}

const severityWeights: Record<RiskSeverity, number> = {
  critical: 100,
  high: 80,
  medium: 55,
  low: 30,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeConfidence(confidence: number): number {
  if (confidence > 1) {
    return clamp(confidence / 100, 0, 1);
  }

  return clamp(confidence, 0, 1);
}

function proximityMultiplier(depth?: number): number {
  if (depth === undefined) return 1;

  if (depth <= 0) return 1;
  if (depth === 1) return 1;
  if (depth === 2) return 0.9;
  if (depth === 3) return 0.8;
  if (depth === 4) return 0.7;

  return 0.6;
}

function categoryMultiplier(category: RiskCategory): number {
  switch (category) {
    case "security":
      return 1.15;

    case "data_integrity":
      return 1.12;

    case "database":
      return 1.08;

    case "runtime":
      return 1.05;

    case "api_breaking_change":
      return 1.05;

    case "type":
      return 1;

    case "business_logic":
      return 1;

    case "dependency":
      return 0.95;

    case "performance":
      return 0.9;

    case "unknown":
    default:
      return 0.85;
  }
}

function sourceMultiplier(source: RiskSource): number {
  switch (source) {
    case "hybrid":
      return 1.08;

    case "static":
      return 1.05;

    case "ai":
      return 0.95;

    default:
      return 1;
  }
}

export function scoreRisk(risk: RiskCandidate): ScoredRisk {
  const severity = severityWeights[risk.severity];
  const confidence = normalizeConfidence(risk.confidence);

  const rawScore =
    severity *
    confidence *
    proximityMultiplier(risk.dependencyDepth) *
    categoryMultiplier(risk.category) *
    sourceMultiplier(risk.source);

  return {
    ...risk,
    confidence,
    score: Math.round(clamp(rawScore, 0, 98)),
  };
}

export function rankRisks(risks: RiskCandidate[]): ScoredRisk[] {
  return risks
    .map(scoreRisk)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return b.confidence - a.confidence;
    });
}

function riskFingerprint(risk: RiskCandidate): string {
  return [
    risk.category,
    risk.changedNodeId ?? risk.changedSymbol ?? "",
    risk.affectedNodeId ?? risk.affectedSymbol ?? "",
    risk.title.toLowerCase().trim(),
  ].join(":");
}

export function dedupeRisks(risks: RiskCandidate[]): RiskCandidate[] {
  const map = new Map<string, RiskCandidate>();

  for (const risk of risks) {
    const key = riskFingerprint(risk);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, risk);
      continue;
    }

    const existingConfidence = normalizeConfidence(existing.confidence);
    const currentConfidence = normalizeConfidence(risk.confidence);

    if (currentConfidence > existingConfidence) {
      map.set(key, {
        ...risk,
        evidence: Array.from(
          new Set([
            ...(existing.evidence ?? []),
            ...(risk.evidence ?? []),
          ])
        ),
      });
    } else {
      map.set(key, {
        ...existing,
        evidence: Array.from(
          new Set([
            ...(existing.evidence ?? []),
            ...(risk.evidence ?? []),
          ])
        ),
      });
    }
  }

  return Array.from(map.values());
}

export function calculateBlastRadiusScore(
  risks: RiskCandidate[]
): number {
  if (risks.length === 0) {
    return 0;
  }

  const scored = rankRisks(risks);

  const topRisks = scored.slice(0, 5);

  const weighted =
    topRisks.reduce((total, risk, index) => {
      const weight = 1 / (index + 1);

      return total + risk.score * weight;
    }, 0) /
    topRisks.reduce((total, _, index) => {
      return total + 1 / (index + 1);
    }, 0);

  const volumeBonus = Math.min(risks.length * 1.5, 10);

  return Math.round(
    clamp(weighted + volumeBonus, 0, 98)
  );
}

export function scoreToSeverity(
  score: number
): RiskSeverity {
  if (score >= 90) return "critical";
  if (score >= 70) return "high";
  if (score >= 40) return "medium";

  return "low";
}