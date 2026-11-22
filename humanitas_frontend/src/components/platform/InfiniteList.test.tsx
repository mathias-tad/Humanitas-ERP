import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LoadMore, nextPageOf } from './InfiniteList';

describe('infinite lists', () => {
  it('asks for the next page only while more remain', () => {
    expect(nextPageOf({ data: [1, 2], meta: { page: 1, limit: 2, total: 5 } })).toBe(2);
    expect(nextPageOf({ data: [5], meta: { page: 3, limit: 2, total: 5 } })).toBeUndefined();
    expect(nextPageOf({ data: [], meta: { page: 1, limit: 40, total: 0 } })).toBeUndefined();
    expect(nextPageOf(undefined)).toBeUndefined();
  });

  it('loads more when pointed at or clicked, and shows how many are loaded', () => {
    const fetchNextPage = vi.fn();
    render(<LoadMore hasNextPage isFetchingNextPage={false} fetchNextPage={fetchNextPage} loaded={40} total={95} noun="products" />);
    expect(screen.getByText('Showing 40 of 95 products')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
    fireEvent.pointerEnter(screen.getByText('Showing 40 of 95 products').parentElement!);
    expect(fetchNextPage).toHaveBeenCalledTimes(2);
  });

  it('hides the button when everything is loaded', () => {
    render(<LoadMore hasNextPage={false} isFetchingNextPage={false} fetchNextPage={vi.fn()} loaded={12} total={12} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Showing 12 of 12 items')).toBeInTheDocument();
  });
});
