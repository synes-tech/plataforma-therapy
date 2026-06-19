import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Suspense } from 'react';
import { RouteLoadingFallback } from '@containers/loading';
import { isAuthSessionError } from '@shared/lib/auth-session';
import { AppRoutes } from './routes';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: (failureCount, error) => {
        if (isAuthSessionError(error)) return false;
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: (failureCount, error) => {
        if (isAuthSessionError(error)) return false;
        return failureCount < 1;
      },
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <a href="#main-content" className="skip-link">
          Pular para o conteúdo principal
        </a>
        <Suspense fallback={<RouteLoadingFallback />}>
          <main id="main-content">
            <AppRoutes />
          </main>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
