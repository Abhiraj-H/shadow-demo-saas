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

export function canonicalFieldId(
  fieldName: string
): string {
  return `field:${fieldName}`;
}

function cleanGitPath(path: string): string {
  return path
    .replace(/^a\//, "")
    .replace(/^b\//, "")
    .trim();
}

function parseHunkHeader(line: string) {
  const match = line.match(
    /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/
  );

  if (!match) return null;

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

    if (!currentFile) continue;

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

      if (!header) continue;

      currentHunk = {
        ...header,
        lines: [],
      };

      currentFile.hunks.push(currentHunk);

      oldLine = header.oldStart;
      newLine = header.newStart;

      continue;
    }

    if (!currentHunk) continue;

    if (
      line.startsWith("+") &&
      !line.startsWith("+++")
    ) {
      currentHunk.lines.push({
        type: "added",
        content: line.slice(1),
        newLine,
      });

      newLine++;
      continue;
    }

    if (
      line.startsWith("-") &&
      !line.startsWith("---")
    ) {
      currentHunk.lines.push({
        type: "removed",
        content: line.slice(1),
        oldLine,
      });

      oldLine++;
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

    oldLine++;
    newLine++;
  }

  if (currentFile) {
    files.push(currentFile);
  }

  return files;
}

function normalizePath(value: string) {
  return value
    .replace(/\\/g, "/")
    .replace(/^\.\//, "");
}

function getSymbolsForFile(
  repository: ParsedRepository,
  filePath: string
): ParsedSymbol[] {
  const normalized = normalizePath(filePath);

  return repository.symbols.filter(
    (symbol) =>
      normalizePath(symbol.filePath) === normalized
  );
}

function lineInsideSymbol(
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
  before: string,
  after: string
): ChangedSymbol["changeType"] {
  if (!before && after) return "added";
  if (before && !after) return "deleted";

  if (
    before !== after &&
    (
      before.includes(":") ||
      after.includes(":") ||
      before.includes("String") ||
      after.includes("String") ||
      before.includes("?") ||
      after.includes("?") ||
      before.includes("|") ||
      after.includes("|")
    )
  ) {
    return "type_changed";
  }

  return "modified";
}

function parseTypeScriptProperty(
  line: string
): {
  name: string;
  type: string;
} | null {
  const cleaned = line.trim();

  const match = cleaned.match(
    /^(?:readonly\s+)?([A-Za-z_$][\w$]*)(\?)?\s*:\s*([^;]+);?$/
  );

  if (!match) return null;

  return {
    name: match[1],
    type:
      `${match[2] ? "?" : ""}${match[3].trim()}`,
  };
}

function findEnclosingType(
  symbols: ParsedSymbol[],
  lineNumber: number
): ParsedSymbol | undefined {
  return symbols
    .filter(
      (symbol) =>
        (
          symbol.type === "interface" ||
          symbol.type === "type"
        ) &&
        lineInsideSymbol(
          symbol,
          lineNumber
        )
    )
    .sort((a, b) => {
      const aSize =
        (a.endLine ?? 0) -
        (a.startLine ?? 0);

      const bSize =
        (b.endLine ?? 0) -
        (b.startLine ?? 0);

      return aSize - bSize;
    })[0];
}

function detectTypeScriptFieldChanges(
  file: ChangedFile,
  symbols: ParsedSymbol[]
): ChangedSymbol[] {
  const changes: ChangedSymbol[] = [];

  for (const hunk of file.hunks) {
    const removed =
      hunk.lines.filter(
        (line) => line.type === "removed"
      );

    const added =
      hunk.lines.filter(
        (line) => line.type === "added"
      );

    for (const removedLine of removed) {
      const beforeProperty =
        parseTypeScriptProperty(
          removedLine.content
        );

      if (!beforeProperty) continue;

      const matchingAdded =
        added.find((candidate) => {
          const property =
            parseTypeScriptProperty(
              candidate.content
            );

          return (
            property?.name ===
            beforeProperty.name
          );
        });

      if (!matchingAdded) continue;

      const afterProperty =
        parseTypeScriptProperty(
          matchingAdded.content
        );

      if (!afterProperty) continue;

      const sourceLine =
        removedLine.oldLine ??
        matchingAdded.newLine;

      if (sourceLine === undefined) {
        continue;
      }

      const parent =
        findEnclosingType(
          symbols,
          sourceLine
        );

      if (!parent) continue;

      const fullName =
        `${parent.name}.${beforeProperty.name}`;

      changes.push({
        nodeId:
          canonicalFieldId(
            fullName
          ),

        name: fullName,

        type: "type",

        filePath:
          parent.filePath,

        changeType:
          detectChangeType(
            removedLine.content,
            matchingAdded.content
          ),

        before:
          removedLine.content.trim(),

        after:
          matchingAdded.content.trim(),
      });
    }
  }

  return changes;
}

function detectPrismaFieldChanges(
  file: ChangedFile,
  symbols: ParsedSymbol[]
): ChangedSymbol[] {
  const changes: ChangedSymbol[] = [];

  const fields = symbols.filter(
    (symbol) =>
      symbol.type === "database_field"
  );

  for (const field of fields) {
    // Extract the short field name (e.g. "email" from "User.email")
    const shortName =
      field.name.split(".").pop() ?? field.name;

    const removedLines: DiffLine[] = [];
    const addedLines: DiffLine[] = [];

    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        // Content must mention the actual field name to avoid
        // false positives from line-number shifting in diffs
        const contentMentionsField =
          new RegExp(`\\b${shortName}\\b`).test(line.content);

        if (!contentMentionsField) continue;

        if (
          line.type === "removed" &&
          line.oldLine !== undefined &&
          lineInsideSymbol(field, line.oldLine)
        ) {
          removedLines.push(line);
        }

        if (
          line.type === "added" &&
          line.newLine !== undefined &&
          lineInsideSymbol(field, line.newLine)
        ) {
          addedLines.push(line);
        }
      }
    }

    if (
      removedLines.length === 0 &&
      addedLines.length === 0
    ) {
      continue;
    }

    const before =
      removedLines
        .map((line) =>
          line.content.trim()
        )
        .join("\n");

    const after =
      addedLines
        .map((line) =>
          line.content.trim()
        )
        .join("\n");

    changes.push({
      nodeId:
        canonicalFieldId(
          field.name
        ),

      name: field.name,

      type: "database_field",

      filePath:
        field.filePath,

      changeType:
        detectChangeType(
          before,
          after
        ),

      before:
        before || undefined,

      after:
        after || undefined,
    });
  }

  return changes;
}

function detectNormalSymbolChanges(
  file: ChangedFile,
  symbols: ParsedSymbol[]
): ChangedSymbol[] {
  const changes: ChangedSymbol[] = [];

  for (const symbol of symbols) {
    if (
      symbol.type === "database_model" ||
      symbol.type === "database_field" ||
      symbol.type === "interface" ||
      symbol.type === "type"
    ) {
      continue;
    }

    const removed: string[] = [];
    const added: string[] = [];

    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        if (
          line.type === "removed" &&
          line.oldLine !== undefined &&
          lineInsideSymbol(
            symbol,
            line.oldLine
          )
        ) {
          removed.push(line.content);
        }

        if (
          line.type === "added" &&
          line.newLine !== undefined &&
          lineInsideSymbol(
            symbol,
            line.newLine
          )
        ) {
          added.push(line.content);
        }
      }
    }

    if (
      removed.length === 0 &&
      added.length === 0
    ) {
      continue;
    }

    const before =
      removed.join("\n");

    const after =
      added.join("\n");

    changes.push({
      nodeId: symbol.id,
      name: symbol.name,
      type: symbol.type,
      filePath:
        symbol.filePath,

      changeType:
        detectChangeType(
          before,
          after
        ),

      before:
        before || undefined,

      after:
        after || undefined,
    });
  }

  return changes;
}

function semanticKey(
  change: ChangedSymbol
) {
  return [
    change.nodeId,
    change.filePath,
    change.before ?? "",
    change.after ?? "",
  ].join(":");
}

export function detectChangedSymbols(
  diff: string,
  repository: ParsedRepository
): ChangeDetectionResult {
  const files =
    parseUnifiedDiff(diff);

  const allChanges: ChangedSymbol[] = [];

  for (const file of files) {
    const filePath =
      file.status === "deleted"
        ? file.oldPath
        : file.newPath;

    const symbols =
      getSymbolsForFile(
        repository,
        filePath
      );

    const prismaChanges =
      filePath.endsWith(".prisma")
        ? detectPrismaFieldChanges(
            file,
            symbols
          )
        : [];

    const tsFieldChanges =
      /\.(tsx?|jsx?)$/.test(
        filePath
      )
        ? detectTypeScriptFieldChanges(
            file,
            symbols
          )
        : [];

    const normalChanges =
      detectNormalSymbolChanges(
        file,
        symbols
      );

    allChanges.push(
      ...prismaChanges,
      ...tsFieldChanges,
      ...normalChanges
    );
  }

  const seen = new Set<string>();

  const changedSymbols =
    allChanges.filter((change) => {
      const key =
        semanticKey(change);

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });

  return {
    files,
    changedSymbols,
  };
}

export function filterChangesByType(
  changes: ChangedSymbol[],
  types: NodeType[]
): ChangedSymbol[] {
  return changes.filter(
    (change) =>
      types.includes(change.type)
  );
}

export function getHighImpactChanges(
  changes: ChangedSymbol[]
): ChangedSymbol[] {
  return changes.filter(
    (change) =>
      [
        "deleted",
        "signature_changed",
        "type_changed",
      ].includes(
        change.changeType
      )
  );
}