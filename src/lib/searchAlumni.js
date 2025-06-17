import { supabase } from './supabase';

export const searchAlumni = async (text, page = 1, limit = 12) => {
    if (!text || text.length < 2) return { data: [], count: 0 };

    const likeQuery = `%${text}%`;
    const offset = (page - 1) * limit;

    let { data, error, count } = await supabase
        .from('alumni_data')
        .select('*', { count: 'exact' })
        .or(
            `
                nama_lengkap.ilike."${likeQuery}",
                perusahaan.ilike."${likeQuery}",
                jabatan.ilike."${likeQuery}",
                bidang_pekerjaan.ilike."${likeQuery}",
                subbidang_pekerjaan.ilike."${likeQuery}",
                domisili_kota.ilike."${likeQuery}",
                domisili_provinsi.ilike."${likeQuery}"
            `.replace(/\s+/g, '')
        )
        .range(offset, offset + limit - 1);

    if (error) {
        console.error('🔥 Supabase exploded:', error);
        return { 
            data: [], page: 0, totalResults: 0,  totalPages: 0};
    }

    return {
        data: data || [],
        page: page,
        totalResults: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
    };
};


let cachedTotal = null;
let cacheExpiry = null;

export const getTotalAlumni = async () => {
  const now = Date.now();

  if (cachedTotal !== null && cacheExpiry > now) {
    return cachedTotal;
  }

  const { count, error } = await supabase
    .from('alumni_data')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('🔥 Error getting total alumni:', error);
    return 0;
  }

  cachedTotal = count;
  cacheExpiry = now + 6 * 60 * 60 * 1000;

  return count;
};