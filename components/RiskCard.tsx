// components/RiskCard.tsx

import type {
  ScoredRisk,
} from "@/lib/analysis/riskScore";

export default function RiskCard({
  risk,
}: {
  risk: ScoredRisk;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-zinc-950 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs uppercase tracking-wide text-zinc-300">
              {risk.severity}
            </span>

            <span className="text-xs text-zinc-500">
              {risk.category.replaceAll(
                "_",
                " "
              )}
            </span>
          </div>

          <h3 className="mt-3 text-lg font-semibold text-white">
            {risk.title}
          </h3>
        </div>

        <div className="text-right">
          <p className="text-2xl font-semibold text-white">
            {risk.score}
          </p>

          <p className="text-xs text-zinc-500">
            risk
          </p>
        </div>
      </div>

      <p className="mt-3 text-sm leading-6 text-zinc-400">
        {risk.description}
      </p>

      {risk.failurePath &&
        risk.failurePath.length >
          0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs uppercase tracking-wider text-zinc-500">
              Failure path
            </p>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              {risk.failurePath.map(
                (item, index) => (
                  <div
                    key={`${item}-${index}`}
                    className="flex items-center gap-2"
                  >
                    <span className="rounded-lg bg-white/5 px-2.5 py-1 text-zinc-300">
                      {item}
                    </span>

                    {index <
                      risk.failurePath!
                        .length -
                        1 && (
                      <span className="text-zinc-600">
                        →
                      </span>
                    )}
                  </div>
                )
              )}
            </div>
          </div>
        )}

      {risk.evidence &&
        risk.evidence.length >
          0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs uppercase tracking-wider text-zinc-500">
              Evidence
            </p>

            <ul className="space-y-1 text-sm text-zinc-400">
              {risk.evidence
                .slice(0, 4)
                .map(
                  (
                    evidence,
                    index
                  ) => (
                    <li
                      key={index}
                    >
                      • {evidence}
                    </li>
                  )
                )}
            </ul>
          </div>
        )}

      {risk.suggestedFix && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-wider text-zinc-500">
            Suggested fix
          </p>

          <p className="mt-2 text-sm leading-6 text-zinc-300">
            {risk.suggestedFix}
          </p>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4 text-xs text-zinc-500">
        <span>
          Confidence{" "}
          {Math.round(
            risk.confidence * 100
          )}
          %
        </span>

        <span>
          {risk.source.toUpperCase()}
        </span>
      </div>
    </article>
  );
}