// lib/github/repository.ts

import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import type { ClonedRepo } from "./client";

const execFileAsync = promisify(execFile);

export interface RepositoryFile {
  path: string;
  content: string;
  sha?: string;
  size: number;
}

const supportedExtensions = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".prisma",
];

function isSupported(filePath: string): boolean {
  return supportedExtensions.some((ext) => filePath.endsWith(ext));
}

function isIgnored(filePath: string): boolean {
  return [
    ".git",
    "node_modules",
    ".next",
    "dist",
    "build",
    "coverage",
    "vendor",
    ".turbo",
    ".cache",
  ].some((ignored) =>
    filePath.split("/").includes(ignored) ||
    filePath.split("\\").includes(ignored)
  );
}

async function collectFiles(
  dir: string,
  baseDir: string
): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, "/");

    if (isIgnored(relPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      const nested = await collectFiles(fullPath, baseDir);
      results.push(...nested);
    } else if (entry.isFile() && isSupported(entry.name)) {
      results.push(relPath);
    }
  }

  return results;
}

export async function fetchRepositoryFiles(
  clonedRepo: ClonedRepo,
  ref: string
): Promise<RepositoryFile[]> {
  const localPath = clonedRepo.localPath;

  try {
    await execFileAsync("git", ["checkout", "-f", `origin/${ref}`], {
      cwd: localPath,
    }).catch(async () => {
      await execFileAsync("git", ["checkout", "-f", ref], {
        cwd: localPath,
      });
    });
  } catch (err) {
    console.warn(`Could not checkout ${ref}:`, err);
  }

  const relativePaths = await collectFiles(localPath, localPath);
  const files: RepositoryFile[] = [];

  for (const relPath of relativePaths) {
    const fullPath = path.join(localPath, relPath);
    const content = await fs.readFile(fullPath, "utf-8");

    files.push({
      path: relPath,
      content,
      size: Buffer.byteLength(content, "utf-8"),
    });
  }

  return files;
}