import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Suspense } from 'react';
import { AppRoutes } from './routes';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <a href="#main-content" className="skip-link">
          Pular para o conteúdo principal
        </a>
        <Suspense
          fallback={
            <div className="flex min-h-dvh items-center justify-center bg-surface">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          }
        >
          <main id="main-content">
            <AppRoutes />
          </main>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
