"use client";

import { useEffect, useState } from "react";
import { getJson } from "@/lib/client/api-cache";

interface RealtimeListOptions<T> {
  path: string;
  fallbackUrl: string;
  orderChild?: string;
  equalValue?: string | number | boolean;
  map?: (item: any, id: string) => T;
}

export function useRealtimeList<T = any>({
  path,
  fallbackUrl,
  orderChild,
  equalValue,
  map,
}: RealtimeListOptions<T>) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let fallbackTimer: number | undefined;

    async function loadFallback(force = false) {
      try {
        const json = await getJson<unknown>(fallbackUrl, { ttlMs: 15_000, force });
        if (!cancelled) {
          const list = Array.isArray(json) ? json : [];
          setData(map ? list.map((item, index) => map(item, String(item?.id ?? index))) : list);
          setError("");
        }
      } catch (event) {
        if (!cancelled) setError(event instanceof Error ? event.message : "Failed to load data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    function startApiPolling() {
      loadFallback();
      fallbackTimer = window.setInterval(() => {
        if (document.visibilityState === "visible") loadFallback(true);
      }, 30_000);
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") loadFallback(true);
    };

    // Sensitive business data is loaded through role-scoped API routes. Direct
    // browser subscriptions would require exposing broad RTDB read permissions.
    setLive(false);
    startApiPolling();
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      cancelled = true;
      if (fallbackTimer) window.clearInterval(fallbackTimer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [fallbackUrl, map]);

  return { data, loading, error, live };
}
