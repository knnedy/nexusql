import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";
import type {
  SchemaResponse,
  TableNodeData,
  RelationEdgeData,
  DatabaseProvider,
} from "./types";

// Node dimensions which match the TableNode size exactly
const NODE_WIDTH = 240;
const NODE_HEIGHT_BASE = 40; // header height
const NODE_HEIGHT_PER_ROW = 32; // height per field row

// Dagre layout direction
const LAYOUT_DIRECTION = "TB"; // top to bottom
const RANK_SEPARATION = 80;
const NODE_SEPARATION = 60;

function getNodeHeight(fieldCount: number): number {
  return NODE_HEIGHT_BASE + fieldCount * NODE_HEIGHT_PER_ROW;
}

// Converts a SchemaResponse into raw React Flow nodes with no position.
// Positions are assigned by applyDagreLayout.
function schemaToNodes(
  schema: SchemaResponse,
  provider: DatabaseProvider,
): Node<TableNodeData>[] {
  return schema.tables.map((table) => ({
    id: table.name,
    type: "tableNode",
    position: { x: 0, y: 0 },
    data: {
      table,
      provider,
      isSelected: false,
    },
  }));
}

// Converts a SchemaResponse into React Flow edges.
// Each edge connects a FK field handle to a PK field handle.
function schemaToEdges(schema: SchemaResponse): Edge<RelationEdgeData>[] {
  return schema.relations.map((relation) => ({
    id: relation.constraintName,
    source: relation.sourceTable,
    target: relation.targetTable,
    sourceHandle: `${relation.sourceTable}__${relation.sourceField}__source`,
    targetHandle: `${relation.targetTable}__${relation.targetField}__target`,
    type: "relationEdge",
    data: { relation },
  }));
}

// Runs the dagre layout algorithm over a set of nodes and edges.
// Returns a new nodes array with calculated (x, y) positions.
function applyDagreLayout(
  nodes: Node<TableNodeData>[],
  edges: Edge<RelationEdgeData>[],
): Node<TableNodeData>[] {
  const graph = new dagre.graphlib.Graph();

  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: LAYOUT_DIRECTION,
    ranksep: RANK_SEPARATION,
    nodesep: NODE_SEPARATION,
  });
  // Register each node with its dimensions
  nodes.forEach((node) => {
    const height = getNodeHeight(node.data.table.fields.length);
    graph.setNode(node.id, { width: NODE_WIDTH, height });
  });

  // Register each edge
  edges.forEach((edge) => {
    graph.setEdge(edge.source, edge.target);
  });

  dagre.layout(graph);

  // Read back the calculated positions and center the nodes
  return nodes.map((node) => {
    const { x, y, width, height } = graph.node(node.id);
    return {
      ...node,
      position: {
        x: x - width / 2,
        y: y - height / 2,
      },
    };
  });
}

// Public API — converts a SchemaResponse into a positioned
// React Flow node and edge set ready to pass to <ReactFlow />.
export function buildCanvasGraph(
  schema: SchemaResponse,
  provider: import("./types").DatabaseProvider,
): {
  nodes: Node<TableNodeData>[];
  edges: Edge<RelationEdgeData>[];
} {
  const rawNodes = schemaToNodes(schema, provider);
  const edges = schemaToEdges(schema);
  const nodes = applyDagreLayout(rawNodes, edges);
  return { nodes, edges };
}

// Re-runs dagre on an existing set of nodes and edges.
// Used when the user triggers the auto-layout button.
export function reapplyLayout(
  nodes: Node<TableNodeData>[],
  edges: Edge<RelationEdgeData>[],
): Node<TableNodeData>[] {
  return applyDagreLayout(nodes, edges);
}

export { NODE_WIDTH, getNodeHeight };
