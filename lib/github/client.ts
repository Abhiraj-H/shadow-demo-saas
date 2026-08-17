// lib/github/client.ts

export interface GitHubRepo {
  owner: string;
  repo: string;
}

const API =
  "https://api.github.com";

function headers(
  accept = "application/vnd.github+json"
): HeadersInit {
  const token =
    process.env.GITHUB_TOKEN;

  return {
    Accept: accept,
    "X-GitHub-Api-Version":
      "2022-11-28",

    ...(token
      ? {
          Authorization:
            `Bearer ${token}`,
        }
      : {}),
  };
}

export function parseGitHubRepo(
  input: string
): GitHubRepo {
  const value = input
    .trim()
    .replace(/\.git$/, "");

  const match = value.match(
    /github\.com\/([^/]+)\/([^/]+)/
  );

  if (match) {
    return {
      owner: match[1],
      repo: match[2],
    };
  }

  const shorthand =
    value.match(/^([^/]+)\/([^/]+)$/);

  if (shorthand) {
    return {
      owner: shorthand[1],
      repo: shorthand[2],
    };
  }

  throw new Error(
    "Invalid GitHub repository URL"
  );
}

export async function githubFetch<T>(
  endpoint: string
): Promise<T> {
  const response = await fetch(
    `${API}${endpoint}`,
    {
      headers: headers(),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const text =
      await response.text();

    throw new Error(
      `GitHub API ${response.status}: ${text}`
    );
  }

  return response.json() as Promise<T>;
}

export async function githubFetchText(
  endpoint: string,
  accept: string
): Promise<string> {
  const response = await fetch(
    `${API}${endpoint}`,
    {
      headers: headers(accept),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const text =
      await response.text();

    throw new Error(
      `GitHub API ${response.status}: ${text}`
    );
  }

  return response.text();
}