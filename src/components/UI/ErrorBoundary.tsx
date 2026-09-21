import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { PlaneswalkerSymbol } from './PlaneswalkerSymbol';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    try {
      // Clear URL params and return home
      window.location.href = window.location.origin;
    } catch (_) {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-900 text-slate-100 font-sans">
          <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl bg-slate-950/80 border border-slate-800 shadow-2xl text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-600 to-amber-600 flex items-center justify-center text-white shadow-lg mx-auto p-3">
              <AlertTriangle className="w-full h-full text-white" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-bold font-heading text-white">
                {this.props.fallbackTitle || 'Something went wrong'}
              </h2>
              <p className="text-xs text-slate-400">
                An unexpected rendering error occurred. You can reload the page or reset the view.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs font-mono text-left max-h-32 overflow-y-auto break-all">
                {this.state.error.message}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload</span>
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-700"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Reset View</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
