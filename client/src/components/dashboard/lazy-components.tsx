import { lazy, Suspense, startTransition } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

// Lazy-loaded dashboard components with proper React 18 support
const TrendsChart = lazy(() => import("@/components/trends-chart"));
const ExpenseChart = lazy(() => import("@/components/expense-chart").then(module => ({ default: module.ExpenseChart })));
const FinancialHealthScore = lazy(() => import("@/components/financial-health-score"));
const FinancialHealthMascot = lazy(() => import("@/components/financial-health-mascot"));
const QuickFinancialSnapshot = lazy(() => import("@/components/quick-financial-snapshot"));
const ContextualFinancialTips = lazy(() => import("@/components/contextual-financial-tips"));
const ExpensePrediction = lazy(() => import("@/components/expense-prediction"));
const DailyRecommendations = lazy(() => import("@/components/daily-recommendations"));
const AutoCategorization = lazy(() => import("@/components/auto-categorization"));
const AIFinancialTips = lazy(() => import("@/components/ai-financial-tips"));
const TransactionRemindersWidget = lazy(() => import("@/components/transaction-reminders-widget"));
const UnifiedRemindersWidget = lazy(() => import("@/components/unified-reminders-widget"));

// Error fallback component
function ErrorFallback({ error, resetErrorBoundary }: any) {
  return (
    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <h3 className="text-red-800 dark:text-red-200 font-medium">Something went wrong</h3>
      <p className="text-red-600 dark:text-red-300 text-sm mt-1">
        Failed to load component. Please try again.
      </p>
      <button
        onClick={resetErrorBoundary}
        className="mt-2 px-3 py-1 bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200 rounded text-sm hover:bg-red-200 dark:hover:bg-red-700"
      >
        Retry
      </button>
    </div>
  );
}

// Loading fallback component.
// `role="status"` is what a screen reader expects from a loading indicator, and the label is
// gray-500 rather than gray-400: 400 is 2.5:1 on white, which fails AA (and axe caught the
// placeholder while the real widget was still on its way).
function LoadingFallback({ className = "h-48" }: { className?: string }) {
  return (
    <div className={`${className} bg-white dark:bg-gray-800 rounded-xl animate-pulse border flex items-center justify-center`}>
      <div className="text-gray-500 dark:text-gray-400" role="status" data-testid="lazy-loading">
        Loading...
      </div>
    </div>
  );
}

// React 18 concurrent wrapper for lazy components
function LazyComponentWrapper({ 
  children, 
  fallback, 
  className = "h-48" 
}: { 
  children: React.ReactNode; 
  fallback?: React.ReactNode; 
  className?: string; 
}) {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Suspense fallback={fallback || <LoadingFallback className={className} />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

// Exported lazy components with proper React 18 wrappers
export function LazyTrendsChart(props: any) {
  return (
    <LazyComponentWrapper className="h-64">
      <TrendsChart {...props} />
    </LazyComponentWrapper>
  );
}

export function LazyExpenseChart(props: any) {
  return (
    <LazyComponentWrapper className="h-64">
      <ExpenseChart {...props} />
    </LazyComponentWrapper>
  );
}

export function LazyFinancialHealthScore(props: any) {
  return (
    <LazyComponentWrapper>
      <FinancialHealthScore {...props} />
    </LazyComponentWrapper>
  );
}

export function LazyFinancialHealthMascot(props: any) {
  return (
    <LazyComponentWrapper>
      <FinancialHealthMascot {...props} />
    </LazyComponentWrapper>
  );
}

export function LazyQuickFinancialSnapshot(props: any) {
  return (
    <LazyComponentWrapper>
      <QuickFinancialSnapshot {...props} />
    </LazyComponentWrapper>
  );
}

export function LazyContextualFinancialTips(props: any) {
  return (
    <LazyComponentWrapper>
      <ContextualFinancialTips {...props} />
    </LazyComponentWrapper>
  );
}

export function LazyExpensePrediction(props: any) {
  return (
    <LazyComponentWrapper>
      <ExpensePrediction {...props} />
    </LazyComponentWrapper>
  );
}

export function LazyDailyRecommendations(props: any) {
  return (
    <LazyComponentWrapper>
      <DailyRecommendations {...props} />
    </LazyComponentWrapper>
  );
}

export function LazyAutoCategorization(props: any) {
  return (
    <LazyComponentWrapper>
      <AutoCategorization {...props} />
    </LazyComponentWrapper>
  );
}

export function LazyAIFinancialTips(props: any) {
  return (
    <LazyComponentWrapper>
      <AIFinancialTips {...props} />
    </LazyComponentWrapper>
  );
}

export function LazyTransactionRemindersWidget(props: any) {
  return (
    <LazyComponentWrapper>
      <TransactionRemindersWidget {...props} />
    </LazyComponentWrapper>
  );
}

export function LazyUnifiedRemindersWidget(props: any) {
  return (
    <LazyComponentWrapper>
      <UnifiedRemindersWidget {...props} />
    </LazyComponentWrapper>
  );
}

// State management wrapper for React 18 concurrent features
export function withConcurrentState<T extends Record<string, any>>(
  Component: React.ComponentType<T>
): React.ComponentType<T> {
  return function ConcurrentComponent(props: T) {
    return (
      <LazyComponentWrapper>
        <Component {...(props as any)} />
      </LazyComponentWrapper>
    );
  };
}