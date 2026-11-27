import { toPng } from "html-to-image";

export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Panels, the minimap and React Flow's attribution stay out of saved images.
function kept(node: Node): boolean {
  if (!(node instanceof HTMLElement)) return true;
  if (node.getAttribute("data-export-exclude") === "true") return false;
  const cls = node.className;
  return typeof cls !== "string" || !/react-flow__(minimap|controls|attribution)/.test(cls);
}

/** A PNG of the element at twice its size; no background keeps it transparent. */
export function capturePng(el: HTMLElement, size: { w: number; h: number }, background?: string): Promise<string> {
  return toPng(el, { width: size.w, height: size.h, pixelRatio: 2, backgroundColor: background, filter: kept });
}
