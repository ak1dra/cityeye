'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAnalyticsOverview, getReportsPage } from '../../frontend/src/api';
import { supabase } from '../../frontend/src/lib/supabase';

function buildChannelId(prefix, value) {
  const source = String(value || prefix);
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash + source.charCodeAt(index)) | 0;
  }
  return `${prefix}-${Math.abs(hash)}`;
}

export function useReportsResource(params = {}, { enabled = true, realtime = true } = {}) {
  const queryKey = JSON.stringify(params ?? {});
  const stableParams = useMemo(() => JSON.parse(queryKey), [queryKey]);
  const [page, setPage] = useState({
    items: [],
    total: 0,
    limit: Number.isFinite(stableParams.limit) ? stableParams.limit : 120,
    offset: Number.isFinite(stableParams.offset) ? stableParams.offset : 0,
    has_more: false,
    source: 'supabase',
  });
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState('');

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!enabled) return null;

    if (!silent) setLoading(true);
    setError('');

    try {
      const nextPage = await getReportsPage(stableParams);
      setPage(nextPage);
      return nextPage;
    } catch (nextError) {
      setError(nextError.message || 'Не удалось загрузить обращения.');
      throw nextError;
    } finally {
      setLoading(false);
    }
  }, [enabled, stableParams]);

  useEffect(() => {
    if (!enabled) return undefined;
    refresh().catch(() => {});
    return undefined;
  }, [enabled, queryKey, refresh]);

  useEffect(() => {
    if (!enabled || !realtime) return undefined;

    const channel = supabase
      .channel(buildChannelId('reports-route', queryKey))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => {
        refresh({ silent: true }).catch(() => {});
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, queryKey, realtime, refresh]);

  return {
    reports: page.items,
    page,
    source: page.source || 'supabase',
    loading,
    error,
    refresh,
  };
}

export function useAnalyticsOverview({ enabled = true, realtime = true } = {}) {
  const [analyticsOverview, setAnalyticsOverview] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState('');

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!enabled) return null;

    if (!silent) setLoading(true);
    setError('');

    try {
      const nextOverview = await getAnalyticsOverview();
      setAnalyticsOverview(nextOverview);
      return nextOverview;
    } catch (nextError) {
      setError(nextError.message || 'Не удалось загрузить аналитику.');
      throw nextError;
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    refresh().catch(() => {});
    return undefined;
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled || !realtime) return undefined;

    const channel = supabase
      .channel('analytics-route-overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => {
        refresh({ silent: true }).catch(() => {});
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, realtime, refresh]);

  return {
    analyticsOverview,
    loading,
    error,
    refresh,
  };
}
