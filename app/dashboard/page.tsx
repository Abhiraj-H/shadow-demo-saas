// app/dashboard/page.tsx

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-5xl">
        <a
          href="/"
          className="text-sm text-zinc-500"
        >
          ← Shadow
        </a>

        <h1 className="mt-6 text-4xl font-semibold">
          Dashboard
        </h1>

        <p className="mt-3 text-zinc-400">
          Analyze a repository to see
          its pull request blast radius.
        </p>

        <a
          href="/"
          className="mt-8 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-medium text-black"
        >
          Analyze repository
        </a>
      </div>
    </main>
  );
}