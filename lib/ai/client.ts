import { GoogleGenAI } from "@google/genai";

import type {
  AIRiskResponse,
  LLMRiskClient,
  RiskAnalysisContext,
} from "@/lib/analysis/aiAnalyzer";

import {
  SHADOW_SYSTEM_PROMPT,
  buildRiskPrompt,
  SHADOW_ENRICHMENT_SYSTEM_PROMPT,
  buildEnrichmentPrompt,
} from "./prompts";

interface ModelOutput {
  risks: AIRiskResponse[];
}

function extractJSON(text: string): ModelOutput {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);

    return {
      risks: Array.isArray(parsed.risks)
        ? parsed.risks
        : [],
    };
  } catch {
    return { risks: [] };
  }
}

const MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-2.5-flash",
];

export function createGeminiRiskClient(): LLMRiskClient {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing");
  }

  const ai = new GoogleGenAI({ apiKey });

  return {
    async analyzeRisk(context) {
      let lastError: unknown;

      for (const model of MODELS) {
        try {
          console.log(`[Shadow AI] Trying ${model}`);

          const response =
            await ai.models.generateContent({
              model,

              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text: `
${SHADOW_SYSTEM_PROMPT}

${buildRiskPrompt(context)}
`,
                    },
                  ],
                },
              ],

              config: {
                temperature: 0.1,
                responseMimeType:
                  "application/json",
              },
            });

          const text = response.text;

          if (!text) {
            continue;
          }

          console.log(
            `[Shadow AI] ✓ ${model}`
          );

          return extractJSON(text).risks;
        } catch (error) {
          console.error(
            `[Shadow AI] ${model} failed`,
            error
          );

          lastError = error;
        }
      }

      console.error(
        "[Shadow AI] All Gemini models unavailable",
        lastError
      );

      return [];
    },

    async enrichRisks(staticRisks: any[], context: any): Promise<any[]> {
      let lastError: unknown;

      for (const model of MODELS) {
        try {
          console.log(`[Shadow AI] Trying enrichment with ${model}`);

          const response =
            await ai.models.generateContent({
              model,

              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text: `
${SHADOW_ENRICHMENT_SYSTEM_PROMPT}

${buildEnrichmentPrompt(staticRisks, context)}
`,
                    },
                  ],
                },
              ],

              config: {
                temperature: 0.1,
                responseMimeType:
                  "application/json",
              },
            });

          const text = response.text;

          if (!text) {
            continue;
          }

          console.log(
            `[Shadow AI] ✓ Enrichment with ${model}`
          );

          const cleaned = text
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/```$/i, "")
            .trim();

          const parsed = JSON.parse(cleaned);

          return Array.isArray(parsed.enrichedRisks)
            ? parsed.enrichedRisks
            : [];
        } catch (error) {
          console.error(
            `[Shadow AI] ${model} enrichment failed`,
            error
          );

          lastError = error;
        }
      }

      console.error(
        "[Shadow AI] All Gemini models unavailable for enrichment",
        lastError
      );

      return [];
    },
  };
}