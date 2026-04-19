"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
<<<<<<< HEAD
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
=======
import { useState, type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
>>>>>>> worktree-agent-a82adea1
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
<<<<<<< HEAD
            // In a Tauri app, we don't refetch on window focus by default
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
=======
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
>>>>>>> worktree-agent-a82adea1
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
