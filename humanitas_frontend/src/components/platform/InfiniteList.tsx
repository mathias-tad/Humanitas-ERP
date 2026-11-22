import { useEffect, useRef } from 'react';
import { keepPreviousData, useInfiniteQuery, type QueryKey } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Long lists load a page at a time and fetch the next page as the user nears the end
 * (AGENTS.md rule 24 item 21). Never load a whole table into the browser.
 */
export const LIST_PAGE_SIZE = 40;

export interface PagedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number };
}

export function nextPageOf(last: PagedResponse<unknown> | undefined): number | undefined {
  if (!last?.meta) return undefined;
  const { page, limit, total } = last.meta;
  return page * limit < total && last.data.length > 0 ? page + 1 : undefined;
}

/** Infinite query over a paged endpoint ({ data, meta: { page, limit, total } }). */
export function useInfiniteList<T>(queryKey: QueryKey, fetchPage: (page: number, limit: number) => Promise<PagedResponse<T>>, pageSize = LIST_PAGE_SIZE) {
  const q = useInfiniteQuery({
    queryKey: [...queryKey, 'infinite', pageSize],
    queryFn: ({ pageParam }) => fetchPage(pageParam, pageSize),
    initialPageParam: 1,
    getNextPageParam: (last) => nextPageOf(last),
    placeholderData: keepPreviousData,
  });
  const rows = (q.data?.pages ?? []).flatMap((p) => p.data);
  const total = q.data?.pages?.[0]?.meta.total ?? 0;
  return { ...q, rows, total };
}

interface LoadMoreProps {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
  loaded: number;
  total: number;
  noun?: string;
}

/**
 * Put under a list: loads the next page when it scrolls into view (a little before, so it feels
 * instant) or when the pointer moves over it; the button is there for keyboards and old browsers.
 */
export function LoadMore({ hasNextPage, isFetchingNextPage, fetchNextPage, loaded, total, noun = 'items' }: LoadMoreProps) {
  const ref = useRef<HTMLDivElement>(null);
  const state = useRef({ hasNextPage, isFetchingNextPage, fetchNextPage });
  state.current = { hasNextPage, isFetchingNextPage, fetchNextPage };

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        const s = state.current;
        if (entries.some((e) => e.isIntersecting) && s.hasNextPage && !s.isFetchingNextPage) void s.fetchNextPage();
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const more = () => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  };

  if (!total) return <div ref={ref} />;
  return (
    <div ref={ref} className="flex items-center justify-center gap-3 py-3 text-xs text-muted-foreground" onPointerEnter={more} aria-live="polite">
      <span>Showing {Math.min(loaded, total)} of {total} {noun}</span>
      {hasNextPage && (
        <Button type="button" variant="outline" size="sm" onClick={more} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Loading…</> : 'Load more'}
        </Button>
      )}
    </div>
  );
}
