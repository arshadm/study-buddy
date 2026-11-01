export interface CategoryRow {
  id: number
  parentId: number | null
  name: string
  sortOrder: number
  subjectCount: number
}

export interface CategoryNode extends CategoryRow {
  children: CategoryNode[]
  depth: number
}

export function buildCategoryTree(rows: CategoryRow[]): CategoryNode[] {
  const byParent = new Map<number | null, CategoryRow[]>()
  for (const row of rows) {
    const list = byParent.get(row.parentId) ?? []
    list.push(row)
    byParent.set(row.parentId, list)
  }

  const build = (parentId: number | null, depth: number): CategoryNode[] =>
    (byParent.get(parentId) ?? [])
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
      .map(row => ({ ...row, depth, children: build(row.id, depth + 1) }))

  return build(null, 0)
}

// Depth-first, in display order — handy for select menus.
export function flattenCategoryTree(nodes: CategoryNode[]): CategoryNode[] {
  return nodes.flatMap(n => [n, ...flattenCategoryTree(n.children)])
}

// id → "Sciences › Physics › Mechanics"
export function categoryPathLabels(rows: CategoryRow[]): Map<number, string> {
  const byId = new Map(rows.map(r => [r.id, r]))
  const labels = new Map<number, string>()
  const labelOf = (id: number, seen = new Set<number>()): string => {
    const cached = labels.get(id)
    if (cached) return cached
    const row = byId.get(id)
    if (!row) return ''
    seen.add(id)
    const label = row.parentId !== null && !seen.has(row.parentId)
      ? `${labelOf(row.parentId, seen)} › ${row.name}`
      : row.name
    labels.set(id, label)
    return label
  }
  for (const r of rows) labelOf(r.id)
  return labels
}

export function descendantIds(node: CategoryNode): Set<number> {
  const ids = new Set<number>([node.id])
  for (const child of node.children) {
    for (const id of descendantIds(child)) ids.add(id)
  }
  return ids
}

export type CategoryAction = 'add-child' | 'rename' | 'move' | 'up' | 'down' | 'delete'
export const CATEGORY_ACTION_KEY = Symbol('category-action') as InjectionKey<(action: CategoryAction, node: CategoryNode) => void>
