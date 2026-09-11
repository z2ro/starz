import { Component, type ErrorInfo, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './queryClient';
import { AppRouter } from './router';

class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('StarZ frontend error', error, info); }
  render() { return this.state.error ? <div className="fatal"><b>Interface indisponível</b><p>{this.state.error.message}</p><button onClick={() => window.location.reload()}>Recarregar</button></div> : this.props.children; }
}

export function App() { return <ErrorBoundary><QueryClientProvider client={queryClient}><AppRouter /></QueryClientProvider></ErrorBoundary>; }
