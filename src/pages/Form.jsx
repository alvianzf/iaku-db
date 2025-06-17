import React, { useEffect, useState } from "react";
import {
  getAllAlumni,
  updateAlumni,
  deleteAlumni,
} from "../../lib/searchAlumni";
import { Pencil, Trash2, Save, X, FileDown } from "lucide-react";
import * as XLSX from "xlsx";
import { toast, Toaster } from "react-hot-toast";

const columns = [
  { label: "Nama", key: "nama_lengkap" },
  { label: "Angkatan", key: "angkatan" },
  { label: "Perusahaan", key: "perusahaan" },
  { label: "Jabatan", key: "jabatan" },
  { label: "Bidang", key: "bidang_pekerjaan" },
  { label: "Sub Bidang", key: "subbidang_pekerjaan" },
  { label: "WA", key: "whatsapp" },
  { label: "Provinsi", key: "domisili_provinsi" },
  { label: "Kota", key: "domisili_kota" },
];

const Dashboard = () => {
  const [alumni, setAlumni] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const limit = 100;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const data = await getAllAlumni();
      setAlumni(data);
    } catch {
      toast.error("Failed to fetch data");
    }
  };

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const sorted = [...alumni].sort((a, b) => {
    if (!sortKey) return 0;
    const valA = a[sortKey] || "";
    const valB = b[sortKey] || "";
    return sortAsc
      ? String(valA).localeCompare(String(valB))
      : String(valB).localeCompare(String(valA));
  });

  const filtered = sorted.filter((a) =>
    a.nama_lengkap.toLowerCase().includes(query.toLowerCase())
  );

  const paginated = filtered.slice((page - 1) * limit, page * limit);
  const totalPages = Math.ceil(filtered.length / limit);

  const handleEdit = (alumnus) => {
    setEditingId(alumnus.id);
    setEditData(alumnus);
  };

  const handleSave = async (id) => {
    try {
      await updateAlumni(id, editData);
      toast.success("Updated");
      fetchData();
      setEditingId(null);
    } catch {
      toast.error("Failed to update");
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteAlumni(id);
      toast.success("Deleted");
      fetchData();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleExport = () => {
    const worksheet = XLSX.utils.json_to_sheet(alumni);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Alumni");
    XLSX.writeFile(workbook, "alumni.xlsx");
    toast.success("Exported to Excel");
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Toaster position="top-right" />
      <div className="flex justify-between items-center mb-4">
        <input
          type="text"
          placeholder="Search alumni..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="border px-3 py-2 rounded-md w-64"
        />
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          <FileDown size={18} /> Export Excel
        </button>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full border text-sm bg-white">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="p-2 border text-left cursor-pointer whitespace-nowrap hover:bg-gray-200"
                >
                  {col.label}
                  {sortKey === col.key ? (sortAsc ? " ▲" : " ▼") : ""}
                </th>
              ))}
              <th className="p-2 border text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((a) => (
              <tr key={a.id} className="border hover:bg-gray-50">
                {columns.map(({ key }) => (
                  <td key={key} className="p-2 border">
                    {editingId === a.id ? (
                      <input
                        className="border px-2 py-1 w-full"
                        value={editData[key] || ""}
                        onChange={(e) =>
                          setEditData({ ...editData, [key]: e.target.value })
                        }
                      />
                    ) : (
                      a[key]
                    )}
                  </td>
                ))}
                <td className="flex gap-2 justify-center items-center p-2">
                  {editingId === a.id ? (
                    <>
                      <button
                        onClick={() => handleSave(a.id)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Save size={18} />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-gray-600 hover:text-gray-800"
                      >
                        <X size={18} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleEdit(a)}
                        className="text-yellow-600 hover:text-yellow-800"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(a.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 size={18} />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center mt-4">
        <span className="text-sm text-gray-600">
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            disabled={page === 1}
            className={`px-4 py-1 rounded ${
              page === 1
                ? "bg-gray-200 text-gray-400"
                : "bg-blue-500 text-white hover:bg-blue-600"
            }`}
          >
            Previous
          </button>
          <button
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            disabled={page === totalPages}
            className={`px-4 py-1 rounded ${
              page === totalPages
                ? "bg-gray-200 text-gray-400"
                : "bg-blue-500 text-white hover:bg-blue-600"
            }`}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
