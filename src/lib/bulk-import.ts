/** Prisma default transaction timeout is 5s — bulk imports need more. */
export const BULK_TX_OPTIONS = {
  maxWait: 15_000,
  timeout: 60_000,
} as const

export const BULK_BATCH_SIZE = 25

export async function runBatched<T, R>(
  items: T[],
  batchSize: number,
  runBatch: (batch: T[]) => Promise<R[]>
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await runBatch(batch)
    results.push(...batchResults)
  }
  return results
}
