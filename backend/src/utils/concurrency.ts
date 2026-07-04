export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A minimal worker pool: runs `fn` over `items` with at most `limit`
// tasks in flight at once. Each of the `limit` "workers" pulls the
// next item off a shared cursor as soon as it finishes its current
// one — so fast rows don't wait for slow ones (unlike batching).
export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>
): Promise<void> {
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      await fn(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
}
