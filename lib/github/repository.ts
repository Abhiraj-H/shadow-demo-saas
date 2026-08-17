// lib/github/repository.ts

import {
  githubFetch,
  type GitHubRepo,
} from "./client";

export interface RepositoryFile {
  path: string;
  content: string;
  sha: string;
  size: number;
}

interface CommitResponse {
  commit: {
    tree: {
      sha: string;
    };
  };
}

interface TreeResponse {
  tree: Array<{
    path: string;
    type: "blob" | "tree";
    sha: string;
    size?: number;
  }>;

  truncated: boolean;
}

interface ContentResponse {
  content?: string;
  encoding?: string;
  sha: string;
  size: number;
}

const supportedExtensions = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".prisma",
];

function supported(path: string): boolean {
  return supportedExtensions.some(
    (extension) =>
      path.endsWith(extension)
  );
}

function ignored(path: string): boolean {
  return [
    "node_modules/",
    ".next/",
    "dist/",
    "build/",
    "coverage/",
    "vendor/",
  ].some((value) =>
    path.includes(value)
  );
}

async function resolveTreeSha(
  repository: GitHubRepo,
  ref: string
): Promise<string> {
  const commit =
    await githubFetch<CommitResponse>(
      `/repos/${repository.owner}/${repository.repo}/commits/${encodeURIComponent(
        ref
      )}`
    );

  return commit.commit.tree.sha;
}

async function fetchFile(
  repository: GitHubRepo,
  path: string,
  ref: string
): Promise<RepositoryFile | null> {
  const result =
    await githubFetch<ContentResponse>(
      `/repos/${repository.owner}/${repository.repo}/contents/${encodeURI(
        path
      )}?ref=${encodeURIComponent(ref)}`
    );

  if (
    !result.content ||
    result.encoding !== "base64"
  ) {
    return null;
  }

  return {
    path,
    content: Buffer.from(
      result.content.replace(/\n/g, ""),
      "base64"
    ).toString("utf8"),

    sha: result.sha,
    size: result.size,
  };
}

export async function fetchRepositoryFiles(
  repository: GitHubRepo,
  ref: string,
  maxFiles = 150
): Promise<RepositoryFile[]> {
  const treeSha =
    await resolveTreeSha(
      repository,
      ref
    );

  const tree =
    await githubFetch<TreeResponse>(
      `/repos/${repository.owner}/${repository.repo}/git/trees/${treeSha}?recursive=1`
    );

  const blobs = tree.tree
    .filter(
      (item) =>
        item.type === "blob" &&
        supported(item.path) &&
        !ignored(item.path) &&
        (item.size ?? 0) <
          250_000
    )
    .slice(0, maxFiles);

  const results: RepositoryFile[] = [];

  const concurrency = 8;

  for (
    let i = 0;
    i < blobs.length;
    i += concurrency
  ) {
    const batch =
      blobs.slice(
        i,
        i + concurrency
      );

    const files =
      await Promise.all(
        batch.map((item) =>
          fetchFile(
            repository,
            item.path,
            ref
          )
        )
      );

    for (const file of files) {
      if (file) {
        results.push(file);
      }
    }
  }

  return results;
}