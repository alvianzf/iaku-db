import { supabase } from './supabase';

export const getAlumniStats = async () => {
  const { data, error } = await supabase
    .from('alumni_stats')
    .select('*')
    .order('count', { ascending: false });

  if (error) {
    console.error('Stats fetch failed:', error);
    return [];
  }

  return data;
};
