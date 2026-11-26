import type { Field } from "@/shared/types/schema";

// The full card: every column. The layout routes lines to these rows.
export const NODE_WIDTH = 240;
export const NODE_BORDER = 1;
export const NODE_HEADER = 34;
export const NODE_ROW = 26;
export const NODE_PAD_BOTTOM = 0;

export function getNodeHeight(fieldCount: number): number {
  return 2 * NODE_BORDER + NODE_HEADER + (fieldCount || 0) * NODE_ROW + NODE_PAD_BOTTOM;
}

/** A field's handle centre, from the node's top edge. */
export function handleOffsetY(index: number): number {
  return NODE_BORDER + NODE_HEADER + index * NODE_ROW + NODE_ROW / 2;
}

// The keys card drawn when zoomed out: the comp's 168px card, scaled to fill the full card's width.
export const KEYS_WIDTH = 168;
export const KEYS_HEADER = 32;
export const KEYS_ROW = 22;
export const KEYS_SCALE = NODE_WIDTH / KEYS_WIDTH;

/** Columns a keys card keeps: primary and foreign keys, and columns other tables reference. */
export function keyFields(fields: Field[], referenced: readonly string[] = []): Field[] {
  return fields.filter((f) => f.isPrimaryKey || f.isForeignKey || referenced.includes(f.name));
}

/** The keys card's height on the canvas, scale included. */
export function keysCardHeight(fields: Field[], referenced: readonly string[] = []): number {
  const keys = keyFields(fields, referenced).length;
  const rows = keys + (keys < fields.length ? 1 : 0);
  return (2 * NODE_BORDER + KEYS_HEADER + rows * KEYS_ROW) * KEYS_SCALE;
}

/** Room the layout keeps for a table: whichever card is taller. */
export function tableBoxHeight(fields: Field[], referenced: readonly string[] = []): number {
  return Math.max(getNodeHeight(fields.length), keysCardHeight(fields, referenced));
}
