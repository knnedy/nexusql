import type { EdgeTypes, NodeTypes } from "@xyflow/react";
import GroupNode from "./group-node";
import RelationEdge from "./relation-edge";
import TableNode from "./table-node";

export const nodeTypes: NodeTypes = { tableNode: TableNode, groupNode: GroupNode };
export const edgeTypes: EdgeTypes = { relationEdge: RelationEdge };
