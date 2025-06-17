import { supabase } from './supabase';

const CACHE_KEY = 'alumni_stats_cache';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const getAlumniStats = async () => {
  const cachedData = getCachedStats();
  if (cachedData) {
    return cachedData;
  }

  const { data, error } = await supabase
    .from('alumni_stats')
    .select('*')
    .order('count', { ascending: false });

  if (error) {
    console.error('Stats fetch failed:', error);
    return [];
  }

  // Store in cache
  setCacheStats(data);
  return data;
};

const getCachedStats = () => {
  const cached = sessionStorage.getItem(CACHE_KEY);
  if (!cached) return null;

  const { data, timestamp } = JSON.parse(cached);
  const isExpired = Date.now() - timestamp > ONE_DAY_MS;

  if (isExpired) {
    sessionStorage.removeItem(CACHE_KEY);
    return null;
  }

  return data;
};

const setCacheStats = (data) => {
  const cacheData = {
    data,
    timestamp: Date.now()
  };
  sessionStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
};
