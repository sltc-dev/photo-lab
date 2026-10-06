import { QueryCache, QueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { getApiErrorMessage } from './http';

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.notifyError !== true) return;

      void getApiErrorMessage(error).then((message) => {
        notifications.show({
          id: 'api-query-error',
          color: 'red',
          title: '请求失败',
          message,
        });
      });
    },
  }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
