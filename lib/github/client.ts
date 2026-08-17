// lib/github/client.ts

import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import os from "os";
import fs from "fs/promises";

const execFileAsync = promisify(execFile);

export interface GitHubRepo {
  owner: string;
  repo: string;
}

export interface ClonedRepo {
  url: string;
  owner: string;
  repo: string;
  localPath: string;
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

  const parts = value.split("/").filter(Boolean);
  return {
    owner: parts[parts.length - 2] || "repo",
    repo: parts[parts.length - 1] || "repo",
  };
}

export async function cloneOrFetchRepo(
  repoUrl: string
): Promise<ClonedRepo> {
  const url = repoUrl.trim();
  const parsed = parseGitHubRepo(url);

  const normalizedUrl = url.startsWith("http")
    ? url
    : `https://github.com/${parsed.owner}/${parsed.repo}.git`;

  const cacheBase = path.join(os.tmpdir(), "shadow-repos");
  await fs.mkdir(cacheBase, { recursive: true });

  const safeDirName = `${parsed.owner}_${parsed.repo}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  const localPath = path.join(cacheBase, safeDirName);

  let exists = false;
  try {
    const stat = await fs.stat(path.join(localPath, ".git"));
    exists = stat.isDirectory();
  } catch {
    exists = false;
  }

  if (!exists) {
    await fs.rm(localPath, { recursive: true, force: true });
    await execFileAsync("git", ["clone", normalizedUrl, localPath], {
      maxBuffer: 20 * 1024 * 1024,
    });
  } else {
    try {
      await execFileAsync("git", ["fetch", "--all", "--prune"], {
        cwd: localPath,
        maxBuffer: 20 * 1024 * 1024,
      });
    } catch {
      await fs.rm(localPath, { recursive: true, force: true });
      await execFileAsync("git", ["clone", normalizedUrl, localPath], {
        maxBuffer: 20 * 1024 * 1024,
      });
    }
  }

  return {
    url: normalizedUrl,
    owner: parsed.owner,
    repo: parsed.repo,
    localPath,
  };
}