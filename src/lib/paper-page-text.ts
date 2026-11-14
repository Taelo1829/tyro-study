type TextItem = { str: string; hasEOL?: boolean; transform?: number[] }

/** Moodle exports can store every left-hand question label before all bodies.
 * Restore visual reading order for this format before identifying questions.
 */
export function paperPageText(items: TextItem[]) {
  const original = items.map(item => item.str + (item.hasEOL ? "\n" : " ")).join("").trim()
  if (!/Question\s+\d+/i.test(original) || !/Marked\s+out\s+of/i.test(original) ||
      items.some(item => !item.transform || item.transform.length < 6)) return original
  const sorted = items.filter(i => i.str.trim()).sort((a, b) => b.transform![5] - a.transform![5])
  const lines: { y: number; items: TextItem[] }[] = []
  for (const item of sorted) {
    const y = item.transform![5]
    const last = lines.at(-1)
    if (last && Math.abs(last.y - y) < 2) last.items.push(item)
    else lines.push({ y, items: [item] })
  }
  return lines.map(line => line.items.sort((a, b) => a.transform![4] - b.transform![4]).map(i => i.str).join(" ")).join("\n")
}
