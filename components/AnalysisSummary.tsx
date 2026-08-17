// components/AnalysisSummary.tsx

interface Props {
  blastRadiusScore: number;
  changedSymbols: number;
  affectedComponents: number;
  risks: number;
  criticalRisks: number;
  highRisks: number;
}

function scoreLabel(
  score: number
) {
  if (score >= 90)
    return "CRITICAL";

  if (score >= 70)
    return "HIGH";

  if (score >= 40)
    return "MEDIUM";

  return "LOW";
}

export default function AnalysisSummary({
  blastRadiusScore,
  changedSymbols,
  affectedComponents,
  risks,
  criticalRisks,
  highRisks,
}: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 lg:col-span-2">
        <p className="text-sm text-zinc-400">
          Blast Radius
        </p>

        <div className="mt-3 flex items-end gap-3">
          <span className="text-5xl font-semibold tracking-tight text-white">
            {blastRadiusScore}
          </span>

          <span className="pb-1 text-zinc-500">
            / 100
          </span>
        </div>

        <div className="mt-4 inline-flex rounded-full border border-white/10 px-3 py-1 text-xs font-medium">
          {scoreLabel(
            blastRadiusScore
          )}
        </div>
      </div>

      <Stat
        label="Changed"
        value={changedSymbols}
      />

      <Stat
        label="Affected"
        value={affectedComponents}
      />

      <Stat
        label="Risks"
        value={risks}
        detail={`${criticalRisks} critical · ${highRisks} high`}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="text-sm text-zinc-400">
        {label}
      </p>

      <p className="mt-3 text-3xl font-semibold text-white">
        {value}
      </p>

      {detail && (
        <p className="mt-2 text-xs text-zinc-500">
          {detail}
        </p>
      )}
    </div>
  );
}