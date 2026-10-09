import { QueryCache, QueryClient } from "@tanstack/react-query";
import { notifyHttpError } from "./httpFeedback";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: (error, query) => {
    // Long-running observers own one notification per outage episode.
    if (query.meta?.errorNotification !== 'handled-locally') notifyHttpError(error);
  } }),
  defaultOptions: {
    queries: {
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      retry: false,
      retryOnMount: true,
    },
  },
});
