import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './styles/global.css';

import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { configureApiClient } from './api/http';
import { queryClient } from './api/query-client';
import { theme } from './theme';

// 在任何页面发请求前，先给生成客户端装上 Base URL 和认证 fetch。
configureApiClient();

const enableQueryDevtools = import.meta.env.VITE_ENABLE_QUERY_DEVTOOLS === 'true';
// Devtools 体积只在显式开启时才异步加载。
const ReactQueryDevtools = lazy(() =>
  import('@tanstack/react-query-devtools').then((module) => ({
    default: module.ReactQueryDevtools,
  })),
);

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme}>
        <Notifications position="top-right" />
        <App />
      </MantineProvider>
      {enableQueryDevtools ? (
        <Suspense fallback={null}>
          <ReactQueryDevtools initialIsOpen={false} />
        </Suspense>
      ) : null}
    </QueryClientProvider>
  </StrictMode>,
);
