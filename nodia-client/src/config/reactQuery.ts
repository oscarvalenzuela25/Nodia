import { QueryCache, QueryClient } from "@tanstack/react-query";
import { notifyHttpError } from "./httpFeedback";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: notifyHttpError }),
  defaultOptions: {
    queries: {
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      retry: false,
      retryOnMount: true,
    },
  },
});
