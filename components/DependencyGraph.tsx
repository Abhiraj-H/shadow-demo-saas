// components/DependencyGraph.tsx

"use client";

import {
  Background,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import type {
  DependencyGraph as Graph,
} from "@/lib/graph/types";

interface Props {
  graph: Graph;
  changedNodeIds: string[];
  affectedNodeIds: string[];
}

export default function DependencyGraph({
  graph,
  changedNodeIds,
  affectedNodeIds,
}: Props) {
  const relevant = new Set([
    ...changedNodeIds,
    ...affectedNodeIds,
  ]);

  for (const edge of graph.edges) {
    if (
      relevant.has(edge.source) ||
      relevant.has(edge.target)
    ) {
      relevant.add(edge.source);
      relevant.add(edge.target);
    }
  }

  const graphNodes =
    graph.nodes
      .filter((node) =>
        relevant.has(node.id)
      )
      .slice(0, 60);

  const allowed =
    new Set(
      graphNodes.map(
        (node) => node.id
      )
    );

  const depths =
    new Map<string, number>();

  for (const id of changedNodeIds) {
    depths.set(id, 0);
  }

  for (
    let iteration = 0;
    iteration < 6;
    iteration++
  ) {
    for (const edge of graph.edges) {
      const targetDepth =
        depths.get(edge.target);

      if (
        targetDepth === undefined
      ) {
        continue;
      }

      const next =
        targetDepth + 1;

      const current =
        depths.get(edge.source);

      if (
        current === undefined ||
        next < current
      ) {
        depths.set(
          edge.source,
          next
        );
      }
    }
  }

  const columns =
    new Map<number, number>();

  const nodes: Node[] =
    graphNodes.map((node) => {
      const depth =
        depths.get(node.id) ?? 5;

      const index =
        columns.get(depth) ?? 0;

      columns.set(
        depth,
        index + 1
      );

      const changed =
        changedNodeIds.includes(
          node.id
        );

      const affected =
        affectedNodeIds.includes(
          node.id
        );

      return {
        id: node.id,

        position: {
          x: depth * 280,
          y: index * 110,
        },

        data: {
          label: node.name,
        },

        style: {
          width: 220,

          borderRadius: 12,

          border: changed
            ? "1px solid #ef4444"
            : affected
              ? "1px solid #f59e0b"
              : "1px solid #3f3f46",

          background: changed
            ? "#2a1111"
            : affected
              ? "#241b0b"
              : "#111113",

          color: "#f4f4f5",

          fontSize: 12,

          padding: 10,
        },
      };
    });

  const edges: Edge[] =
    graph.edges
      .filter(
        (edge) =>
          allowed.has(
            edge.source
          ) &&
          allowed.has(
            edge.target
          )
      )
      .map((edge) => ({
        id: edge.id,

        source: edge.target,
        target: edge.source,

        label: edge.type,

        animated:
          changedNodeIds.includes(
            edge.target
          ),

        style: {
          stroke: "#52525b",
        },

        labelStyle: {
          fill: "#71717a",
          fontSize: 9,
        },
      }));

  return (
    <div className="h-[600px] overflow-hidden rounded-2xl border border-white/10 bg-[#080808]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        minZoom={0.15}
        maxZoom={1.5}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}