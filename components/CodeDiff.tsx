// components/CodeDiff.tsx

export default function CodeDiff({
  diff,
}: {
  diff: string;
}) {
  const lines =
    diff.split("\n");

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#090909]">
      <div className="border-b border-white/10 px-4 py-3">
        <p className="text-sm font-medium text-zinc-300">
          Pull Request Diff
        </p>
      </div>

      <div className="max-h-[600px] overflow-auto font-mono text-xs leading-6">
        {lines.map(
          (line, index) => {
            let className =
              "text-zinc-400";

            if (
              line.startsWith("+") &&
              !line.startsWith(
                "+++"
              )
            ) {
              className =
                "bg-emerald-500/10 text-emerald-300";
            }

            if (
              line.startsWith("-") &&
              !line.startsWith(
                "---"
              )
            ) {
              className =
                "bg-red-500/10 text-red-300";
            }

            if (
              line.startsWith(
                "@@"
              )
            ) {
              className =
                "bg-blue-500/10 text-blue-300";
            }

            return (
              <div
                key={index}
                className={`whitespace-pre px-4 ${className}`}
              >
                {line || " "}
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}