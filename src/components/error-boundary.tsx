'use client';

import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="d-flex align-items-center justify-content-center p-5" style={{ minHeight: '60vh' }}>
        <div className="text-center" style={{ maxWidth: '480px' }}>
          <i className="fa fa-triangle-exclamation fa-3x text-danger mb-3 d-block"></i>
          <h3 className="mb-2">Something went wrong</h3>
          <p className="text-muted mb-3">
            The page hit an unexpected error. Your data is safe — this is a display problem, not a data loss.
          </p>
          <details className="text-start mb-3">
            <summary className="text-muted small" style={{ cursor: 'pointer' }}>Error details</summary>
            <pre className="bg-light p-2 mt-2 small rounded" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {error.message}
            </pre>
          </details>
          <div className="d-flex gap-2 justify-content-center">
            <button className="btn btn-primary" onClick={this.reset}>
              <i className="fa fa-rotate me-1"></i>Try again
            </button>
            <button className="btn btn-outline-secondary" onClick={() => window.location.href = '/'}>
              <i className="fa fa-house me-1"></i>Go home
            </button>
          </div>
        </div>
      </div>
    );
  }
}
