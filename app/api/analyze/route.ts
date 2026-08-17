// app/api/analyze/route.ts

import { NextResponse } from "next/server";

import {
  parseGitHubRepo,
} from "@/lib/github/client";

import {
  fetchRepositoryFiles,
} from "@/lib/github/repository";

import {
  fetchCompareDiff,
} from "@/lib/github/diff";

import {
  parseTypeScriptFiles,
} from "@/lib/parser/typescript";

import {
  parsePrismaFiles,
} from "@/lib/parser/prisma";

import {
  createParsedRepository,
} from "@/lib/parser/symbols";

import {
  buildDependencyGraph,
} from "@/lib/graph/build";

import {
  combineBlastRadii,
} from "@/lib/graph/traverse";

import {
  detectChangedSymbols,
} from "@/lib/analysis/changeDetector";

import {
  runDeterministicRules,
} from "@/lib/analysis/deterministicRules";

import {
  runAIAnalysis,
} from "@/lib/analysis/aiAnalyzer";

import {
  calculateBlastRadiusScore,
  dedupeRisks,
  rankRisks,
} from "@/lib/analysis/riskScore";

import {
  createGeminiRiskClient,
} from "@/lib/ai/client";

export const runtime = "nodejs";
export const maxDuration = 60;

interface AnalyzeBody {
  repoUrl: string;
  base?: string;
  head?: string;
}

export async function POST(
  request: Request
) {
  try {
    const body =
      (await request.json()) as AnalyzeBody;

    if (!body.repoUrl) {
      return NextResponse.json(
        {
          error:
            "repoUrl is required",
        },
        {
          status: 400,
        }
      );
    }

    const base =
      body.base?.trim() || "main";

    const head =
      body.head?.trim() || "HEAD";

    const repository =
      parseGitHubRepo(body.repoUrl);

    const files =
      await fetchRepositoryFiles(
        repository,
        head
      );

    const tsInputs = files
      .filter(
        (file) =>
          !file.path.endsWith(
            ".prisma"
          )
      )
      .map((file) => ({
        filePath: file.path,
        content: file.content,
      }));

    const prismaInputs = files
      .filter((file) =>
        file.path.endsWith(
          ".prisma"
        )
      )
      .map((file) => ({
        filePath: file.path,
        content: file.content,
      }));

    const tsRepository =
      parseTypeScriptFiles(tsInputs);

    const prismaRepository =
      parsePrismaFiles(
        prismaInputs
      );

    const parsedRepository =
      createParsedRepository([
        ...tsRepository.files,
        ...prismaRepository.files,
      ]);

    const graph =
      buildDependencyGraph(
        parsedRepository
      );

    const diff =
      await fetchCompareDiff(
        repository,
        base,
        head
      );

    const changes =
      detectChangedSymbols(
        diff,
        parsedRepository
      );

    const affectedNodes =
      combineBlastRadii(
        graph,
        changes.changedSymbols.map(
          (change) => change.nodeId
        ),
        4
      );

    const staticRisks =
      runDeterministicRules({
        changes:
          changes.changedSymbols,

        graph,
        affectedNodes,
      });

    let aiRisks: import("@/lib/analysis/riskScore").RiskCandidate[] = [];

    if (process.env.GEMINI_API_KEY) {
      const aiClient =
        createGeminiRiskClient();

      aiRisks =
        await runAIAnalysis(
          {
            changes:
              changes.changedSymbols,

            graph,

            repository:
              parsedRepository,

            affectedNodes,

            maxContexts: 6,
          },

          aiClient
        );
    }

    const risks =
      rankRisks(
        dedupeRisks([
          ...staticRisks,
          ...aiRisks,
        ])
      );

    const blastRadiusScore =
      calculateBlastRadiusScore(
        risks
      );

    return NextResponse.json({
      repository: {
        owner: repository.owner,
        name: repository.repo,
        base,
        head,
      },

      summary: {
        blastRadiusScore,

        changedSymbols:
          changes.changedSymbols.length,

        affectedComponents:
          affectedNodes.length,

        risks: risks.length,

        criticalRisks:
          risks.filter(
            (risk) =>
              risk.severity ===
              "critical"
          ).length,

        highRisks:
          risks.filter(
            (risk) =>
              risk.severity ===
              "high"
          ).length,
      },

      changedSymbols:
        changes.changedSymbols,

      affectedNodes,

      risks,

      graph,

      diff,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Analysis failed",
      },
      {
        status: 500,
      }
    );
  }
}