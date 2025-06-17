import { supabase } from "./supabase";

export const searchAlumni = async (text, page = 1, limit = 12) => {
  if (!text || text.length < 2) return { data: [], count: 0 };

  const offset = (page - 1) * limit;

  const { data, error, count } = await supabase
    .from("alumni_data")
    .select("*", { count: "exact" })
    .or(
      "nama_lengkap.ilike.%" +
        text +
        "%," +
        "perusahaan.ilike.%" +
        text +
        "%," +
        "jabatan.ilike.%" +
        text +
        "%," +
        "bidang_pekerjaan.ilike.%" +
        text +
        "%," +
        "subbidang_pekerjaan.ilike.%" +
        text +
        "%," +
        "domisili_kota.ilike.%" +
        text +
        "%," +
        "domisili_provinsi.ilike.%" +
        text +
        "%," +
        "angkatan.ilike.%" +
        text +
        "%"
    )
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("🔥 Supabase exploded:", error);
    return {
      data: [],
      page: 0,
      totalResults: 0,
      totalPages: 0,
    };
  }

  return {
    data: data || [],
    page: page,
    totalResults: count || 0,
    totalPages: Math.ceil((count || 0) / limit),
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
    .from("alumni_data")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("🔥 Error getting total alumni:", error);
    return 0;
  }

  cachedTotal = count;
  cacheExpiry = now + 6 * 60 * 60 * 1000;

  return count;
};

export const addAlumni = async (alumniData) => {
  const { data, error } = await supabase
    .from("alumni_data")
    .insert([alumniData])
    .select();

  if (error) {
    console.error("🔥 Error adding alumni:", error);
    return null;
  }

  return data[0];
}

export const updateAlumni = async (id, alumniData) => {
  const { data, error } = await supabase
    .from("alumni_data")
    .update(alumniData)
    .eq("id", id)
    .select();

  if (error) {
    console.error("🔥 Error updating alumni:", error);
    return null;
  }

  return data[0];
}

export const deleteAlumni = async (id) => {
  const { data, error } = await supabase
    .from("alumni_data")
    .delete()
    .eq("id", id)
    .select();

  if (error) {
    console.error("🔥 Error deleting alumni:", error);
    return null;
  }

  return data[0];
}

export const getAlumniById = async (id) => {
  const { data, error } = await supabase
    .from("alumni_data")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("🔥 Error getting alumni by ID:", error);
    return null;
  }

  return data;
}
