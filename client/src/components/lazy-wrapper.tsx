import { ComponentType, ReactNode, Suspense, Component } from 'react';

// Simple Error Boundary class component
class ErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Lazy component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

interface LazyWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
  errorFallback?: ReactNode;
}

export function LazyWrapper({ 
  children, 
  fallback = <div className="h-48 bg-white dark:bg-gray-800 rounded-xl animate-pulse border"></div>,
  errorFallback = <div className="h-48 bg-white dark:bg-gray-800 rounded-xl border flex items-center justify-center text-gray-500">Failed to load component</div>
}: LazyWrapperProps) {
  return (
    <ErrorBoundary fallback={errorFallback}>
      <Suspense fallback={fallback}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

interface AsyncComponentWrapperProps {
  children: ReactNode;
  isLoading?: boolean;
  error?: Error | null;
  fallback?: ReactNode;
}

export function AsyncComponentWrapper({ 
  children, 
  isLoading = false, 
  error = null,
  fallback = <div className="h-48 bg-white dark:bg-gray-800 rounded-xl animate-pulse border"></div>
}: AsyncComponentWrapperProps) {
  if (error) {
    return (
      <div className="h-48 bg-white dark:bg-gray-800 rounded-xl border flex items-center justify-center text-gray-500">
        Failed to load component
      </div>
    );
  }

  if (isLoading) {
    return fallback;
  }

  return <>{children}</>;
}