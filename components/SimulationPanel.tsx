"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  ScoredRisk,
} from "@/lib/analysis/riskScore";

interface Props {
  risks: ScoredRisk[];
}

export default function SimulationPanel({
  risks,
}: Props) {
  const simulationRisks = useMemo(
    () =>
      risks.filter(
        (risk) =>
          risk.failurePath &&
          risk.failurePath.length >= 2
      ),
    [risks]
  );

  const [running, setRunning] =
    useState(false);

  const [riskIndex, setRiskIndex] =
    useState(0);

  const [stepIndex, setStepIndex] =
    useState(0);

  const currentRisk =
    simulationRisks[riskIndex];

  const currentPath =
    currentRisk?.failurePath ?? [];

  useEffect(() => {
    if (!running || !currentRisk) {
      return;
    }

    const timer = setTimeout(() => {
      if (
        stepIndex <
        currentPath.length - 1
      ) {
        setStepIndex(
          (value) => value + 1
        );

        return;
      }

      if (
        riskIndex <
        simulationRisks.length - 1
      ) {
        setTimeout(() => {
          setRiskIndex(
            (value) => value + 1
          );

          setStepIndex(0);
        }, 700);

        return;
      }

      setRunning(false);
    }, 850);

    return () =>
      clearTimeout(timer);
  }, [
    running,
    stepIndex,
    riskIndex,
    currentRisk,
    currentPath.length,
    simulationRisks.length,
  ]);

  function startSimulation() {
    if (
      simulationRisks.length === 0
    ) {
      return;
    }

    setRiskIndex(0);
    setStepIndex(0);
    setRunning(true);
  }

  function stopSimulation() {
    setRunning(false);
  }

  if (
    simulationRisks.length === 0
  ) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">
            Execution simulation
          </p>

          <h2 className="mt-1 text-xl font-semibold text-white">
            Simulate PR
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Shadow walks through the
            predicted execution paths
            affected by this change.
          </p>
        </div>

        {!running ? (
          <button
            onClick={startSimulation}
            className="rounded-xl bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200"
          >
            ▶ Simulate PR
          </button>
        ) : (
          <button
            onClick={stopSimulation}
            className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-white"
          >
            Stop
          </button>
        )}
      </div>

      {currentRisk && (
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-zinc-500">
                Scenario{" "}
                {riskIndex + 1} /{" "}
                {simulationRisks.length}
              </p>

              <h3 className="mt-2 font-medium text-white">
                {currentRisk.title}
              </h3>
            </div>

            <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-medium uppercase text-red-300">
              {
                currentRisk.severity
              }
            </span>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {currentPath.map(
              (step, index) => {
                const active =
                  index <= stepIndex;

                const current =
                  index === stepIndex;

                const failure =
                  index ===
                    currentPath.length -
                      1 &&
                  active;

                return (
                  <div
                    key={`${step}-${index}`}
                    className="flex items-center gap-3"
                  >
                    <div
                      className={[
                        "rounded-xl border px-4 py-3 text-sm transition-all duration-500",
                        active
                          ? failure
                            ? "scale-105 border-red-500/50 bg-red-500/10 text-red-200 shadow-lg shadow-red-950/40"
                            : current
                              ? "scale-105 border-amber-500/50 bg-amber-500/10 text-amber-100"
                              : "border-white/20 bg-white/10 text-white"
                          : "border-white/5 bg-black text-zinc-600",
                      ].join(
                        " "
                      )}
                    >
                      {failure && (
                        <span className="mr-2">
                          💥
                        </span>
                      )}

                      {step}
                    </div>

                    {index <
                      currentPath.length -
                        1 && (
                      <span
                        className={
                          index <
                          stepIndex
                            ? "text-white"
                            : "text-zinc-700"
                        }
                      >
                        →
                      </span>
                    )}
                  </div>
                );
              }
            )}
          </div>

          {running &&
            stepIndex ===
              currentPath.length -
                1 && (
              <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-red-300">
                  Predicted failure
                </p>

                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  {
                    currentRisk.description
                  }
                </p>
              </div>
            )}

          {!running &&
            riskIndex ===
              simulationRisks.length -
                1 &&
            stepIndex ===
              currentPath.length -
                1 && (
              <div className="mt-6 rounded-xl border border-white/10 bg-black/40 p-4">
                <p className="text-sm font-medium text-white">
                  Simulation complete
                </p>

                <p className="mt-1 text-sm text-zinc-400">
                  Shadow simulated{" "}
                  {
                    simulationRisks.length
                  }{" "}
                  predicted failure paths.
                </p>
              </div>
            )}
        </div>
      )}
    </section>
  );
}