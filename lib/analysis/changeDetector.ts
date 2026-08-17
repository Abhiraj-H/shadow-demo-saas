// lib/analysis/changeDetector.ts

import type {
  ChangedSymbol,
  NodeType,
} from "@/lib/graph/types";

import type {
  ParsedRepository,
  ParsedSymbol,
} from "@/lib/parser/symbols";

export interface DiffLine {
  type: "context" | "added" | "removed";

  content: string;

  oldLine?: number;
  newLine?: number;
}

export interface DiffHunk {
  oldStart: number;
  oldCount: number;

  newStart: number;
  newCount: number;

  lines: DiffLine[];
}

export interface ChangedFile {
  oldPath: string;
  newPath: string;

  status: "added" | "modified" | "deleted" | "renamed";

  hunks: DiffHunk[];
}

export interface ChangeDetectionResult {
  files: ChangedFile[];
  changedSymbols: ChangedSymbol[];
}

function cleanGitPath(path: string): string {
  return path
    .replace(/^a\//, "")
    .replace(/^b\//, "")
    .trim();
}

function parseHunkHeader(line: string): {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
} | null {
  const match = line.match(
    /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/
  );

  if (!match) {
    return null;
  }

  return {
    oldStart: Number(match[1]),
    oldCount: Number(match[2] ?? 1),
    newStart: Number(match[3]),
    newCount: Number(match[4] ?? 1),
  };
}

export function parseUnifiedDiff(
  diff: string
): ChangedFile[] {
  const lines = diff.split("\n");

  const files: ChangedFile[] = [];

  let currentFile: ChangedFile | null = null;
  let currentHunk: DiffHunk | null = null;

  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      if (currentFile) {
        files.push(currentFile);
      }

      const match = line.match(
        /^diff --git a\/(.+?) b\/(.+)$/
      );

      currentFile = {
        oldPath: match?.[1] ?? "",
        newPath: match?.[2] ?? "",
        status: "modified",
        hunks: [],
      };

      currentHunk = null;

      continue;
    }

    if (!currentFile) {
      continue;
    }

    if (line.startsWith("new file mode")) {
      currentFile.status = "added";
      continue;
    }

    if (line.startsWith("deleted file mode")) {
      currentFile.status = "deleted";
      continue;
    }

    if (line.startsWith("rename from ")) {
      currentFile.status = "renamed";
      currentFile.oldPath = cleanGitPath(
        line.slice("rename from ".length)
      );
      continue;
    }

    if (line.startsWith("rename to ")) {
      currentFile.status = "renamed";
      currentFile.newPath = cleanGitPath(
        line.slice("rename to ".length)
      );
      continue;
    }

    if (line.startsWith("--- ")) {
      const value = line.slice(4);

      if (value !== "/dev/null") {
        currentFile.oldPath = cleanGitPath(value);
      }

      continue;
    }

    if (line.startsWith("+++ ")) {
      const value = line.slice(4);

      if (value !== "/dev/null") {
        currentFile.newPath = cleanGitPath(value);
      }

      continue;
    }

    if (line.startsWith("@@")) {
      const header = parseHunkHeader(line);

      if (!header) {
        continue;
      }

      currentHunk = {
        ...header,
        lines: [],
      };

      currentFile.hunks.push(currentHunk);

      oldLine = header.oldStart;
      newLine = header.newStart;

      continue;
    }

    if (!currentHunk) {
      continue;
    }

    if (line.startsWith("+") && !line.startsWith("+++")) {
      currentHunk.lines.push({
        type: "added",
        content: line.slice(1),
        newLine,
      });

      newLine += 1;

      continue;
    }

    if (line.startsWith("-") && !line.startsWith("---")) {
      currentHunk.lines.push({
        type: "removed",
        content: line.slice(1),
        oldLine,
      });

      oldLine += 1;

      continue;
    }

    if (line.startsWith("\\")) {
      continue;
    }

    currentHunk.lines.push({
      type: "context",
      content: line.startsWith(" ")
        ? line.slice(1)
        : line,
      oldLine,
      newLine,
    });

    oldLine += 1;
    newLine += 1;
  }

  if (currentFile) {
    files.push(currentFile);
  }

  return files;
}

function symbolTouchesLine(
  symbol: ParsedSymbol,
  line: number
): boolean {
  if (
    symbol.startLine === undefined ||
    symbol.endLine === undefined
  ) {
    return false;
  }

  return (
    line >= symbol.startLine &&
    line <= symbol.endLine
  );
}

function detectChangeType(
  symbol: ParsedSymbol,
  addedLines: string[],
  removedLines: string[],
  fileStatus: ChangedFile["status"]
): ChangedSymbol["changeType"] {
  if (fileStatus === "added") {
    return "added";
  }

  if (fileStatus === "deleted") {
    return "deleted";
  }

  const before = removedLines.join("\n");
  const after = addedLines.join("\n");

  const looksLikeSignature =
    symbol.type === "function" ||
    symbol.type === "class" ||
    symbol.type === "interface" ||
    symbol.type === "type";

  if (
    looksLikeSignature &&
    before &&
    after &&
    before !== after
  ) {
    const signaturePattern =
      /\b(function|class|interface|type|async|export|const|let|var)\b|\([^)]*\)\s*(?::[^=({]+)?/;

    if (
      signaturePattern.test(before) ||
      signaturePattern.test(after)
    ) {
      return "signature_changed";
    }
  }

  const typeIndicators = [
    "string",
    "number",
    "boolean",
    "null",
    "undefined",
    "?",
    "|",
    "String",
    "Int",
    "Boolean",
    "DateTime",
  ];

  const typeChanged = typeIndicators.some(
    (indicator) =>
      before.includes(indicator) !==
      after.includes(indicator)
  );

  if (typeChanged) {
    return "type_changed";
  }

  return "modified";
}

function findSymbolsForFile(
  repository: ParsedRepository,
  filePath: string
): ParsedSymbol[] {
  return repository.symbols.filter(
    (symbol) =>
      symbol.filePath === filePath ||
      symbol.filePath.replace(/^\.\//, "") ===
        filePath.replace(/^\.\//, "")
  );
}

function createFallbackFileChange(
  file: ChangedFile
): ChangedSymbol {
  const path =
    file.status === "deleted"
      ? file.oldPath
      : file.newPath;

  return {
    nodeId: `${path}:file:${path}`,
    name: path,
    type: "file",
    filePath: path,
    changeType:
      file.status === "added"
        ? "added"
        : file.status === "deleted"
          ? "deleted"
          : "modified",
  };
}

export function detectChangedSymbols(
  diff: string,
  repository: ParsedRepository
): ChangeDetectionResult {
  const files = parseUnifiedDiff(diff);

  const changedSymbols: ChangedSymbol[] = [];

  for (const file of files) {
    const filePath =
      file.status === "deleted"
        ? file.oldPath
        : file.newPath;

    const symbols = findSymbolsForFile(
      repository,
      filePath
    );

    if (symbols.length === 0) {
      changedSymbols.push(
        createFallbackFileChange(file)
      );

      continue;
    }

    const touched = new Set<string>();

    for (const hunk of file.hunks) {
      const addedLines = hunk.lines.filter(
        (line) => line.type === "added"
      );

      const removedLines = hunk.lines.filter(
        (line) => line.type === "removed"
      );

      for (const symbol of symbols) {
        const symbolAddedLines = addedLines.filter(
          (line) =>
            line.newLine !== undefined &&
            symbolTouchesLine(
              symbol,
              line.newLine
            )
        );

        const symbolRemovedLines =
          removedLines.filter(
            (line) =>
              line.oldLine !== undefined &&
              symbolTouchesLine(
                symbol,
                line.oldLine
              )
          );

        if (
          symbolAddedLines.length === 0 &&
          symbolRemovedLines.length === 0
        ) {
          continue;
        }

        if (touched.has(symbol.id)) {
          continue;
        }

        touched.add(symbol.id);

        const before = symbolRemovedLines
          .map((line) => line.content)
          .join("\n");

        const after = symbolAddedLines
          .map((line) => line.content)
          .join("\n");

        changedSymbols.push({
          nodeId: symbol.id,
          name: symbol.name,
          type: symbol.type,
          filePath: symbol.filePath,

          changeType: detectChangeType(
            symbol,
            symbolAddedLines.map(
              (line) => line.content
            ),
            symbolRemovedLines.map(
              (line) => line.content
            ),
            file.status
          ),

          before: before || undefined,
          after: after || undefined,
        });
      }
    }

    if (touched.size === 0) {
      changedSymbols.push(
        createFallbackFileChange(file)
      );
    }
  }

  return {
    files,
    changedSymbols,
  };
}

export function filterChangesByType(
  changes: ChangedSymbol[],
  types: NodeType[]
): ChangedSymbol[] {
  return changes.filter((change) =>
    types.includes(change.type)
  );
}

export function getHighImpactChanges(
  changes: ChangedSymbol[]
): ChangedSymbol[] {
  return changes.filter((change) =>
    [
      "deleted",
      "signature_changed",
      "type_changed",
    ].includes(change.changeType)
  );
}