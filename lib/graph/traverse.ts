// lib/graph/traverse.ts

import type {
  BlastRadius,
  DependencyGraph,
  GraphTraversalNode,
} from "./types";

export function traverseDependents(
  graph: DependencyGraph,
  changedNodeId: string,
  maxDepth = 4
): GraphTraversalNode[] {
  const results: GraphTraversalNode[] = [];

  const visited =
    new Set<string>([changedNodeId]);

  const queue: Array<{
    id: string;
    depth: number;
    path: string[];
  }> = [
    {
      id: changedNodeId,
      depth: 0,
      path: [changedNodeId],
    },
  ];

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current) break;

    if (current.depth >= maxDepth) {
      continue;
    }

    const dependentEdges =
      graph.edges.filter(
        (edge) =>
          edge.target === current.id
      );

    for (const edge of dependentEdges) {
      if (visited.has(edge.source)) {
        continue;
      }

      const node = graph.nodes.find(
        (candidate) =>
          candidate.id === edge.source
      );

      if (!node) continue;

      const nextDepth =
        current.depth + 1;

      const nextPath = [
        ...current.path,
        node.id,
      ];

      visited.add(node.id);

      results.push({
        node,
        depth: nextDepth,
        path: nextPath,
      });

      queue.push({
        id: node.id,
        depth: nextDepth,
        path: nextPath,
      });
    }
  }

  return results;
}

export function calculateBlastRadius(
  graph: DependencyGraph,
  changedNodeId: string,
  maxDepth = 4
): BlastRadius | null {
  const changedNode =
    graph.nodes.find(
      (node) => node.id === changedNodeId
    );

  if (!changedNode) {
    return null;
  }

  const affectedNodes =
    traverseDependents(
      graph,
      changedNodeId,
      maxDepth
    );

  return {
    changedNode,
    affectedNodes,
    totalAffected:
      affectedNodes.length,
  };
}

export function combineBlastRadii(
  graph: DependencyGraph,
  changedNodeIds: string[],
  maxDepth = 4
): GraphTraversalNode[] {
  const map =
    new Map<string, GraphTraversalNode>();

  for (const changedNodeId of changedNodeIds) {
    const nodes = traverseDependents(
      graph,
      changedNodeId,
      maxDepth
    );

    for (const node of nodes) {
      const existing =
        map.get(node.node.id);

      if (
        !existing ||
        node.depth < existing.depth
      ) {
        map.set(node.node.id, node);
      }
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => a.depth - b.depth
  );
}