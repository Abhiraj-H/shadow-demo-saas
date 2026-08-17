// lib/analysis/aiAnalyzer.ts

import type {
  ChangedSymbol,
  DependencyGraph,
  GraphNode,
  GraphTraversalNode,
} from "@/lib/graph/types";

import type {
  ParsedRepository,
  ParsedSymbol,
} from "@/lib/parser/symbols";

import type {
  RiskCandidate,
  RiskCategory,
  RiskSeverity,
} from "./riskScore";

export interface AIAnalyzerInput {
  changes: ChangedSymbol[];

  graph: DependencyGraph;

  repository: ParsedRepository;

  affectedNodes?: GraphTraversalNode[];

  maxContexts?: number;
}

export interface AIRiskResponse {
  title: string;

  description: string;

  category: RiskCategory;

  severity: RiskSeverity;

  confidence: number;

  reason: string;

  failurePath: string[];

  evidence: string[];

  suggestedFix?: string;

  affectedSymbol?: string;

  affectedNodeId?: string;
}

export interface EnrichedRiskResponse {
  id: string;
  description: string;
  suggestedFix: string;
  severity: RiskSeverity;
  confidence: number;
}

export interface LLMRiskClient {
  analyzeRisk(
    context: RiskAnalysisContext
  ): Promise<AIRiskResponse[]>;

  enrichRisks(
    staticRisks: RiskCandidate[],
    context: any
  ): Promise<EnrichedRiskResponse[]>;
}

export interface RiskAnalysisContext {
  change: {
    nodeId: string;
    name: string;
    type: string;
    changeType: string;
    filePath: string;
    before?: string;
    after?: string;
  };

  changedCode?: string;

  affectedComponents: Array<{
    nodeId: string;
    name: string;
    type: string;
    filePath?: string;
    code?: string;
    depth: number;
    path: string[];
  }>;

  dependencyEdges: Array<{
    source: string;
    target: string;
    type: string;
  }>;
}

function findParsedSymbol(
  repository: ParsedRepository,
  nodeId: string
): ParsedSymbol | undefined {
  return repository.symbols.find(
    (symbol) => symbol.id === nodeId
  );
}

function findGraphNode(
  graph: DependencyGraph,
  nodeId: string
): GraphNode | undefined {
  return graph.nodes.find(
    (node) => node.id === nodeId
  );
}

function getDirectAffectedNodes(
  graph: DependencyGraph,
  changedNodeId: string
): GraphTraversalNode[] {
  const edges = graph.edges.filter(
    (edge) => edge.target === changedNodeId
  );

  return edges
    .map((edge) =>
      findGraphNode(graph, edge.source)
    )
    .filter(
      (node): node is GraphNode =>
        node !== undefined
    )
    .map((node) => ({
      node,
      depth: 1,
      path: [
        changedNodeId,
        node.id,
      ],
    }));
}

function buildContext(
  change: ChangedSymbol,
  input: AIAnalyzerInput
): RiskAnalysisContext {
  const changedSymbol = findParsedSymbol(
    input.repository,
    change.nodeId
  );

  const availableAffected =
    input.affectedNodes?.filter((item) =>
      item.path.includes(change.nodeId)
    ) ??
    getDirectAffectedNodes(
      input.graph,
      change.nodeId
    );

  const relevantAffected =
    availableAffected.slice(0, 10);

  const relevantIds = new Set<string>([
    change.nodeId,
    ...relevantAffected.map(
      (item) => item.node.id
    ),
  ]);

  const dependencyEdges =
    input.graph.edges
      .filter(
        (edge) =>
          relevantIds.has(edge.source) &&
          relevantIds.has(edge.target)
      )
      .map((edge) => ({
        source: edge.source,
        target: edge.target,
        type: edge.type,
      }));

  return {
    change: {
      nodeId: change.nodeId,
      name: change.name,
      type: change.type,
      changeType: change.changeType,
      filePath: change.filePath,
      before: change.before,
      after: change.after,
    },

    changedCode:
      changedSymbol?.code,

    affectedComponents:
      relevantAffected.map((item) => {
        const parsed = findParsedSymbol(
          input.repository,
          item.node.id
        );

        return {
          nodeId: item.node.id,

          name: item.node.name,

          type: item.node.type,

          filePath:
            item.node.filePath,

          code: parsed?.code,

          depth: item.depth,

          path: item.path,
        };
      }),

    dependencyEdges,
  };
}

function sanitizeConfidence(
  confidence: number
): number {
  if (!Number.isFinite(confidence)) {
    return 0.5;
  }

  if (confidence > 1) {
    return Math.min(
      confidence / 100,
      1
    );
  }

  return Math.max(
    0,
    Math.min(confidence, 1)
  );
}

function validateSeverity(
  severity: string
): RiskSeverity {
  const valid: RiskSeverity[] = [
    "critical",
    "high",
    "medium",
    "low",
  ];

  if (
    valid.includes(
      severity as RiskSeverity
    )
  ) {
    return severity as RiskSeverity;
  }

  return "medium";
}

function validateCategory(
  category: string
): RiskCategory {
  const valid: RiskCategory[] = [
    "runtime",
    "type",
    "api_breaking_change",
    "data_integrity",
    "database",
    "security",
    "business_logic",
    "performance",
    "dependency",
    "unknown",
  ];

  if (
    valid.includes(
      category as RiskCategory
    )
  ) {
    return category as RiskCategory;
  }

  return "unknown";
}

function convertToRiskCandidate(
  response: AIRiskResponse,
  change: ChangedSymbol,
  index: number
): RiskCandidate {
  return {
    id: [
      "ai",
      change.nodeId,
      response.affectedNodeId ??
        response.affectedSymbol ??
        index,
    ].join(":"),

    title: response.title,

    description:
      response.description ||
      response.reason,

    category: validateCategory(
      response.category
    ),

    severity: validateSeverity(
      response.severity
    ),

    confidence: sanitizeConfidence(
      response.confidence
    ),

    source: "ai",

    changedNodeId: change.nodeId,

    affectedNodeId:
      response.affectedNodeId,

    changedSymbol: change.name,

    affectedSymbol:
      response.affectedSymbol,

    filePath: change.filePath,

    failurePath:
      response.failurePath,

    evidence: response.evidence,

    suggestedFix:
      response.suggestedFix,

    metadata: {
      reason: response.reason,
    },
  };
}

function shouldAnalyzeChange(
  change: ChangedSymbol
): boolean {
  if (
    [
      "deleted",
      "signature_changed",
      "type_changed",
    ].includes(change.changeType)
  ) {
    return true;
  }

  return [
    "function",
    "class",
    "api_route",
    "database_model",
    "database_field",
    "type",
    "interface",
  ].includes(change.type);
}

export async function runAIAnalysis(
  input: AIAnalyzerInput,
  client: LLMRiskClient
): Promise<RiskCandidate[]> {
  const analyzableChanges =
    input.changes
      .filter(shouldAnalyzeChange)
      .slice(
        0,
        input.maxContexts ?? 8
      );

  const risks: RiskCandidate[] = [];

  for (const change of analyzableChanges) {
    const context = buildContext(
      change,
      input
    );

    if (
      context.affectedComponents.length ===
        0 &&
      change.changeType === "modified"
    ) {
      continue;
    }

    try {
      console.log(
        "\n========== GEMINI INPUT =========="
      );
      console.log(
        JSON.stringify(context, null, 2)
      );

      const response =
        await client.analyzeRisk(
          context
        );

      console.log(
        "\n========== GEMINI OUTPUT =========="
      );
      console.log(
        JSON.stringify(response, null, 2)
      );

      const converted = response.map(
        (risk, index) =>
          convertToRiskCandidate(
            risk,
            change,
            index
          )
      );

      risks.push(...converted);
    } catch (error) {
      console.error(
        "\n========== GEMINI ERROR =========="
      );
      console.error(
        `AI analysis failed for ${change.name}:`,
        error
      );
    }
  }

  return risks;
}

export function createAIContext(
  change: ChangedSymbol,
  input: AIAnalyzerInput
): RiskAnalysisContext {
  return buildContext(
    change,
    input
  );
}

export async function enrichRisksWithAI(
  staticRisks: RiskCandidate[],
  input: AIAnalyzerInput,
  client: LLMRiskClient
): Promise<RiskCandidate[]> {
  if (staticRisks.length === 0) {
    return [];
  }

  const relevantAffected = (input.affectedNodes || []).slice(0, 15);
  const affectedComponents = relevantAffected.map((item) => {
    const parsed = findParsedSymbol(input.repository, item.node.id);
    return {
      nodeId: item.node.id,
      name: item.node.name,
      type: item.node.type,
      filePath: item.node.filePath,
      code: parsed?.code,
    };
  });

  const context = {
    changes: input.changes.map((c) => ({
      name: c.name,
      type: c.type,
      changeType: c.changeType,
      before: c.before,
      after: c.after,
    })),
    affectedComponents,
  };

  try {
    const enriched = await client.enrichRisks(staticRisks, context);
    const enrichedMap = new Map(enriched.map((item) => [item.id, item]));

    return staticRisks.map((risk) => {
      const enrichment = enrichedMap.get(risk.id);
      if (enrichment) {
        return {
          ...risk,
          description: enrichment.description,
          suggestedFix: enrichment.suggestedFix || risk.suggestedFix,
          severity: enrichment.severity || risk.severity,
          confidence: enrichment.confidence || risk.confidence,
          source: "ai" as const,
        };
      }
      return risk;
    });
  } catch (error) {
    console.error("AI risk enrichment failed:", error);
    return staticRisks;
  }
}