// lib/github/diff.ts

import {
  githubFetchText,
  type GitHubRepo,
} from "./client";

export async function fetchCompareDiff(
  repository: GitHubRepo,
  base: string,
  head: string
): Promise<string> {
  return githubFetchText(
    `/repos/${repository.owner}/${repository.repo}/compare/${encodeURIComponent(
      base
    )}...${encodeURIComponent(head)}`,

    "application/vnd.github.v3.diff"
  );
}

export async function fetchPullRequestDiff(
  repository: GitHubRepo,
  pullNumber: number
): Promise<string> {
  return githubFetchText(
    `/repos/${repository.owner}/${repository.repo}/pulls/${pullNumber}`,

    "application/vnd.github.v3.diff"
  );
}