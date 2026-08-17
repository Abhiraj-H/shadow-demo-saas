// lib/analysis/deterministicRules.ts

import type {
  ChangedSymbol,
  DependencyGraph,
  GraphEdge,
  GraphNode,
  GraphTraversalNode,
} from "@/lib/graph/types";

import type {
  RiskCandidate,
  RiskCategory,
  RiskSeverity,
} from "./riskScore";

export interface DeterministicAnalysisInput {
  changes: ChangedSymbol[];
  graph: DependencyGraph;
  affectedNodes?: GraphTraversalNode[];
}

function createRiskId(
  rule: string,
  changedNodeId: string,
  affectedNodeId?: string
): string {
  return [
    "static",
    rule,
    changedNodeId,
    affectedNodeId ?? "none",
  ].join(":");
}

function normalizeNullableChange(
  change: ChangedSymbol
): boolean {
  const before =
    change.before ?? "";

  const after =
    change.after ?? "";

  const beforeNullable =
    before.includes("null") ||
    before.includes("undefined") ||
    /\w+\?/.test(before) ||
    /String\?/.test(before);

  const afterNullable =
    after.includes("null") ||
    after.includes("undefined") ||
    /\w+\?/.test(after) ||
    /String\?/.test(after);

  return (
    !beforeNullable &&
    afterNullable
  );
}

function getUsageEdges(
  graph: DependencyGraph,
  nodeId: string
): GraphEdge[] {
  return graph.edges.filter(
    (edge) =>
      edge.target === nodeId &&
      edge.type ===
      "uses_field"
  );
}

function nodeById(
  graph: DependencyGraph,
  id: string
): GraphNode | undefined {
  return graph.nodes.find(
    (node) =>
      node.id === id
  );
}

function isDangerousStringMethod(
  method?: unknown
): boolean {
  if (
    typeof method !== "string"
  ) {
    return false;
  }

  return [
    "trim",
    "toLowerCase",
    "toUpperCase",
    "substring",
    "slice",
    "replace",
    "split",
    "includes",
    "startsWith",
    "endsWith",
    "charAt",
    "match",
  ].includes(method);
}

function nullableMethodRisk(
  change: ChangedSymbol,
  graph: DependencyGraph,
  edge: GraphEdge
): RiskCandidate | null {
  const metadata =
    edge.metadata ?? {};

  if (
    metadata.usageKind !==
    "method_call"
  ) {
    return null;
  }

  const method =
    typeof metadata.method ===
      "string"
      ? metadata.method
      : undefined;

  if (
    !isDangerousStringMethod(
      method
    )
  ) {
    return null;
  }

  const affected =
    nodeById(
      graph,
      edge.source
    );

  if (!affected) {
    return null;
  }

  const expression =
    typeof metadata.expression ===
      "string"
      ? metadata.expression
      : `${change.name}.${method}()`;

  return {
    id: createRiskId(
      `nullable-method-${method}`,
      change.nodeId,
      affected.id
    ),

    title:
      `Possible null dereference in ${affected.name}`,

    description:
      `${change.name} can now be null, but ${affected.name} calls ${method}() on it. This can throw at runtime.`,

    category: "runtime",

    severity: "critical",

    confidence: 0.99,

    source: "static",

    changedNodeId:
      change.nodeId,

    affectedNodeId:
      affected.id,

    changedSymbol:
      change.name,

    affectedSymbol:
      affected.name,

    filePath:
      affected.filePath,

    dependencyDepth: 1,

    failurePath: [
      change.name,
      affected.name,
      expression,
    ],

    evidence: [
      `${change.name} changed from required to nullable.`,
      `${affected.name} executes ${expression}.`,
      `${method}() cannot safely execute when the value is null.`,
    ],

    suggestedFix:
      `Check ${change.name} for null before calling ${method}(), or handle the phone-only user case explicitly.`,
  };
}

function nullableArgumentRisk(
  change: ChangedSymbol,
  graph: DependencyGraph,
  edge: GraphEdge
): RiskCandidate | null {
  const metadata =
    edge.metadata ?? {};

  if (
    metadata.usageKind !==
    "argument"
  ) {
    return null;
  }

  const affected =
    nodeById(
      graph,
      edge.source
    );

  if (!affected) {
    return null;
  }

  const callee =
    typeof metadata.callee ===
      "string"
      ? metadata.callee
      : "function";

  const expression =
    typeof metadata.expression ===
      "string"
      ? metadata.expression
      : `${callee}(${change.name})`;

  return {
    id: createRiskId(
      `nullable-argument-${callee}`,
      change.nodeId,
      affected.id
    ),

    title:
      `Nullable value passed to ${callee}`,

    description:
      `${affected.name} passes ${change.name} into ${callee} even though the value can now be null.`,

    category: "type",

    severity: "high",

    confidence: 0.94,

    source: "static",

    changedNodeId:
      change.nodeId,

    affectedNodeId:
      affected.id,

    changedSymbol:
      change.name,

    affectedSymbol:
      affected.name,

    filePath:
      affected.filePath,

    dependencyDepth: 1,

    failurePath: [
      change.name,
      affected.name,
      callee,
    ],

    evidence: [
      `${change.name} changed from required to nullable.`,
      `${affected.name} contains ${expression}.`,
    ],

    suggestedFix:
      `Guard ${change.name} before calling ${callee}, or update ${callee} to explicitly support null values.`,
  };
}

function genericNullableUsageRisk(
  change: ChangedSymbol,
  graph: DependencyGraph,
  edge: GraphEdge
): RiskCandidate | null {
  const metadata =
    edge.metadata ?? {};

  if (
    metadata.usageKind !==
    "property_access"
  ) {
    return null;
  }

  const affected =
    nodeById(
      graph,
      edge.source
    );

  if (!affected) {
    return null;
  }

  return {
    id: createRiskId(
      "nullable-property-access",
      change.nodeId,
      affected.id
    ),

    title:
      `${affected.name} uses newly nullable ${change.name}`,

    description:
      `${affected.name} directly consumes ${change.name}, which can now be null.`,

    category:
      "business_logic",

    severity:
      "medium",

    confidence: 0.78,

    source: "static",

    changedNodeId:
      change.nodeId,

    affectedNodeId:
      affected.id,

    changedSymbol:
      change.name,

    affectedSymbol:
      affected.name,

    filePath:
      affected.filePath,

    dependencyDepth: 1,

    failurePath: [
      change.name,
      affected.name,
    ],

    evidence: [
      `${change.name} changed from required to nullable.`,
      `${affected.name} directly references the field.`,
    ],

    suggestedFix:
      `Review how ${affected.name} behaves when ${change.name} is null.`,
  };
}

function nullableFieldRules(
  change: ChangedSymbol,
  graph: DependencyGraph
): RiskCandidate[] {
  if (
    !normalizeNullableChange(
      change
    )
  ) {
    return [];
  }

  const edges =
    getUsageEdges(
      graph,
      change.nodeId
    );

  const results:
    RiskCandidate[] = [];

  for (const edge of edges) {
    const methodRisk =
      nullableMethodRisk(
        change,
        graph,
        edge
      );

    if (methodRisk) {
      results.push(methodRisk);
      continue;
    }

    const argumentRisk =
      nullableArgumentRisk(
        change,
        graph,
        edge
      );

    if (argumentRisk) {
      results.push(argumentRisk);
      continue;
    }

    const genericRisk =
      genericNullableUsageRisk(
        change,
        graph,
        edge
      );

    if (genericRisk) {
      results.push(genericRisk);
    }
  }

  return results;
}

function deletedSymbolRule(
  change: ChangedSymbol,
  graph: DependencyGraph
): RiskCandidate[] {
  if (change.changeType !== "deleted") {
    return [];
  }

  const dependents = graph.edges.filter(
    (edge) => edge.target === change.nodeId
  );

  const results: RiskCandidate[] = [];

  for (const edge of dependents) {
    const affected = nodeById(graph, edge.source);
    if (!affected) continue;

    results.push({
      id: createRiskId(
        "deleted-symbol",
        change.nodeId,
        affected.id
      ),
      title: `${affected.name} depends on deleted ${change.name}`,
      description: `${change.name} was deleted but ${affected.name} still depends on it.`,
      category: "dependency",
      severity: "critical",
      confidence: 0.99,
      source: "static",
      changedNodeId: change.nodeId,
      affectedNodeId: affected.id,
      changedSymbol: change.name,
      affectedSymbol: affected.name,
      filePath: affected.filePath,
      dependencyDepth: 1,
      failurePath: [change.name, affected.name],
      evidence: [
        `${change.name} was deleted.`,
        `${affected.name} still has a dependency on it.`,
      ],
      suggestedFix: `Update ${affected.name} to remove or replace its dependency on ${change.name}.`,
    });
  }

  return results;
}

function signatureChangeRule(
  change: ChangedSymbol,
  graph: DependencyGraph
): RiskCandidate[] {
  if (change.changeType !== "signature_changed") {
    return [];
  }

  const callers = graph.edges.filter(
    (edge) => edge.target === change.nodeId && edge.type === "calls"
  );

  const results: RiskCandidate[] = [];

  for (const edge of callers) {
    const affected = nodeById(graph, edge.source);
    if (!affected) continue;

    results.push({
      id: createRiskId(
        "signature-change",
        change.nodeId,
        affected.id
      ),
      title: `${affected.name} may use an outdated ${change.name} signature`,
      description: `${change.name}'s function signature changed and ${affected.name} calls it.`,
      category: "api_breaking_change",
      severity: "high",
      confidence: 0.94,
      source: "static",
      changedNodeId: change.nodeId,
      affectedNodeId: affected.id,
      changedSymbol: change.name,
      affectedSymbol: affected.name,
      filePath: affected.filePath,
      dependencyDepth: 1,
      failurePath: [change.name, affected.name],
      evidence: [
        `Before: ${change.before ?? "unknown"}`,
        `After: ${change.after ?? "unknown"}`,
      ],
      suggestedFix: `Update the call to ${change.name} inside ${affected.name} to match its new signature.`,
    });
  }

  return results;
}

function semanticChangeKey(
  change: ChangedSymbol
) {
  return [
    change.name,
    change.before ?? "",
    change.after ?? "",
  ].join(":");
}

function dedupeSemanticChanges(
  changes: ChangedSymbol[]
): ChangedSymbol[] {
  const map =
    new Map<
      string,
      ChangedSymbol
    >();

  for (const change of changes) {
    const key =
      semanticChangeKey(
        change
      );

    const existing =
      map.get(key);

    if (!existing) {
      map.set(key, change);
      continue;
    }

    // Prefer Prisma field declaration
    // as canonical source when both
    // Prisma + TS type changed.
    if (
      change.type ===
      "database_field" &&
      existing.type !==
      "database_field"
    ) {
      map.set(key, change);
    }
  }

  return Array.from(map.values());
}

function dedupeRisks(
  risks: RiskCandidate[]
): RiskCandidate[] {
  const map =
    new Map<
      string,
      RiskCandidate
    >();

  for (const risk of risks) {
    const key = [
      risk.category,
      risk.changedSymbol,
      risk.affectedSymbol,
      risk.title,
    ].join(":");

    const existing =
      map.get(key);

    if (
      !existing ||
      risk.confidence >
      existing.confidence
    ) {
      map.set(key, risk);
    }
  }

  return Array.from(map.values());
}

export function runDeterministicRules(
  input: DeterministicAnalysisInput
): RiskCandidate[] {
  const changes =
    dedupeSemanticChanges(
      input.changes
    );

  const risks:
    RiskCandidate[] = [];

  for (const change of changes) {
    risks.push(
      ...nullableFieldRules(
        change,
        input.graph
      ),

      ...deletedSymbolRule(
        change,
        input.graph
      ),

      ...signatureChangeRule(
        change,
        input.graph
      )
    );
  }

  return dedupeRisks(risks);
}

export function findDirectDependents(
  graph: DependencyGraph,
  nodeId: string
): GraphNode[] {
  const ids =
    graph.edges
      .filter(
        (edge) =>
          edge.target ===
          nodeId
      )
      .map(
        (edge) =>
          edge.source
      );

  return graph.nodes.filter(
    (node) =>
      ids.includes(node.id)
  );
}

export function getChangedNode(
  graph: DependencyGraph,
  change: ChangedSymbol
): GraphNode | undefined {
  return nodeById(
    graph,
    change.nodeId
  );
}