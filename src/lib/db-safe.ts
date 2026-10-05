/**
 * Run a query that touches a newer column or table, falling back if the
 * database hasn't been migrated yet - so a missing migration loses a small
 * feature (a label, a list) instead of breaking the page.
 * (Prisma's query objects only run when awaited, so `.catch()` on them
 * doesn't catch reliably: await inside try instead.)
 */
export async function orFallback<T>(run: () => Promise<T>, fallback: T | (() => Promise<T>)): Promise<T> {
  try {
    return await run()
  } catch (err) {
    console.warn("Query fell back (has `npx prisma migrate deploy` been run?):", err instanceof Error ? err.message.split("\n").pop() : err)
    return typeof fallback === "function" ? await (fallback as () => Promise<T>)() : fallback
  }
}
