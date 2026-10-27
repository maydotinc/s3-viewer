import { act, createElement, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";

const mountRuntime = async (children: ReactNode) => {
   vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
   const queryClient = new QueryClient({
      defaultOptions: {
         queries: { retry: false, gcTime: Infinity },
         mutations: { retry: false },
      },
   });
   const container = document.createElement("div");
   document.body.append(container);
   const root = createRoot(container);
   await act(async () => {
      root.render(
         createElement(
            StrictMode,
            null,
            createElement(
               QueryClientProvider,
               { client: queryClient },
               children
            )
         )
      );
   });
   let mounted = true;
   return {
      container,
      queryClient,
      unmount: async () => {
         if (!mounted) return;
         mounted = false;
         await act(async () => root.unmount());
         container.remove();
      },
   };
};

const deferred = <T>() => {
   let resolve!: (value: T) => void;
   let reject!: (reason: unknown) => void;
   const promise = new Promise<T>((yes, no) => {
      resolve = yes;
      reject = no;
   });
   return { promise, resolve, reject };
};

// TanStack Query notifies observers in a later task; flush it with a real timer inside act.
const flushRuntime = async () => {
   await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
   });
};

// flushes until the expected effect shows, so a test does not depend on how many tasks the code takes to get there
const flushUntil = async (expectation: () => void, attempts = 20) => {
   for (let attempt = 1; ; attempt++) {
      await flushRuntime();
      try {
         expectation();
         return;
      } catch (error) {
         if (attempt >= attempts) throw error;
      }
   }
};

export { deferred, flushRuntime, flushUntil, mountRuntime };
