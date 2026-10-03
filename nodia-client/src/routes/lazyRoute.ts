import { lazy, type ComponentType, type LazyExoticComponent } from "react";

/**
 * Wraps dynamic imports with automatic recovery in case of stale asset hashes
 * after a production deployment.
 */
export function lazyWithRetry<T extends ComponentType>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      const isChunkError =
        error instanceof Error &&
        (error.message.includes("dynamically imported module") ||
          error.message.includes("Loading chunk") ||
          error.message.includes("Importing a module script failed"));

      const hasReloaded = window.sessionStorage.getItem("nodia-chunk-refreshed");
      if (isChunkError && !hasReloaded) {
        window.sessionStorage.setItem("nodia-chunk-refreshed", "true");
        window.location.reload();
        return new Promise(() => {});
      }

      window.sessionStorage.removeItem("nodia-chunk-refreshed");
      throw error;
    }
  });
}
