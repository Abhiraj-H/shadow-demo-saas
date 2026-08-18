// app/page.tsx

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-20">
        <div className="max-w-3xl">
          <div className="mb-6 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400">
            AI-powered change impact analysis
          </div>

          <h1 className="text-5xl font-semibold tracking-tight sm:text-7xl">
            See what your code change breaks
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-zinc-400 to-zinc-600">
              before you merge it.
            </span>
          </h1>

          <p className="mt-8 max-w-2xl text-lg leading-8 text-zinc-400">
            Shadow analyzes your pull request, maps its true blast radius, and predicts hidden regressions before they reach production.
          </p>

          <form
            action="/analysis"
            method="GET"
            className="mt-10 max-w-2xl rounded-2xl border border-white/10 bg-white/[0.03] p-5"
          >
            <label className="text-sm text-zinc-400">
              GitHub repository
            </label>

            <input
              required
              name="repoUrl"
              placeholder="https://github.com/user/repository"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm outline-none placeholder:text-zinc-700 focus:border-zinc-600"
            />

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-zinc-500">
                  Base
                </label>

                <input
                  name="base"
                  defaultValue="demo-main"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm outline-none"
                />
              </div>

              <div>
                <label className="text-sm text-zinc-400">
                  Head branch
                </label>

                <input
                  required
                  name="head"
                  placeholder="feature/my-change"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              className="mt-4 w-full rounded-xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
            >
              Analyze Change →
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}