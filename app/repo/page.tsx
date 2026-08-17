// app/repo/page.tsx

export default function RepoPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-2xl">
        <a
          href="/"
          className="text-sm text-zinc-500"
        >
          ← Shadow
        </a>

        <h1 className="mt-6 text-3xl font-semibold">
          Connect Repository
        </h1>

        <form
          action="/analysis"
          method="GET"
          className="mt-8 space-y-4"
        >
          <input
            required
            name="repoUrl"
            placeholder="https://github.com/user/repository"
            className="w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 outline-none"
          />

          <div className="grid grid-cols-2 gap-3">
            <input
              name="base"
              defaultValue="main"
              className="rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 outline-none"
            />

            <input
              required
              name="head"
              placeholder="feature/change"
              className="rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 outline-none"
            />
          </div>

          <button className="w-full rounded-xl bg-white px-5 py-3 font-medium text-black">
            Analyze
          </button>
        </form>
      </div>
    </main>
  );
}