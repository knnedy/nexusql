/** Tables drawn together in one region of the diagram. */
export interface TableGroup {
  /** The group's most-linked table; "Not linked" for tables without keys between them. */
  name: string;
  /** The tables, most-linked first. */
  tables: string[];
  unlinked?: true;
}

type Graph = Map<number, Map<number, number>>;

/** A foreign key as [source table, target table, weight]; weight defaults to 1. */
export type Link = [source: string, target: string, weight?: number];

// A row deleted with its parent belongs with it: such keys pull harder.
export const CASCADE_WEIGHT = 1.5;

const addWeight = (g: Graph, a: number, b: number, w: number) => {
  if (!g.has(a)) g.set(a, new Map());
  g.get(a)!.set(b, (g.get(a)!.get(b) ?? 0) + w);
};

/**
 * One Louvain pass: each node moves to the neighbouring community that raises
 * modularity most, until none moves. Returns each node's community.
 */
function localMoves(nodes: number[], g: Graph): Map<number, number> {
  const degree = new Map(nodes.map((n) => [n, [...(g.get(n) ?? new Map()).values()].reduce((s, w) => s + w, 0)]));
  const total = [...degree.values()].reduce((s, d) => s + d, 0) || 1;
  const comm = new Map(nodes.map((n) => [n, n]));
  const tot = new Map(nodes.map((n) => [n, degree.get(n)!]));

  for (let moved = true, rounds = 0; moved && rounds < 50; rounds++) {
    moved = false;
    for (const n of nodes) {
      const own = comm.get(n)!;
      const k = degree.get(n)!;
      tot.set(own, tot.get(own)! - k);
      const links = new Map<number, number>();
      for (const [m, w] of g.get(n) ?? []) if (m !== n) links.set(comm.get(m)!, (links.get(comm.get(m)!) ?? 0) + w);
      const gain = (c: number) => (links.get(c) ?? 0) - ((tot.get(c) ?? 0) * k) / total;
      let best = own;
      let bestGain = gain(own);
      // Ties keep the node where it is, then prefer the lowest community: the result never depends on input order.
      for (const c of [...links.keys()].sort((a, b) => a - b)) {
        if (gain(c) > bestGain + 1e-9) [best, bestGain] = [c, gain(c)];
      }
      tot.set(best, tot.get(best)! + k);
      if (best !== own) {
        comm.set(n, best);
        moved = true;
      }
    }
  }
  return comm;
}

// A group this small adds a region without telling much; it joins its closest group instead.
const MIN_GROUP = 3;

function foldSmall(groups: Map<number, string[]>, member: Map<number, number>, links: Link[], index: Map<string, number>) {
  const islands = new Set<number>();
  for (;;) {
    const small = [...groups].filter(([c, ts]) => ts.length < MIN_GROUP && !islands.has(c)).sort(([a, x], [b, y]) => x.length - y.length || a - b)[0];
    if (!small || groups.size < 2) return;
    const [id, ts] = small;
    const pull = new Map<number, number>();
    for (const [a, b, w = 1] of links) {
      const [ca, cb] = [member.get(index.get(a)!), member.get(index.get(b)!)];
      if (ca === id && cb !== undefined && cb !== id) pull.set(cb, (pull.get(cb) ?? 0) + w);
      if (cb === id && ca !== undefined && ca !== id) pull.set(ca, (pull.get(ca) ?? 0) + w);
    }
    const size = (c: number) => groups.get(c)!.length;
    const into = [...pull].sort(([a, x], [b, y]) => y - x || size(b) - size(a) || a - b)[0]?.[0];
    if (into === undefined) {
      islands.add(id); // links to no other group: nothing to join
      continue;
    }
    groups.set(into, [...groups.get(into)!, ...ts]);
    groups.delete(id);
    for (const t of ts) member.set(index.get(t)!, into);
  }
}

/** Groups tables by their foreign keys (Louvain communities), largest group first. */
export function groupTables(tables: string[], links: Link[]): TableGroup[] {
  const sorted = [...new Set(tables)].sort();
  const index = new Map(sorted.map((t, i) => [t, i]));
  const degree = new Map<string, number>();
  let g: Graph = new Map();
  for (const [a, b, w = 1] of links) {
    if (a === b || !index.has(a) || !index.has(b)) continue;
    addWeight(g, index.get(a)!, index.get(b)!, w);
    addWeight(g, index.get(b)!, index.get(a)!, w);
    degree.set(a, (degree.get(a) ?? 0) + 1);
    degree.set(b, (degree.get(b) ?? 0) + 1);
  }

  const linked = sorted.map((_, i) => i).filter((i) => g.has(i));
  // member[node] is its community at the current level, starting from single tables.
  let member = new Map(linked.map((i) => [i, i]));
  let nodes = linked;
  for (let level = 0; level < 20; level++) {
    const comm = localMoves(nodes, g);
    if ([...comm].every(([n, c]) => n === c)) break;
    member = new Map([...member].map(([t, c]) => [t, comm.get(c)!]));
    const next: Graph = new Map();
    for (const [a, out] of g) for (const [b, w] of out) addWeight(next, comm.get(a)!, comm.get(b)!, w);
    g = next;
    nodes = [...new Set(comm.values())].sort((a, b) => a - b);
  }

  const byCommunity = new Map<number, string[]>();
  for (const [t, c] of member) byCommunity.set(c, [...(byCommunity.get(c) ?? []), sorted[t]]);
  foldSmall(byCommunity, member, links, index);
  const rank = (a: string, b: string) => (degree.get(b) ?? 0) - (degree.get(a) ?? 0) || a.localeCompare(b);
  const groups: TableGroup[] = [...byCommunity.values()].map((ts) => {
    const ordered = ts.sort(rank);
    return { name: ordered[0], tables: ordered };
  });
  groups.sort((a, b) => b.tables.length - a.tables.length || a.name.localeCompare(b.name));

  const alone = sorted.filter((t) => !g.size || !linked.includes(index.get(t)!));
  if (alone.length) groups.push({ name: "Not linked", tables: alone, unlinked: true });
  return groups;
}
