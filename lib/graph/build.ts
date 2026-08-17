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

function canonicalFieldId(
  fieldName: string
): string {
  return `field:${fieldName}`;
}

function normalizePath(
  value: string
): string {
  return value
    .replace(/\\/g, "/")
    .replace(/^\.\//, "");
}

function withoutExtension(
  value: string
): string {
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

  const resolved =
    normalizePath(
      path.posix.normalize(
        path.posix.join(
          directory,
          importPath
        )
      )
    );

  return files.find((file) => {
    const candidate =
      normalizePath(
        file.filePath
      );

    const noExtension =
      withoutExtension(
        candidate
      );

    return (
      candidate === resolved ||
      noExtension === resolved ||
      noExtension ===
        `${resolved}/index`
    );
  });
}

function findExactSymbol(
  repository: ParsedRepository,
  name: string
): ParsedSymbol | undefined {
  const exact =
    repository.symbols.find(
      (symbol) =>
        symbol.name === name
    );

  if (exact) return exact;

  const simple =
    name.split(".").pop();

  if (!simple) return undefined;

  const candidates =
    repository.symbols.filter(
      (symbol) =>
        symbol.name === simple
    );

  return candidates.length === 1
    ? candidates[0]
    : undefined;
}

function extractInterfaceFields(
  symbol: ParsedSymbol
): string[] {
  if (
    symbol.type !== "interface" &&
    symbol.type !== "type"
  ) {
    return [];
  }

  const code =
    symbol.code ?? "";

  const results: string[] = [];

  const regex =
    /(?:^|\n)\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\??\s*:\s*([^;\n}]+)/g;

  let match: RegExpExecArray | null;

  while (
    (match = regex.exec(code))
  ) {
    results.push(
      `${symbol.name}.${match[1]}`
    );
  }

  return results;
}

function extractVariableTypes(
  code: string
): Map<string, string> {
  const result =
    new Map<string, string>();

  const regex =
    /\b([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*)\b/g;

  let match: RegExpExecArray | null;

  while (
    (match = regex.exec(code))
  ) {
    result.set(
      match[1],
      match[2]
    );
  }

  return result;
}

interface FieldUsage {
  fullFieldName: string;
  variable: string;
  property: string;

  kind:
    | "property_access"
    | "method_call"
    | "argument";

  method?: string;
  callee?: string;

  expression: string;
}

function extractFieldUsages(
  code: string
): FieldUsage[] {
  const variableTypes =
    extractVariableTypes(code);

  const usages: FieldUsage[] = [];

  const seen = new Set<string>();

  const methodRegex =
    /\b([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\s*\(/g;

  let methodMatch:
    | RegExpExecArray
    | null;

  while (
    (methodMatch =
      methodRegex.exec(code))
  ) {
    const [
      expression,
      variable,
      property,
      method,
    ] = methodMatch;

    const typeName =
      variableTypes.get(variable);

    if (!typeName) continue;

    const fullFieldName =
      `${typeName}.${property}`;

    const key =
      `${fullFieldName}:method:${method}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    usages.push({
      fullFieldName,
      variable,
      property,
      kind: "method_call",
      method,
      expression: `${variable}.${property}.${method}()`,
    });
  }

  const callRegex =
    /\b([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/g;

  let callMatch:
    | RegExpExecArray
    | null;

  while (
    (callMatch =
      callRegex.exec(code))
  ) {
    const callee =
      callMatch[1];

    const argumentsText =
      callMatch[2];

    for (
      const [
        variable,
        typeName,
      ] of variableTypes.entries()
    ) {
      const fieldRegex =
        new RegExp(
          `\\b${variable}\\.([A-Za-z_$][\\w$]*)\\b`,
          "g"
        );

      let fieldMatch:
        | RegExpExecArray
        | null;

      while (
        (fieldMatch =
          fieldRegex.exec(
            argumentsText
          ))
      ) {
        const property =
          fieldMatch[1];

        const fullFieldName =
          `${typeName}.${property}`;

        const key =
          `${fullFieldName}:arg:${callee}`;

        if (seen.has(key)) {
          continue;
        }

        seen.add(key);

        usages.push({
          fullFieldName,
          variable,
          property,
          kind: "argument",
          callee,
          expression:
            `${callee}(${variable}.${property})`,
        });
      }
    }
  }

  const propertyRegex =
    /\b([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\b/g;

  let propertyMatch:
    | RegExpExecArray
    | null;

  while (
    (propertyMatch =
      propertyRegex.exec(code))
  ) {
    const [
      expression,
      variable,
      property,
    ] = propertyMatch;

    const typeName =
      variableTypes.get(variable);

    if (!typeName) continue;

    const fullFieldName =
      `${typeName}.${property}`;

    const alreadySpecific =
      usages.some(
        (usage) =>
          usage.fullFieldName ===
          fullFieldName
      );

    if (alreadySpecific) {
      continue;
    }

    const key =
      `${fullFieldName}:access`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    usages.push({
      fullFieldName,
      variable,
      property,
      kind: "property_access",
      expression,
    });
  }

  return usages;
}

export function buildDependencyGraph(
  repository: ParsedRepository
): DependencyGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const nodeIds =
    new Set<string>();

  const edgeIds =
    new Set<string>();

  function addNode(
    node: GraphNode
  ) {
    if (
      nodeIds.has(node.id)
    ) {
      return;
    }

    nodeIds.add(node.id);
    nodes.push(node);
  }

  function addEdge(
    edge: GraphEdge
  ) {
    if (
      edgeIds.has(edge.id) ||
      edge.source === edge.target
    ) {
      return;
    }

    edgeIds.add(edge.id);
    edges.push(edge);
  }

  // ------------------------------------------------
  // Files and normal parsed symbols
  // ------------------------------------------------

  for (const file of repository.files) {
    const fileNodeId =
      createNodeId(
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
        filePath:
          symbol.filePath,

        location: {
          filePath:
            symbol.filePath,
          startLine:
            symbol.startLine,
          endLine:
            symbol.endLine,
        },

        metadata:
          symbol.metadata,
      });

      addEdge({
        id: createEdgeId(
          fileNodeId,
          symbol.id,
          "contains"
        ),

        source:
          fileNodeId,

        target:
          symbol.id,

        type: "contains",
      });
    }
  }

  // ------------------------------------------------
  // Canonical field nodes
  //
  // User.email from Prisma and User.email from
  // TypeScript become ONE semantic graph node:
  //
  // field:User.email
  // ------------------------------------------------

  for (const symbol of repository.symbols) {
    if (
      symbol.type ===
      "database_field"
    ) {
      addNode({
        id:
          canonicalFieldId(
            symbol.name
          ),

        name: symbol.name,

        type:
          "database_field",

        filePath:
          symbol.filePath,

        metadata: {
          ...symbol.metadata,
          semanticField: true,
        },
      });
    }

    for (const field of extractInterfaceFields(
      symbol
    )) {
      addNode({
        id:
          canonicalFieldId(
            field
          ),

        name: field,

        type: "type",

        filePath:
          symbol.filePath,

        metadata: {
          semanticField: true,
          parentType:
            symbol.name,
        },
      });
    }
  }

  // ------------------------------------------------
  // Imports
  // ------------------------------------------------

  for (const file of repository.files) {
    const sourceFileId =
      createNodeId(
        file.filePath,
        "file",
        file.filePath
      );

    for (const imported of file.imports) {
      const targetFile =
        resolveImport(
          file.filePath,
          imported.source,
          repository.files
        );

      if (!targetFile) {
        continue;
      }

      const targetFileId =
        createNodeId(
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

        source:
          sourceFileId,

        target:
          targetFileId,

        type: "imports",
      });
    }
  }

  // ------------------------------------------------
  // Function calls
  // ------------------------------------------------

  for (const symbol of repository.symbols) {
    for (
      const call of
      symbol.calls ?? []
    ) {
      const cleanName =
        call.name
          .replace(
            /\([^)]*\)/g,
            ""
          )
          .split(".")
          .pop();

      if (!cleanName) {
        continue;
      }

      const target =
        findExactSymbol(
          repository,
          cleanName
        );

      if (!target) {
        continue;
      }

      addEdge({
        id: createEdgeId(
          symbol.id,
          target.id,
          "calls"
        ),

        source:
          symbol.id,

        target:
          target.id,

        type: "calls",

        metadata: {
          line: call.line,
        },
      });
    }
  }

  // ------------------------------------------------
  // Exact typed property usage
  //
  // Example:
  //
  // function syncBillingCustomer(user: User) {
  //   user.email.toLowerCase()
  // }
  //
  // becomes:
  //
  // syncBillingCustomer
  //     --uses_field-->
  // field:User.email
  // ------------------------------------------------

  for (const symbol of repository.symbols) {
    const code =
      symbol.code ?? "";

    if (!code) continue;

    const usages =
      extractFieldUsages(code);

    for (const usage of usages) {
      const fieldNodeId =
        canonicalFieldId(
          usage.fullFieldName
        );

      if (
        !nodeIds.has(
          fieldNodeId
        )
      ) {
        continue;
      }

      addEdge({
        id:
          `${symbol.id}->${fieldNodeId}:uses_field:${usage.kind}:${usage.method ?? usage.callee ?? "access"}`,

        source:
          symbol.id,

        target:
          fieldNodeId,

        type:
          "uses_field",

        metadata: {
          usageKind:
            usage.kind,

          method:
            usage.method,

          callee:
            usage.callee,

          expression:
            usage.expression,

          field:
            usage.fullFieldName,
        },
      });
    }
  }

  return {
    nodes,
    edges,
  };
}