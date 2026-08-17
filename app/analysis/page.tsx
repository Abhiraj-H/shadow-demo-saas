// app/analysis/page.tsx

"use client";

import {
  useEffect,
  useState,
} from "react";
import SimulationPanel from "@/components/SimulationPanel";
import AnalysisSummary from "@/components/AnalysisSummary";
import RiskCard from "@/components/RiskCard";
import CodeDiff from "@/components/CodeDiff";
import DependencyGraph from "@/components/DependencyGraph";

import type {
  DependencyGraph as Graph,
  ChangedSymbol,
  GraphTraversalNode,
} from "@/lib/graph/types";

import type {
  ScoredRisk,
} from "@/lib/analysis/riskScore";

interface AnalysisResult {
  repository: {
    owner: string;
    name: string;
    base: string;
    head: string;
  };

  summary: {
    blastRadiusScore: number;
    changedSymbols: number;
    affectedComponents: number;
    risks: number;
    criticalRisks: number;
    highRisks: number;
  };

  changedSymbols: ChangedSymbol[];

  affectedNodes: GraphTraversalNode[];

  risks: ScoredRisk[];

  graph: Graph;

  diff: string;
}

export default function AnalysisPage() {
  const [data, setData] =
    useState<AnalysisResult | null>(
      null
    );

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const repoUrl =
      params.get("repoUrl");

    const base =
      params.get("base") ?? "main";

    const head =
      params.get("head");

    if (!repoUrl || !head) {
      setError(
        "Repository and head branch are required."
      );

      setLoading(false);
      return;
    }

    async function run() {
      try {
        const response =
          await fetch(
            "/api/analyze",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                repoUrl,
                base,
                head,
              }),
            }
          );

        const result =
          await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ??
              "Analysis failed"
          );
        }

        setData(result);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Analysis failed"
        );
      } finally {
        setLoading(false);
      }
    }

    run();
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-white" />

          <h1 className="mt-5 text-xl font-medium">
            Simulating blast radius
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            Parsing code, tracing
            dependencies and predicting
            regressions…
          </p>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
        <div className="max-w-lg rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
          <h1 className="text-lg font-semibold">
            Analysis failed
          </h1>

          <p className="mt-2 text-sm text-zinc-400">
            {error}
          </p>

          <a
            href="/"
            className="mt-5 inline-block text-sm text-white underline"
          >
            Try another repository
          </a>
        </div>
      </main>
    );
  }

  const changedNodeIds =
    data.changedSymbols.map(
      (change) => change.nodeId
    );

  const affectedNodeIds =
    data.affectedNodes.map(
      (item) => item.node.id
    );

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-5">
          <div>
            <a
              href="/"
              className="text-sm text-zinc-500"
            >
              ← Shadow
            </a>

            <h1 className="mt-3 text-3xl font-semibold">
              {data.repository.owner}/
              {data.repository.name}
            </h1>

            <p className="mt-2 text-sm text-zinc-500">
              {data.repository.base}
              {" → "}
              {data.repository.head}
            </p>
          </div>

          <div className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-400">
            Analysis complete
          </div>
        </header>

        <AnalysisSummary
          {...data.summary}
        />

        <section className="mt-10">
          <SimulationPanel
            risks={data.risks}
          />
        </section>

        <section className="mt-10">
          <div className="mb-4">
            <p className="text-sm text-zinc-500">
              Impact graph
            </p>

            <h2 className="mt-1 text-xl font-semibold">
              Blast Radius
            </h2>
          </div>

          <DependencyGraph
            graph={data.graph}
            changedNodeIds={
              changedNodeIds
            }
            affectedNodeIds={
              affectedNodeIds
            }
          />
        </section>

        <section className="mt-10">
          <p className="text-sm text-zinc-500">
            Predicted failures
          </p>

          <h2 className="mt-1 text-xl font-semibold">
            Risks
          </h2>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {data.risks.length >
            0 ? (
              data.risks.map(
                (risk) => (
                  <RiskCard
                    key={risk.id}
                    risk={risk}
                  />
                )
              )
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-sm text-zinc-400">
                No significant risks
                detected.
              </div>
            )}
          </div>
        </section>

        <section className="mt-10 pb-20">
          <p className="text-sm text-zinc-500">
            Source change
          </p>

          <h2 className="mb-4 mt-1 text-xl font-semibold">
            Diff
          </h2>

          <CodeDiff
            diff={data.diff}
          />
        </section>
      </div>
    </main>
  );
}