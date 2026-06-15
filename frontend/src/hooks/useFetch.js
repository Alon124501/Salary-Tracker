import { useState, useEffect, useCallback } from 'react';
import api from '../api.js';

export function useFetch(url, { enabled = true, initialData = undefined } = {}) {
  const [data, setData]       = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const load = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const { data: result } = await api.get(url);
      setData(result);
    } catch (err) {
      const raw = err?.response?.data?.error;
      setError(typeof raw === 'string' ? raw : raw?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  return { data, setData, loading, error, reload: load };
}
