import { QueryClient } from "@tanstack/react-query"
import { ApiError } from "@/lib/api-error"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.statusCode < 500) {
          return false
        }
        return failureCount < 1
      },
    },
  },
})
