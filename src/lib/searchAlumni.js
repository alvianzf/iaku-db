import { supabase } from './supabase';

export const searchAlumni = async (text) => {
  if (!text || text.length < 2) return [];

  const likeQuery = `%${text}%`;

  let { data, error } = await supabase
    .from('alumni_data')
    .select('*')
    .or(
      `
        nama_lengkap.ilike."${likeQuery}",
        perusahaan.ilike."${likeQuery}",
        jabatan.ilike."${likeQuery}",
        bidang_pekerjaan.ilike."${likeQuery}",
        subbidang_pekerjaan.ilike."${likeQuery}",
        domisili_kota.ilike."${likeQuery}",
        domisili_provinsi.ilike."${likeQuery}",
      `.replace(/\s+/g, '')
    );

  if (error) {
    console.error('🔥 Supabase exploded:', error);
    return [];
  }

  const filtered = data.filter(
    (row) => row.angkatan?.toString().includes(text)
  );

  const combined = [...data, ...filtered].filter(
    (item, index, self) =>
      index === self.findIndex((t) => t.id === item.id)
  );

  return combined;
};

export const getTotalAlumni = async () => {
    let { count, error } = await supabase
        .from('alumni_data')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error('🔥 Error getting total alumni:', error);
        return 0;
    }

    return count;
};

