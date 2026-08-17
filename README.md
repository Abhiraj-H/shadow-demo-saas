# Shadow: See what your code change breaks before you merge it.

## 💥 The Problem
Modern SaaS applications are complex webs of interconnected code. You might make a seemingly harmless change in a type definition or database schema—like making an email field optional to support phone-number-first signups—and unknowingly break a downstream billing worker, welcome email job, or password reset flow. 

Standard CI/CD tools won't save you:
- **Unit tests** only catch what you explicitly wrote tests for.
- **Type checkers (TypeScript)** only catch static type mismatches.
- **Linters** only catch syntax issues.

By the time a hidden regression reaches production, it's too late.

## 🔮 The Solution
**Shadow** is an AI-powered code analysis engine that simulates the true "blast radius" of your pull requests. 

Instead of waiting for code to break in staging (or worse, production), Shadow intercepts the diff, builds an abstract syntax dependency graph, and walks the execution paths to show you exactly which downstream consumers will fail.

### How it works
Shadow employs a unique **Hybrid Analysis Architecture**:
1. **Deterministic Dependency Graph**: Shadow natively clones the Git repository, fetches the PR branch, and uses a custom static analysis engine to build a deterministic graph of all variables, methods, properties, and API routes. It traces data flow from the changed lines all the way down to the deepest consumers.
2. **AI Enrichment**: Once the true affected nodes are mathematically proven by the static engine, Shadow passes the isolated context to **Google Gemini**. Gemini analyzes the failure paths and generates human-readable, product-focused explanations of *why* the code will break.

This hybrid approach ensures **zero hallucinations**. Gemini isn't guessing what files changed—it's enriching mathematical certainty.

## 🚀 Key Features
- **Git-Native Diffing**: Shadow works directly with Git, bypassing GitHub API rate limits.
- **Blast Radius Mapping**: Visually trace the execution path of a regression from origin to failure.
- **Execution Simulation**: Watch an animated "Simulate PR" sequence that walks through exactly how a runtime null-dereference or logic bug will occur.
- **Graceful Degradation**: If the AI model hits quota limits, the system instantly falls back to the deterministic engine without breaking the UI.

## 🛠 Built With
- Next.js (App Router)
- React
- Google Gemini API (gemini-3.6-flash / gemini-pro)
- Tailwind CSS
- Node.js native Git operations

## 🏃‍♂️ Run it Locally

1. Clone the repository and install dependencies:
```bash
npm install
```

2. Add your Gemini API key to `.env.local`:
```
GEMINI_API_KEY=your_key_here
```

3. Start the dev server:
```bash
npm run dev
```

4. Open `http://localhost:3000`. Shadow is pre-configured to analyze a demo SaaS repository. Just click **Analyze Change →** and watch the simulation!
