"use client";

import { useEffect, useState } from "react";
import { onValue, query, ref, orderByChild, equalTo, type Unsubscribe } from "firebase/database";
import { getFirebaseDb } from "@/lib/db/client";

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
    let unsubscribe: Unsubscribe | undefined;
    let fallbackTimer: number | undefined;

    async function loadFallback() {
      try {
        const response = await fetch(fallbackUrl);
        if (!response.ok) throw new Error("Failed to load data");
        const json = await response.json();
        if (!cancelled) setData(Array.isArray(json) ? json : []);
      } catch (event) {
        if (!cancelled) setError(event instanceof Error ? event.message : "Failed to load data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    function startFallbackPolling() {
      loadFallback();
      fallbackTimer = window.setInterval(loadFallback, 15000);
    }

    try {
      const dbRef = ref(getFirebaseDb(), path);
      const dbQuery = orderChild && equalValue !== undefined
        ? query(dbRef, orderByChild(orderChild), equalTo(equalValue))
        : dbRef;
      unsubscribe = onValue(dbQuery, (snapshot) => {
        const value = snapshot.val();
        const list = value && typeof value === "object"
          ? Object.entries(value).map(([id, item]) => map ? map(item, id) : ({ id, ...(item as object) } as T))
          : [];
        setData(list);
        setError("");
        setLive(true);
        setLoading(false);
      }, () => {
        setLive(false);
        startFallbackPolling();
      });
    } catch {
      setLive(false);
      startFallbackPolling();
    }

    return () => {
      cancelled = true;
      if (fallbackTimer) window.clearInterval(fallbackTimer);
      unsubscribe?.();
    };
  }, [path, fallbackUrl, orderChild, equalValue, map]);

  return { data, loading, error, live };
}
