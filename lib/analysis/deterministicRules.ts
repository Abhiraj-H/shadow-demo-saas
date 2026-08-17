// lib/analysis/deterministicRules.ts

import type {
  ChangedSymbol,
  DependencyGraph,
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

function findNode(
  graph: DependencyGraph,
  id: string
): GraphNode | undefined {
  return graph.nodes.find((node) => node.id === id);
}

function getDependents(
  graph: DependencyGraph,
  nodeId: string
): GraphNode[] {
  const dependentIds = graph.edges
    .filter((edge) => edge.target === nodeId)
    .map((edge) => edge.source);

  return graph.nodes.filter((node) =>
    dependentIds.includes(node.id)
  );
}

function inferSeverity(
  change: ChangedSymbol,
  dependentCount: number
): RiskSeverity {
  if (
    change.changeType === "deleted" &&
    dependentCount > 0
  ) {
    return "critical";
  }

  if (
    change.changeType === "signature_changed" &&
    dependentCount > 0
  ) {
    return "high";
  }

  if (change.changeType === "type_changed") {
    return dependentCount > 2
      ? "high"
      : "medium";
  }

  return dependentCount > 4
    ? "medium"
    : "low";
}

function inferCategory(
  change: ChangedSymbol
): RiskCategory {
  if (
    change.type === "database_model" ||
    change.type === "database_field"
  ) {
    return "database";
  }

  if (change.type === "api_route") {
    return "api_breaking_change";
  }

  if (
    change.changeType === "signature_changed" ||
    change.changeType === "type_changed"
  ) {
    return "type";
  }

  return "dependency";
}

function deletedSymbolRule(
  change: ChangedSymbol,
  graph: DependencyGraph
): RiskCandidate[] {
  if (change.changeType !== "deleted") {
    return [];
  }

  const dependents = getDependents(
    graph,
    change.nodeId
  );

  if (dependents.length === 0) {
    return [];
  }

  return dependents.map((dependent) => ({
    id: createRiskId(
      "deleted-symbol",
      change.nodeId,
      dependent.id
    ),

    title: `${dependent.name} depends on deleted symbol ${change.name}`,

    description:
      `${change.name} was deleted, but ${dependent.name} still depends on it.`,

    category: "dependency",

    severity: "critical",

    confidence: 0.99,

    source: "static",

    changedNodeId: change.nodeId,
    affectedNodeId: dependent.id,

    changedSymbol: change.name,
    affectedSymbol: dependent.name,

    filePath: dependent.filePath,

    dependencyDepth: 1,

    failurePath: [
      change.name,
      dependent.name,
    ],

    evidence: [
      `${change.name} was deleted.`,
      `${dependent.name} has a dependency edge to ${change.name}.`,
    ],

    suggestedFix:
      `Update ${dependent.name} to remove or replace its dependency on ${change.name}.`,
  }));
}

function signatureChangeRule(
  change: ChangedSymbol,
  graph: DependencyGraph
): RiskCandidate[] {
  if (
    change.changeType !== "signature_changed"
  ) {
    return [];
  }

  const dependents = getDependents(
    graph,
    change.nodeId
  );

  return dependents.map((dependent) => ({
    id: createRiskId(
      "signature-change",
      change.nodeId,
      dependent.id
    ),

    title: `Potential breaking signature change in ${change.name}`,

    description:
      `${dependent.name} depends on ${change.name}, whose signature changed.`,

    category: "api_breaking_change",

    severity: "high",

    confidence: 0.93,

    source: "static",

    changedNodeId: change.nodeId,
    affectedNodeId: dependent.id,

    changedSymbol: change.name,
    affectedSymbol: dependent.name,

    filePath: dependent.filePath,

    dependencyDepth: 1,

    failurePath: [
      change.name,
      dependent.name,
    ],

    evidence: [
      `Before: ${change.before ?? "unknown"}`,
      `After: ${change.after ?? "unknown"}`,
    ],

    suggestedFix:
      `Verify the call to ${change.name} inside ${dependent.name} matches the new signature.`,
  }));
}

function nullableTypeRule(
  change: ChangedSymbol,
  graph: DependencyGraph
): RiskCandidate[] {
  if (
    change.changeType !== "type_changed" &&
    change.changeType !==
      "signature_changed"
  ) {
    return [];
  }

  const before = change.before ?? "";
  const after = change.after ?? "";

  const becameNullable =
    !before.includes("null") &&
    !before.includes("undefined") &&
    !before.includes("?") &&
    (
      after.includes("null") ||
      after.includes("undefined") ||
      after.includes("?")
    );

  if (!becameNullable) {
    return [];
  }

  const dependents = getDependents(
    graph,
    change.nodeId
  );

  return dependents.map((dependent) => ({
    id: createRiskId(
      "nullable-change",
      change.nodeId,
      dependent.id
    ),

    title: `${change.name} can now be null or undefined`,

    description:
      `${dependent.name} may receive a nullable value after the change to ${change.name}.`,

    category: "runtime",

    severity: "high",

    confidence: 0.9,

    source: "static",

    changedNodeId: change.nodeId,
    affectedNodeId: dependent.id,

    changedSymbol: change.name,
    affectedSymbol: dependent.name,

    filePath: dependent.filePath,

    dependencyDepth: 1,

    failurePath: [
      change.name,
      dependent.name,
    ],

    evidence: [
      `Previous declaration: ${before}`,
      `New declaration: ${after}`,
    ],

    suggestedFix:
      `Add explicit null/undefined handling before ${dependent.name} consumes ${change.name}.`,
  }));
}

function databaseChangeRule(
  change: ChangedSymbol,
  graph: DependencyGraph
): RiskCandidate[] {
  if (
    change.type !== "database_field" &&
    change.type !== "database_model"
  ) {
    return [];
  }

  const dependents = getDependents(
    graph,
    change.nodeId
  );

  if (
    change.changeType === "deleted" ||
    change.changeType === "type_changed"
  ) {
    return dependents.map((dependent) => ({
      id: createRiskId(
        "database-change",
        change.nodeId,
        dependent.id
      ),

      title: `Database change may break ${dependent.name}`,

      description:
        `${dependent.name} depends on database entity ${change.name}, which has a breaking schema change.`,

      category: "database",

      severity:
        change.changeType === "deleted"
          ? "critical"
          : "high",

      confidence: 0.95,

      source: "static",

      changedNodeId: change.nodeId,
      affectedNodeId: dependent.id,

      changedSymbol: change.name,
      affectedSymbol: dependent.name,

      filePath: dependent.filePath,

      dependencyDepth: 1,

      failurePath: [
        change.name,
        dependent.name,
      ],

      evidence: [
        `Database ${change.type} ${change.name} changed.`,
        `Change type: ${change.changeType}.`,
      ],

      suggestedFix:
        "Review database migration compatibility and update all dependent queries before deployment.",
    }));
  }

  return [];
}

function genericBlastRadiusRule(
  change: ChangedSymbol,
  graph: DependencyGraph
): RiskCandidate[] {
  const dependents = getDependents(
    graph,
    change.nodeId
  );

  if (dependents.length < 3) {
    return [];
  }

  return [
    {
      id: createRiskId(
        "large-blast-radius",
        change.nodeId
      ),

      title: `${change.name} has a large blast radius`,

      description:
        `${dependents.length} direct components depend on ${change.name}.`,

      category: inferCategory(change),

      severity: inferSeverity(
        change,
        dependents.length
      ),

      confidence: 0.86,

      source: "static",

      changedNodeId: change.nodeId,

      changedSymbol: change.name,

      filePath: change.filePath,

      dependencyDepth: 1,

      failurePath: [change.name],

      evidence: [
        `${dependents.length} direct dependencies were discovered.`,
        ...dependents
          .slice(0, 5)
          .map(
            (node) =>
              `${node.name} depends on ${change.name}`
          ),
      ],

      suggestedFix:
        `Review all direct consumers of ${change.name} and add regression tests for the affected paths.`,
    },
  ];
}

export function runDeterministicRules(
  input: DeterministicAnalysisInput
): RiskCandidate[] {
  const risks: RiskCandidate[] = [];

  for (const change of input.changes) {
    risks.push(
      ...deletedSymbolRule(
        change,
        input.graph
      ),

      ...signatureChangeRule(
        change,
        input.graph
      ),

      ...nullableTypeRule(
        change,
        input.graph
      ),

      ...databaseChangeRule(
        change,
        input.graph
      ),

      ...genericBlastRadiusRule(
        change,
        input.graph
      )
    );
  }

  return risks;
}

export function findDirectDependents(
  graph: DependencyGraph,
  nodeId: string
): GraphNode[] {
  return getDependents(graph, nodeId);
}

export function getChangedNode(
  graph: DependencyGraph,
  change: ChangedSymbol
): GraphNode | undefined {
  return findNode(graph, change.nodeId);
}