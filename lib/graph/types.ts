// lib/graph/types.ts

export type NodeType =
  | "file"
  | "function"
  | "class"
  | "interface"
  | "type"
  | "variable"
  | "api_route"
  | "database_model"
  | "database_field"
  | "external_api"
  | "env_variable";

export type EdgeType =
  | "imports"
  | "calls"
  | "uses"
  | "reads"
  | "writes"
  | "depends_on"
  | "uses_field"
  | "contains";

export interface CodeLocation {
  filePath: string;
  startLine?: number;
  endLine?: number;
}

export interface GraphNode {
  id: string;
  name: string;
  type: NodeType;

  filePath?: string;

  location?: CodeLocation;

  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;

  source: string;
  target: string;

  type: EdgeType;

  metadata?: Record<string, unknown>;
}

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphTraversalNode {
  node: GraphNode;

  depth: number;

  path: string[];
}

export interface BlastRadius {
  changedNode: GraphNode;

  affectedNodes: GraphTraversalNode[];

  totalAffected: number;
}

export interface SymbolReference {
  symbolId: string;

  filePath: string;

  line?: number;

  type: EdgeType;
}

export interface ChangedSymbol {
  nodeId: string;

  name: string;

  type: NodeType;

  filePath: string;

  changeType:
    | "added"
    | "modified"
    | "deleted"
    | "signature_changed"
    | "type_changed";

  before?: string;

  after?: string;
}

export function createNodeId(
  filePath: string,
  type: NodeType,
  name: string
): string {
  return `${filePath}:${type}:${name}`;
}

export function createEdgeId(
  source: string,
  target: string,
  type: EdgeType
): string {
  return `${source}->${target}:${type}`;
}