// lib/graph/build.ts

import path from "path";

import type {
  DependencyGraph,
  GraphEdge,
  GraphNode,
} from "./types";

import {
  createEdgeId,
  createNodeId,
} from "./types";

import type {
  ParsedFile,
  ParsedRepository,
  ParsedSymbol,
} from "@/lib/parser/symbols";

function normalizePath(value: string): string {
  return value
    .replace(/\\/g, "/")
    .replace(/^\.\//, "");
}

function withoutExtension(value: string): string {
  return value.replace(
    /\.(tsx?|jsx?)$/,
    ""
  );
}

function resolveImport(
  sourceFile: string,
  importPath: string,
  files: ParsedFile[]
): ParsedFile | undefined {
  if (!importPath.startsWith(".")) {
    return undefined;
  }

  const directory =
    path.posix.dirname(sourceFile);

  const resolved = normalizePath(
    path.posix.normalize(
      path.posix.join(
        directory,
        importPath
      )
    )
  );

  return files.find((file) => {
    const candidate =
      normalizePath(file.filePath);

    const noExtension =
      withoutExtension(candidate);

    return (
      candidate === resolved ||
      noExtension === resolved ||
      noExtension === `${resolved}/index`
    );
  });
}

function findSymbolCandidates(
  repository: ParsedRepository,
  name: string
): ParsedSymbol[] {
  const simple =
    name.split(".").pop() ?? name;

  return repository.symbols.filter(
    (symbol) =>
      symbol.name === name ||
      symbol.name === simple ||
      symbol.name.endsWith(`.${simple}`)
  );
}

export function buildDependencyGraph(
  repository: ParsedRepository
): DependencyGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  function addNode(node: GraphNode) {
    if (nodeIds.has(node.id)) return;

    nodeIds.add(node.id);
    nodes.push(node);
  }

  function addEdge(edge: GraphEdge) {
    if (
      edgeIds.has(edge.id) ||
      edge.source === edge.target
    ) {
      return;
    }

    edgeIds.add(edge.id);
    edges.push(edge);
  }

  for (const file of repository.files) {
    const fileNodeId = createNodeId(
      file.filePath,
      "file",
      file.filePath
    );

    addNode({
      id: fileNodeId,
      name: file.filePath,
      type: "file",
      filePath: file.filePath,
    });

    for (const symbol of file.symbols) {
      addNode({
        id: symbol.id,
        name: symbol.name,
        type: symbol.type,
        filePath: symbol.filePath,

        location: {
          filePath: symbol.filePath,
          startLine: symbol.startLine,
          endLine: symbol.endLine,
        },

        metadata: symbol.metadata,
      });

      const edgeId = createEdgeId(
        fileNodeId,
        symbol.id,
        "contains"
      );

      addEdge({
        id: edgeId,
        source: fileNodeId,
        target: symbol.id,
        type: "contains",
      });
    }
  }

  for (const file of repository.files) {
    const sourceFileId = createNodeId(
      file.filePath,
      "file",
      file.filePath
    );

    for (const imported of file.imports) {
      const targetFile = resolveImport(
        file.filePath,
        imported.source,
        repository.files
      );

      if (!targetFile) continue;

      const targetFileId = createNodeId(
        targetFile.filePath,
        "file",
        targetFile.filePath
      );

      addEdge({
        id: createEdgeId(
          sourceFileId,
          targetFileId,
          "imports"
        ),

        source: sourceFileId,
        target: targetFileId,
        type: "imports",
      });
    }
  }

  for (const symbol of repository.symbols) {
    for (const call of symbol.calls ?? []) {
      const cleanName =
        call.name
          .replace(/\([^)]*\)/g, "")
          .split(".")
          .pop() ?? call.name;

      const candidates =
        findSymbolCandidates(
          repository,
          cleanName
        );

      for (const target of candidates.slice(0, 3)) {
        addEdge({
          id: createEdgeId(
            symbol.id,
            target.id,
            "calls"
          ),

          source: symbol.id,
          target: target.id,
          type: "calls",

          metadata: {
            line: call.line,
          },
        });
      }
    }

    for (
      const reference of
      symbol.references ?? []
    ) {
      const candidates =
        findSymbolCandidates(
          repository,
          reference.name
        );

      for (const target of candidates.slice(0, 3)) {
        const type =
          target.type === "database_field"
            ? "uses_field"
            : "uses";

        addEdge({
          id: createEdgeId(
            symbol.id,
            target.id,
            type
          ),

          source: symbol.id,
          target: target.id,
          type,

          metadata: {
            line: reference.line,
          },
        });
      }
    }
  }

  return {
    nodes,
    edges,
  };
}