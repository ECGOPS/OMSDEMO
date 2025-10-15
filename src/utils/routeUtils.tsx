import React, { Suspense } from 'react';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

interface RouteLoadingFallbackProps {
  message?: string;
}

const RouteLoadingFallback: React.FC<RouteLoadingFallbackProps> = ({ 
  message = 'Loading page...' 
}) => (
  <div className="flex flex-col items-center justify-center min-h-[50vh]">
    <LoadingSpinner size="large" />
    <p className="mt-4 text-gray-600">{message}</p>
  </div>
);

export const withRouteSuspense = <P extends object>(
  Component: React.ComponentType<P>,
  loadingMessage?: string
) => {
  const WrappedComponent: React.FC<P> = (props) => (
    <Suspense fallback={<RouteLoadingFallback message={loadingMessage} />}>
      <Component {...props} />
    </Suspense>
  );

  return WrappedComponent;
};

export const lazyLoadRoute = <P extends object>(
  importFn: () => Promise<{ default: React.ComponentType<P> }>,
  loadingMessage?: string
) => {
  const LazyComponent = React.lazy(importFn);
  return withRouteSuspense(LazyComponent, loadingMessage);
}; 