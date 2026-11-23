import ELK, {
  type ELK as ElkApi,
  type ElkNode,
  type ElkExtendedEdge,
} from "elkjs/lib/elk-api.js";
import type { Edge, Node } from "@xyflow/react";
import { SchemaResponse } from "@/shared/types/schema";
import { RelationEdgeData, TableNodeData } from "@/features/canvas/types";
import { DatabaseProvider } from "@/shared/types/provider";

// The table node renders at exactly these sizes, so layout and handles agree.
export const NODE_WIDTH = 260;
export const NODE_BORDER = 1;
export const NODE_HEADER = 44;
export const NODE_ROW = 34;
export const NODE_PAD_BOTTOM = 4;

export function getNodeHeight(fieldCount: number): number {
  return 2 * NODE_BORDER + NODE_HEADER + (fieldCount || 0) * NODE_ROW + NODE_PAD_BOTTOM;
}

/** A field's handle centre, from the node's top edge. */
export function handleOffsetY(index: number): number {
  return NODE_BORDER + NODE_HEADER + index * NODE_ROW + NODE_ROW / 2;
}

const ELK_LAYOUT_OPTIONS = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.layered.spacing.nodeNodeBetweenLayers": "120",
  "elk.spacing.nodeNode": "80",
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.layered.nodePlacement.strategy": "SIMPLE",
  "elk.portConstraints": "FIXED_POS",
};

let elk: Promise<ElkApi> | null = null;

// Layout runs in a worker so large schemas do not freeze the page; tests have no Worker.
function getElk(): Promise<ElkApi> {
  elk ??=
    typeof Worker === "undefined"
      ? import("elkjs/lib/elk.bundled.js").then((m) => new m.default())
      : Promise.resolve(
          new ELK({
            workerFactory: () => new Worker(new URL("./elk.worker.ts", import.meta.url)),
          }),
        );
  return elk;
}

function buildPorts(
  fields: SchemaResponse["tables"][number]["fields"],
  tableName: string,
  referenced: Set<string>,
) {
  const safeFields = fields || [];
  return safeFields.flatMap((field, index) => {
    const topOffset = handleOffsetY(index);
    const ports = [];

    // A key may reference any unique column, not only the primary key.
    if (field.isPrimaryKey || referenced.has(field.name)) {
      ports.push({
        id: `${tableName}__${field.name}__target`,
        layoutOptions: { "port.side": "WEST" },
        y: topOffset,
        x: 0,
        width: 0,
        height: 0,
      });
    }

    if (field.isForeignKey) {
      ports.push({
        id: `${tableName}__${field.name}__source`,
        layoutOptions: { "port.side": "EAST" },
        y: topOffset,
        x: NODE_WIDTH,
        width: 0,
        height: 0,
      });
    }

    return ports;
  });
}

/** Per table, the columns some foreign key points at. */
function referencedFields(relations: SchemaResponse["relations"]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const r of relations) {
    if (!out.has(r.targetTable)) out.set(r.targetTable, new Set());
    out.get(r.targetTable)!.add(r.targetField);
  }
  return out;
}

function buildElkGraph(schema: SchemaResponse): {
  elkGraph: ElkNode;
  rfEdges: Edge<RelationEdgeData>[];
} {
  const safeTables = schema?.tables || [];
  const safeRelations = schema?.relations || [];

  const referenced = referencedFields(safeRelations);
  const elkNodes: ElkNode[] = safeTables.map((table) => ({
    id: table.name,
    width: NODE_WIDTH,
    height: getNodeHeight(table.fields?.length || 0),
    ports: buildPorts(table.fields, table.name, referenced.get(table.name) ?? new Set()),
    layoutOptions: { "elk.portConstraints": "FIXED_POS" },
  }));

  const elkEdges: ElkExtendedEdge[] = safeRelations.map((relation) => ({
    id: relation.constraintName,
    sources: [`${relation.sourceTable}__${relation.sourceField}__source`],
    targets: [`${relation.targetTable}__${relation.targetField}__target`],
  }));

  const rfEdges: Edge<RelationEdgeData>[] = safeRelations.map((relation) => ({
    id: relation.constraintName,
    source: relation.sourceTable,
    target: relation.targetTable,
    sourceHandle: `${relation.sourceTable}__${relation.sourceField}__source`,
    targetHandle: `${relation.targetTable}__${relation.targetField}__target`,
    type: "relationEdge",
    data: { relation },
  }));

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
  try {
    const { elkGraph, rfEdges } = buildElkGraph(schema);
    const layouted = await (await getElk()).layout(elkGraph);

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

    const safeTables = schema?.tables || [];
    const referenced = referencedFields(schema?.relations || []);
    const nodes: Node<TableNodeData>[] = (layouted.children ?? [])
      .map((elkNode): Node<TableNodeData> | null => {
        const table = safeTables.find((t) => t.name === elkNode.id);

        if (!table) {
          console.warn(
            `[NexusQL] Node mapping omitted for unresolved reference: ${elkNode.id}`,
          );
          return null;
        }

        return {
          id: elkNode.id,
          type: "tableNode",
          position: { x: elkNode.x ?? 0, y: elkNode.y ?? 0 },
          data: {
            table,
            provider,
            isSelected: false,
            referenced: [...(referenced.get(table.name) ?? [])].sort(),
          },
        };
      })
      .filter((node): node is Node<TableNodeData> => node !== null);

    const routes = new Map(
      (layouted.edges ?? []).map((e) => {
        const sec = (e as ElkExtendedEdge).sections?.[0];
        const pts = sec ? [sec.startPoint, ...(sec.bendPoints ?? []), sec.endPoint] : undefined;
        return [e.id, pts?.map(({ x, y }) => ({ x, y }))] as const;
      }),
    );

    const edges: Edge<RelationEdgeData>[] = rfEdges.map((edge) => {
      const sourcePos = portPositions.get(edge.sourceHandle ?? "");
      const targetPos = portPositions.get(edge.targetHandle ?? "");
      return {
        ...edge,
        data: {
          ...edge.data!,
          sourceY: sourcePos?.y,
          targetY: targetPos?.y,
          points: routes.get(edge.id),
        },
      };
    });

    return { nodes, edges };
  } catch (layoutError) {
    console.error(
      "[NexusQL] Critical error computing canvas layout calculations:",
      layoutError,
    );
    return { nodes: [], edges: [] };
  }
}

export async function reapplyLayout(
  schema: SchemaResponse,
  provider: DatabaseProvider,
): Promise<{ nodes: Node<TableNodeData>[]; edges: Edge<RelationEdgeData>[] }> {
  return buildCanvasGraph(schema, provider);
}


