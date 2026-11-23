import React from 'react';
import { IconAlertCircle, IconHome, IconRefresh } from './Icons';

export interface AppErrorBoundaryProps {
  children: React.ReactNode;
  resetKey?: string;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  isChunkLoadError: boolean;
}

function detectChunkLoadFailure(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : String(error ?? '');
  const lower = message.toLowerCase();
  return (
    lower.includes('chunkloaderror') ||
    lower.includes('failed to fetch dynamically imported module') ||
    lower.includes('importing a module script failed') ||
    lower.includes('error loading dynamically imported module')
  );
}

export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      isChunkLoadError: false,
    };
  }

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    const isChunkLoadError = detectChunkLoadFailure(error);
    const errorMessage =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : 'An unexpected screen error occurred.';
    return {
      hasError: true,
      errorMessage,
      isChunkLoadError,
    };
  }

  override componentDidCatch(error: unknown): void {
    console.error('LiteLearn screen error boundary caught:', error);
  }

  override componentDidUpdate(prevProps: AppErrorBoundaryProps): void {
    if (
      this.state.hasError &&
      this.props.resetKey !== undefined &&
      this.props.resetKey !== prevProps.resetKey
    ) {
      this.setState({
        hasError: false,
        errorMessage: '',
        isChunkLoadError: false,
      });
    }
  }

  private readonly handleRetry = (): void => {
    if (this.state.isChunkLoadError && typeof window !== 'undefined') {
      window.location.reload();
      return;
    }
    this.setState({
      hasError: false,
      errorMessage: '',
      isChunkLoadError: false,
    });
  };

  private readonly handleReturnHome = (): void => {
    this.setState({
      hasError: false,
      errorMessage: '',
      isChunkLoadError: false,
    });
    if (typeof window !== 'undefined') {
      window.location.assign('/');
    }
  };

  override render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const title = this.state.isChunkLoadError
      ? 'This screen could not load offline'
      : 'Something went wrong on this screen';
    const description = this.state.isChunkLoadError
      ? 'Your saved courses and notes remain intact on this device. Reconnect briefly or reload the app to fetch the updated screen.'
      : 'Your local study data is safe in device storage. Try rendering this screen again or return to Home.';

    return (
      <div
        className="page-stack"
        style={{ padding: '24px 16px', maxWidth: '640px', margin: '0 auto' }}
      >
        <section className="index-card index-card--urgent state-card" role="alert">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <IconAlertCircle size={20} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
            <h1 style={{ margin: 0, fontSize: '20px' }}>{title}</h1>
          </div>
          <p className="state-card__body">{description}</p>
          {!this.state.isChunkLoadError && this.state.errorMessage ? (
            <p className="meta-text mono-code" style={{ margin: 0 }}>
              {this.state.errorMessage}
            </p>
          ) : null}
          <div className="state-card__actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={this.handleRetry}
            >
              <IconRefresh size={16} />
              <span>{this.state.isChunkLoadError ? 'Reload app' : 'Try again'}</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={this.handleReturnHome}
            >
              <IconHome size={16} />
              <span>Return to Home</span>
            </button>
          </div>
        </section>
      </div>
    );
  }
}
