# Shadow

*See what your code changes break before you merge.*

Shadow is a developer tool that analyzes pull requests to predict downstream runtime regressions. By tracing data flow starting from your modified code, Shadow maps the exact blast radius of a change—such as turning a required schema field into an optional one—and flags potential crashes (like null pointer dereferences) in billing workers, email jobs, or background tasks before they hit production.

---

## Why Shadow?

Modern codebases are highly interconnected. A simple schema update or type modification (e.g., making `User.email` optional to support phone-number-first onboarding) compiles fine, but can silently break runtime logic in downstream consumers that assume the field is always present. 

Standard CI tools miss this:
- **TypeScript / Linters** check type alignment but won't flag logical issues if default fallback logic is missing.
- **Unit Tests** only cover scenarios developers explicitly wrote tests for.

Shadow traces the actual data flow from the changed code down to the execution endpoints, uncovering issues before merging.

---

## How It Works

Shadow implements a Git-first hybrid analysis engine:

1. **Deterministic AST Graph**:
   Shadow clones the repository locally, compares the base and head branches, and identifies changed code blocks. It builds a syntax-level reference graph tracing variables, method calls, properties, and API routes to find all downstream consumers of the modified symbols.

2. **AI-Enriched Findings**:
   Once the static engine identifies the affected execution paths, the context is passed to Gemini. The model analyzes the flow to provide a concise explanation of the runtime impact and a suggested fix.

3. **Graceful Fallback**:
   If the Gemini API is unavailable or hits quota limits, the tool falls back entirely to the static engine, returning the type and execution path violations without interrupting the UI.

---

## Getting Started

### Prerequisites

Ensure you have Git and Node.js installed locally.

### Installation

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env.local` file in the root directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000` in your browser. The default demo is pre-configured to analyze the changes between `main` and `feature/phone-only-users` in a sample SaaS repository.
