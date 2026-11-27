import ELK, {
  type ELK as ElkApi,
  type ElkNode,
  type ElkExtendedEdge,
} from "elkjs/lib/elk-api.js";
import type { Edge, Node } from "@xyflow/react";
import { SchemaResponse } from "@/shared/types/schema";
import { GroupNodeData, RelationEdgeData, TableNodeData } from "@/features/canvas/types";
import { CASCADE_WEIGHT, groupTables, type Link, type TableGroup } from "./groups";
import { groupLinks, type GroupLink } from "./overview";
import { DatabaseProvider } from "@/shared/types/provider";

// The table node renders at exactly these sizes, so layout and handles agree.
import { handleOffsetY, NODE_WIDTH, tableBoxHeight } from "./card";
export { getNodeHeight, handleOffsetY, NODE_BORDER, NODE_HEADER, NODE_PAD_BOTTOM, NODE_ROW, NODE_WIDTH } from "./card";

// Room inside a group's region: the label sits in the top band.
export const GROUP_LABEL = 64;
const GROUP_PAD = 28;


// Inside a group keys flow right to left: a table sits right of what it points to,
// so the most-linked table lands in the middle. Lines between groups end in chips.
const GROUP_OPTIONS = {
  "elk.algorithm": "layered",
  "elk.direction": "LEFT",
  // At most three tables per column: a table many others point at would otherwise
  // stand at the head of one tall column, far taller than any screen.
  "elk.layered.layering.strategy": "COFFMAN_GRAHAM",
  "elk.layered.layering.coffmanGraham.layerBound": "3",
  "elk.layered.spacing.nodeNodeBetweenLayers": "72",
  "elk.spacing.nodeNode": "40",
  "elk.spacing.componentComponent": "56",
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.layered.nodePlacement.strategy": "SIMPLE",
  "elk.portConstraints": "FIXED_POS",
  "elk.padding": `[top=${GROUP_LABEL},left=${GROUP_PAD},bottom=${GROUP_PAD},right=${GROUP_PAD}]`,
};
// Tables without keys between them have nothing to flow along: rows instead.
const UNLINKED_OPTIONS = {
  ...GROUP_OPTIONS,
  "elk.algorithm": "rectpacking",
  "elk.aspectRatio": "2",
};
// Groups pack into a screen-shaped block, in an order that keeps linked groups close.
const ROOT_OPTIONS = {
  "elk.algorithm": "rectpacking",
  "elk.aspectRatio": "1.6",
  "elk.spacing.nodeNode": "96",
  "elk.json.shapeCoords": "ROOT",
  "elk.json.edgeCoords": "ROOT",
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
        layoutOptions: { "port.side": "EAST" },
        y: topOffset,
        x: NODE_WIDTH,
        width: 0,
        height: 0,
      });
    }

    if (field.isForeignKey) {
      ports.push({
        id: `${tableName}__${field.name}__source`,
        layoutOptions: { "port.side": "WEST" },
        y: topOffset,
        x: 0,
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

// Hubs only in larger schemas: lines from everywhere into one table cross everything.
const HUB_MIN_TABLES = 40;
const HUB_MIN_REFS = 10;
const HUB_SHARE = 0.05;

/** Tables so widely referenced that their incoming lines are shown as chips instead. */
export function findHubs(schema: SchemaResponse): Set<string> {
  const tables = schema?.tables?.length ?? 0;
  if (tables < HUB_MIN_TABLES) return new Set();
  const threshold = Math.max(HUB_MIN_REFS, Math.ceil(tables * HUB_SHARE));
  const referrers = new Map<string, Set<string>>();
  for (const r of schema.relations ?? []) {
    if (r.sourceTable === r.targetTable) continue;
    if (!referrers.has(r.targetTable)) referrers.set(r.targetTable, new Set());
    referrers.get(r.targetTable)!.add(r.sourceTable);
  }
  return new Set([...referrers].filter(([, from]) => from.size >= threshold).map(([t]) => t));
}

function groupData(groups: TableGroup[], id: string): GroupNodeData {
  const g = groups.find((x) => groupNodeId(x.name) === id)!;
  return { name: g.name, count: g.tables.length, tables: g.tables, unlinked: g.unlinked };
}

/** The schema's groups; lines into hub tables would pull everything into one. */
export function schemaGroups(schema: SchemaResponse, hubs: Set<string>): TableGroup[] {
  const links: Link[] = (schema?.relations ?? [])
    .filter((r) => !hubs.has(r.targetTable))
    .map((r) => [r.sourceTable, r.targetTable, r.onDelete === "CASCADE" ? CASCADE_WEIGHT : 1]);
  return groupTables((schema?.tables ?? []).map((t) => t.name), links);
}

export const groupNodeId = (name: string) => `group:${name}`;

/** Largest group first, then each group's most-linked unplaced neighbour: linked groups pack side by side. */
function packingOrder(groups: TableGroup[], cross: SchemaResponse["relations"], groupOf: Map<string, string>): TableGroup[] {
  const weight = new Map<string, number>();
  const key = (a: string, b: string) => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);
  for (const r of cross) {
    const k = key(groupOf.get(r.sourceTable)!, groupOf.get(r.targetTable)!);
    weight.set(k, (weight.get(k) ?? 0) + 1);
  }
  const left = [...groups];
  const out: TableGroup[] = [];
  while (left.length) {
    const last = out.at(-1);
    let pick = 0;
    if (last) {
      const w = left.map((g) => weight.get(key(last.name, g.name)) ?? 0);
      const best = Math.max(...w);
      if (best > 0) pick = w.indexOf(best);
    }
    out.push(...left.splice(pick, 1));
  }
  return out;
}

function buildElkGraph(schema: SchemaResponse, hubs: Set<string>, groups: TableGroup[]): {
  elkGraph: ElkNode;
  rfEdges: Edge<RelationEdgeData>[];
} {
  const safeTables = schema?.tables || [];
  const safeRelations = schema?.relations || [];

  const referenced = referencedFields(safeRelations);
  const tableNode = (table: (typeof safeTables)[number]): ElkNode => ({
    id: table.name,
    width: NODE_WIDTH,
    height: tableBoxHeight(table.fields ?? [], [...(referenced.get(table.name) ?? [])]),
    ports: buildPorts(table.fields, table.name, referenced.get(table.name) ?? new Set()),
    layoutOptions: { "elk.portConstraints": "FIXED_POS" },
  });
  const byName = new Map(safeTables.map((t) => [t.name, t]));
  const groupOf = new Map(groups.flatMap((g) => g.tables.map((t) => [t, g.name] as const)));
  const isHub = (r: SchemaResponse["relations"][number]) =>
    hubs.has(r.targetTable) && r.sourceTable !== r.targetTable;
  const isCross = (r: SchemaResponse["relations"][number]) => groupOf.get(r.sourceTable) !== groupOf.get(r.targetTable);
  const elkEdge = (relation: SchemaResponse["relations"][number]): ElkExtendedEdge => ({
    id: relation.constraintName,
    sources: [`${relation.sourceTable}__${relation.sourceField}__source`],
    targets: [`${relation.targetTable}__${relation.targetField}__target`],
  });
  const elkNodes: ElkNode[] = packingOrder(groups, safeRelations.filter((r) => !isHub(r) && isCross(r)), groupOf).map((g) => ({
    id: groupNodeId(g.name),
    layoutOptions: g.unlinked ? UNLINKED_OPTIONS : GROUP_OPTIONS,
    children: g.tables.map((t) => tableNode(byName.get(t)!)),
    edges: safeRelations.filter((r) => !isHub(r) && !isCross(r) && groupOf.get(r.sourceTable) === g.name).map(elkEdge),
  }));

  const rfEdges: Edge<RelationEdgeData>[] = safeRelations.map((relation) => ({
    id: relation.constraintName,
    source: relation.sourceTable,
    target: relation.targetTable,
    sourceHandle: `${relation.sourceTable}__${relation.sourceField}__source`,
    targetHandle: `${relation.targetTable}__${relation.targetField}__target`,
    type: "relationEdge",
    data: {
      relation,
      hub: isHub(relation) || undefined,
      cross: (!isHub(relation) && isCross(relation)) || undefined,
    },
  }));

  return {
    elkGraph: { id: "root", layoutOptions: ROOT_OPTIONS, children: elkNodes },
    rfEdges,
  };
}

export interface CanvasGraph {
  nodes: Node<TableNodeData>[];
  edges: Edge<RelationEdgeData>[];
  /** One region per group, drawn behind its tables. */
  groups: Node<GroupNodeData>[];
  /** Zoomed out, one connector per pair of linked groups. */
  links: GroupLink[];
}

export async function buildCanvasGraph(
  schema: SchemaResponse,
  provider: DatabaseProvider,
): Promise<CanvasGraph> {
  try {
    const hubs = findHubs(schema);
    const groups = schemaGroups(schema, hubs);
    const { elkGraph, rfEdges } = buildElkGraph(schema, hubs, groups);
    const chips = new Map<string, Record<string, string>>();
    for (const e of rfEdges) {
      if (!e.data?.hub && !e.data?.cross) continue;
      const refs = chips.get(e.source) ?? {};
      refs[e.data.relation.sourceField] = e.target;
      chips.set(e.source, refs);
    }
    const layouted = await (await getElk()).layout(elkGraph);

    // Coordinates come back absolute (ROOT); ports stay relative to their table.
    const laidTables = (layouted.children ?? []).flatMap((g) => g.children ?? []);
    const portPositions = new Map<string, { x: number; y: number }>();
    laidTables.forEach((elkNode) => {
      (elkNode.ports ?? []).forEach((port) => {
        portPositions.set(port.id, {
          x: (elkNode.x ?? 0) + (port.x ?? 0),
          y: (elkNode.y ?? 0) + (port.y ?? 0),
        });
      });
    });
    const groupNodes: Node<GroupNodeData>[] = (layouted.children ?? []).map((g) => ({
      id: g.id,
      type: "groupNode",
      position: { x: g.x ?? 0, y: g.y ?? 0 },
      width: g.width,
      height: g.height,
      zIndex: -1,
      selectable: false,
      draggable: false,
      focusable: false,
      data: groupData(groups, g.id),
    }));

    const safeTables = schema?.tables || [];
    const referenced = referencedFields(schema?.relations || []);
    const nodes: Node<TableNodeData>[] = laidTables
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
            chips: chips.get(table.name),
            group: groupNodeId(groups.find((g) => g.tables.includes(table.name))!.name),
          },
        };
      })
      .filter((node): node is Node<TableNodeData> => node !== null);

    const routes = new Map(
      (layouted.children ?? []).flatMap((g) => g.edges ?? []).map((e) => {
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

    const tableGroup = new Map(nodes.map((n) => [n.id, n.data.group!]));
    return { nodes, edges, groups: groupNodes, links: groupLinks(edges, (t) => tableGroup.get(t) ?? "") };
  } catch (layoutError) {
    console.error(
      "[NexusQL] Critical error computing canvas layout calculations:",
      layoutError,
    );
    return { nodes: [], edges: [], groups: [], links: [] };
  }
}

export async function reapplyLayout(
  schema: SchemaResponse,
  provider: DatabaseProvider,
): Promise<CanvasGraph> {
  return buildCanvasGraph(schema, provider);
}


