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

// --- Student start page: categories as a tree of subjects ---

export interface SubjectTreeNode<S> {
  // Accordion item value — must be a string.
  key: string
  name: string
  // Subjects filed directly under this category.
  subjects: S[]
  children: SubjectTreeNode<S>[]
  // Every subject id in this node's whole subtree — for "N selected" badges.
  subjectIds: number[]
}

// Builds the category tree with each subject placed under its category, pruning every
// category (at any depth) whose subtree contains none of `subjects`. Subjects with no category
// (or whose category no longer exists) come back separately as `uncategorized`.
export function buildSubjectTree<S extends { id: number, categoryId: number | null }>(
  categoryRows: Pick<CategoryRow, 'id' | 'parentId' | 'name' | 'sortOrder'>[],
  subjects: S[]
): { nodes: SubjectTreeNode<S>[], uncategorized: S[] } {
  const known = new Set(categoryRows.map(c => c.id))
  const subjectsByCategory = new Map<number, S[]>()
  const uncategorized: S[] = []
  for (const s of subjects) {
    if (s.categoryId !== null && known.has(s.categoryId)) {
      const list = subjectsByCategory.get(s.categoryId) ?? []
      list.push(s)
      subjectsByCategory.set(s.categoryId, list)
    } else {
      uncategorized.push(s)
    }
  }

  const tree = buildCategoryTree(categoryRows.map(c => ({ ...c, subjectCount: 0 })))

  const convert = (nodes: CategoryNode[]): SubjectTreeNode<S>[] => nodes.flatMap((n) => {
    const children = convert(n.children)
    const direct = subjectsByCategory.get(n.id) ?? []
    if (direct.length === 0 && children.length === 0) return []
    return [{
      key: `category-${n.id}`,
      name: n.name,
      subjects: direct,
      children,
      subjectIds: [...direct.map(s => s.id), ...children.flatMap(c => c.subjectIds)]
    }]
  })

  return { nodes: convert(tree), uncategorized }
}
