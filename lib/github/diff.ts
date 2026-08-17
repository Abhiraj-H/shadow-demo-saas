// lib/github/diff.ts

import { execFile } from "child_process";
import { promisify } from "util";
import type { ClonedRepo } from "./client";

const execFileAsync = promisify(execFile);

export async function fetchCompareDiff(
  clonedRepo: ClonedRepo,
  base: string,
  head: string
): Promise<string> {
  const localPath = clonedRepo.localPath;

  try {
    const { stdout } = await execFileAsync(
      "git",
      ["diff", `origin/${base}...origin/${head}`],
      {
        cwd: localPath,
        maxBuffer: 20 * 1024 * 1024,
      }
    );

    if (stdout && stdout.trim().length > 0) {
      return stdout;
    }
  } catch {
    // Fallback to local branches if origin refs aren't prefixed
  }

  try {
    const { stdout } = await execFileAsync(
      "git",
      ["diff", `${base}...${head}`],
      {
        cwd: localPath,
        maxBuffer: 20 * 1024 * 1024,
      }
    );

    return stdout || "";
  } catch (error) {
    console.error("Git diff failed:", error);
    return "";
  }
}