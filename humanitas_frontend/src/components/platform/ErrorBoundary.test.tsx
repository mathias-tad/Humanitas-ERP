import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function Boom({ fail }: { fail: boolean }) {
  if (fail) throw new Error('kaboom');
  return <p>page content</p>;
}

describe('ErrorBoundary (AGENTS.md rule 24)', () => {
  it('shows a recoverable message instead of a blank screen when a page throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <div>
        <nav>menu</nav>
        <ErrorBoundary scope="page">
          <Boom fail />
        </ErrorBoundary>
      </div>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('This page ran into a problem');
    expect(screen.getByText('menu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    spy.mockRestore();
  });

  it('recovers when the user navigates (resetKey changes)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Harness() {
      const [path, setPath] = useState('/broken');
      return (
        <>
          <button onClick={() => setPath('/fine')}>go</button>
          <ErrorBoundary scope="page" resetKey={path}>
            <Boom fail={path === '/broken'} />
          </ErrorBoundary>
        </>
      );
    }
    render(<Harness />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByText('go'));
    expect(screen.getByText('page content')).toBeInTheDocument();
    spy.mockRestore();
  });

  it('the app-level boundary offers a reload', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary scope="app">
        <Boom fail />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
    spy.mockRestore();
  });
});
