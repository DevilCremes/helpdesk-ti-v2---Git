import { useState, useCallback } from 'react';

export function usePagination<T>(
  fetcher: (page: number) => T[],
  deps: any[] = []
) {
  const [items, setItems]     = useState<T[]>([]);
  const [page, setPage]       = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const load = useCallback((reset = false) => {
    const p = reset ? 0 : page;
    const newItems = fetcher(p);
    if (reset) {
      setItems(newItems);
      setPage(1);
    } else {
      setItems(prev => [...prev, ...newItems]);
      setPage(p + 1);
    }
    setHasMore(newItems.length === 30);
    setLoading(false);
  }, [page, ...deps]);

  const refresh = useCallback(() => load(true), [...deps]);
  const loadMore = useCallback(() => {
    if (!hasMore || loading) return;
    setLoading(true);
    load(false);
  }, [hasMore, loading, load]);

  return { items, refresh, loadMore, hasMore, loading };
}
