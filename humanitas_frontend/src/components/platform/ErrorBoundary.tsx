import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Catches render errors so one broken component never blanks the whole app (AGENTS.md rule 24).
 * - scope "app": last line of defence around everything, full-screen message.
 * - scope "page": around each routed page; the navigation stays usable and the page recovers
 *   when the user goes somewhere else (resetKey = current path).
 */
interface Props {
  children: ReactNode;
  scope?: 'app' | 'page';
  resetKey?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.scope ?? 'page'}]`, error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  private retry = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const app = this.props.scope === 'app';
    return (
      <div
        role="alert"
        className={app ? 'flex min-h-screen items-center justify-center p-6' : 'flex min-h-[50vh] items-center justify-center p-6'}
      >
        <div className="max-w-md space-y-4 rounded-lg border bg-card p-6 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{app ? 'Something went wrong' : 'This page ran into a problem'}</h2>
            <p className="text-sm text-muted-foreground">
              {app
                ? 'The app hit an unexpected error. Reloading usually fixes it; your saved data is safe.'
                : 'The rest of the app still works. Try again, open another page, or reload.'}
            </p>
            {import.meta.env.DEV && <pre className="mt-2 whitespace-pre-wrap text-left text-xs text-destructive">{error.message}</pre>}
          </div>
          <div className="flex justify-center gap-2">
            {!app && (
              <Button variant="outline" onClick={this.retry}>
                <RotateCcw className="mr-2 h-4 w-4" /> Try again
              </Button>
            )}
            <Button onClick={() => window.location.reload()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Reload
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

/** Error boundary for routed pages: resets itself when the user navigates. */
export function PageErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary scope="page" resetKey={pathname}>
      {children}
    </ErrorBoundary>
  );
}
