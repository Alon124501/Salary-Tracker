import { useState, useEffect, useCallback } from 'react';
import api from '../api.js';

const cache = new Map(); // url -> { data, ts }
const TTL = 30_000;      // 30 seconds

export function useFetch(url, { enabled = true, initialData = undefined } = {}) {
  const cached = url && cache.get(url);
  const [data, setData]       = useState(cached ? cached.data : initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const load = useCallback(async ({ background = false } = {}) => {
    if (!url) return;
    if (!background) setLoading(true);
    setError(null);
    try {
      const { data: result } = await api.get(url);
      cache.set(url, { data: result, ts: Date.now() });
      setData(result);
    } catch (err) {
      const raw = err?.response?.data?.error;
      setError(typeof raw === 'string' ? raw : raw?.message || 'Failed to load');
    } finally {
      if (!background) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (!enabled || !url) return;
    const hit = cache.get(url);
    if (hit && Date.now() - hit.ts < TTL) {
      // Serve from cache immediately, revalidate silently in background
      setData(hit.data);
      load({ background: true });
    } else {
      load();
    }
  }, [enabled, load, url]);

  return { data, setData, loading, error, reload: load };
}
