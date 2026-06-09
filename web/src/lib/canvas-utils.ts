import ELK, {
  type ElkNode,
  type ElkExtendedEdge,
} from "elkjs/lib/elk.bundled.js";
import type { Edge, Node } from "@xyflow/react";
import type {
  DatabaseProvider,
  RelationEdgeData,
  SchemaResponse,
  TableNodeData,
} from "./types";

const NODE_WIDTH = 260;
const NODE_HEIGHT_BASE = 44;
const NODE_HEIGHT_PER_ROW = 34;

export function getNodeHeight(fieldCount: number): number {
  return NODE_HEIGHT_BASE + fieldCount * NODE_HEIGHT_PER_ROW;
}

const ELK_LAYOUT_OPTIONS = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.layered.spacing.nodeNodeBetweenLayers": "120",
  "elk.spacing.nodeNode": "80",
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.layered.nodePlacement.strategy": "SIMPLE",
  "elk.portConstraints": "FIXED_SIDE",
};

const elk = new ELK();

function buildPorts(
  fields: SchemaResponse["tables"][number]["fields"],
  tableName: string,
) {
  return fields.flatMap((field, index) => {
    const topOffset =
      NODE_HEIGHT_BASE + index * NODE_HEIGHT_PER_ROW + NODE_HEIGHT_PER_ROW / 2;
    const ports = [];

    if (field.isPrimaryKey) {
      ports.push({
        id: `${tableName}__${field.name}__target`,
        layoutOptions: { "port.side": "WEST" },
        y: topOffset,
        x: 0,
        width: 8,
        height: 8,
      });
    }

    if (field.isForeignKey) {
      ports.push({
        id: `${tableName}__${field.name}__source`,
        layoutOptions: { "port.side": "EAST" },
        y: topOffset,
        x: NODE_WIDTH,
        width: 8,
        height: 8,
      });
    }

    return ports;
  });
}

function buildElkGraph(schema: SchemaResponse): {
  elkGraph: ElkNode;
  rfEdges: Edge<RelationEdgeData>[];
} {
  const elkNodes: ElkNode[] = schema.tables.map((table) => ({
    id: table.name,
    width: NODE_WIDTH,
    height: getNodeHeight(table.fields.length),
    ports: buildPorts(table.fields, table.name),
    layoutOptions: { portConstraints: "FIXED_SIDE" },
  }));

  const elkEdges: ElkExtendedEdge[] = schema.relations.map((relation) => ({
    id: relation.constraintName,
    sources: [`${relation.sourceTable}__${relation.sourceField}__source`],
    targets: [`${relation.targetTable}__${relation.targetField}__target`],
  }));

  const rfEdges: Edge<RelationEdgeData>[] = schema.relations.map(
    (relation) => ({
      id: relation.constraintName,
      source: relation.sourceTable,
      target: relation.targetTable,
      sourceHandle: `${relation.sourceTable}__${relation.sourceField}__source`,
      targetHandle: `${relation.targetTable}__${relation.targetField}__target`,
      type: "relationEdge",
      data: { relation },
    }),
  );

  return {
    elkGraph: {
      id: "root",
      layoutOptions: ELK_LAYOUT_OPTIONS,
      children: elkNodes,
      edges: elkEdges,
    },
    rfEdges,
  };
}

export async function buildCanvasGraph(
  schema: SchemaResponse,
  provider: DatabaseProvider,
): Promise<{ nodes: Node<TableNodeData>[]; edges: Edge<RelationEdgeData>[] }> {
  const { elkGraph, rfEdges } = buildElkGraph(schema);
  const layouted = await elk.layout(elkGraph);

  // Build a port position lookup from ELK's output
  const portPositions = new Map<string, { x: number; y: number }>();
  (layouted.children ?? []).forEach((elkNode) => {
    (elkNode.ports ?? []).forEach((port) => {
      portPositions.set(port.id, {
        x: (elkNode.x ?? 0) + (port.x ?? 0),
        y: (elkNode.y ?? 0) + (port.y ?? 0),
      });
    });
  });

  const nodes: Node<TableNodeData>[] = (layouted.children ?? []).map(
    (elkNode) => {
      const table = schema.tables.find((t) => t.name === elkNode.id)!;
      return {
        id: elkNode.id,
        type: "tableNode",
        position: { x: elkNode.x ?? 0, y: elkNode.y ?? 0 },
        data: { table, provider, isSelected: false },
      };
    },
  );

  // Attach ELK-calculated port Y offsets to each edge
  const edges: Edge<RelationEdgeData>[] = rfEdges.map((edge) => {
    const sourcePos = portPositions.get(edge.sourceHandle ?? "");
    const targetPos = portPositions.get(edge.targetHandle ?? "");
    return {
      ...edge,
      data: {
        ...edge.data!,
        sourceY: sourcePos?.y,
        targetY: targetPos?.y,
      },
    };
  });

  return { nodes, edges };
}

export async function reapplyLayout(
  schema: SchemaResponse,
  provider: DatabaseProvider,
): Promise<{ nodes: Node<TableNodeData>[]; edges: Edge<RelationEdgeData>[] }> {
  return buildCanvasGraph(schema, provider);
}

export { NODE_WIDTH };
