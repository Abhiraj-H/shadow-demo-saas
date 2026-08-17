// lib/ai/client.ts

import { GoogleGenAI } from "@google/genai";

import type {
  AIRiskResponse,
  LLMRiskClient,
  RiskAnalysisContext,
} from "@/lib/analysis/aiAnalyzer";

import {
  SHADOW_SYSTEM_PROMPT,
  buildRiskPrompt,
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

  const parsed = JSON.parse(cleaned);

  return {
    risks: Array.isArray(parsed.risks)
      ? parsed.risks
      : [],
  };
}

export function createGeminiRiskClient(): LLMRiskClient {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is missing"
    );
  }

  const ai = new GoogleGenAI({
    apiKey,
  });

  return {
    async analyzeRisk(
      context: RiskAnalysisContext
    ): Promise<AIRiskResponse[]> {
      const response =
        await ai.models.generateContent({
          model:
            process.env.GEMINI_MODEL ??
            "gemini-3.6-flash",

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
        return [];
      }

      return extractJSON(text).risks;
    },
  };
}