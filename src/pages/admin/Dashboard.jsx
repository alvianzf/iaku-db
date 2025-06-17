import React, { useEffect, useState } from "react";
import {
  getAllAlumni,
  updateAlumni,
  deleteAlumni,
} from "../../lib/searchAlumni";
import { Pencil, Trash2, Save, X, FileDown, LogOut, Plus } from "lucide-react";
import * as XLSX from "xlsx";
import { toast, Toaster } from "react-hot-toast";
import { supabase } from "../../lib/supabase";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const [alumni, setAlumni] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState("asc");

  const [showSignupModal, setShowSignupModal] = useState(false);
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  const limit = 100;

  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!data.session) {
        navigate("/auth");
      }
    };
    checkSession();
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const data = await getAllAlumni();
    data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    setAlumni(data);
  };

  const handleEdit = (alumnus) => {
    setEditingId(alumnus.id);
    setEditData(alumnus);
  };

  const handleSave = async (id) => {
    try {
      await updateAlumni(id, editData);
      toast.success("Data updated");
      fetchData();
      setEditingId(null);
    } catch (err) {
      toast.error("Update failed");
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteAlumni(id);
      toast.success("Data deleted");
      fetchData();
    } catch (err) {
      toast.error("Delete failed");
    }
  };

  const handleExport = () => {
    const worksheet = XLSX.utils.json_to_sheet(alumni);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Alumni");
    XLSX.writeFile(workbook, "alumni.xlsx");
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };


  let filtered = alumni.filter((a) =>
    a.nama_lengkap.toLowerCase().includes(query.toLowerCase())
  );

  if (sortField) {
    filtered = filtered.sort((a, b) => {
      const valA = a[sortField] || "";
      const valB = b[sortField] || "";
      return sortOrder === "asc"
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    });
  }

  const paginated = filtered.slice((page - 1) * limit, page * limit);
  const totalPages = Math.ceil(filtered.length / limit);

  const headers = [
    { key: "nama_lengkap", label: "Nama" },
    { key: "angkatan", label: "Angkatan" },
    { key: "perusahaan", label: "Perusahaan" },
    { key: "jabatan", label: "Jabatan" },
    { key: "bidang_pekerjaan", label: "Bidang" },
    { key: "subbidang_pekerjaan", label: "Sub Bidang" },
    { key: "whatsapp", label: "WA" },
    { key: "domisili_provinsi", label: "Provinsi" },
    { key: "domisili_kota", label: "Kota" },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Toaster />
      <div className="flex justify-between items-center mb-4">
        <input
          type="text"
          placeholder="Search alumni..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="border px-3 py-2 rounded-md w-64"
        />
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            <FileDown size={18} /> Export Excel
          </button>
          <button
            onClick={() => setShowSignupModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Plus size={18} /> Create User
          </button>

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate("/auth");
            }}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            <LogOut size={18} /> Logout
          </button>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full border text-sm">
          <thead className="bg-gray-500 text-left">
            <tr>
              {headers.map((h) => (
                <th
                  key={h.key}
                  onClick={() => handleSort(h.key)}
                  className="cursor-pointer p-2 border bg-white"
                >
                  {h.label}
                  {sortField === h.key
                    ? sortOrder === "asc"
                      ? " \u25B2"
                      : " \u25BC"
                    : ""}
                </th>
              ))}
              <th className="p-2 border bg-white">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((a) => (
              <tr key={a.id} className="border">
                {headers.map(({ key }) => (
                  <td key={key} className="p-2 border bg-white">
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
                <td className="flex gap-2 justify-center items-center p-2 bg-white">
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

      {showSignupModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-sm space-y-4 relative">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700"
              onClick={() => setShowSignupModal(false)}
            >
              <X size={22} />
            </button>
            <h2 className="text-xl font-bold text-center mb-2">
              Create Admin Account
            </h2>
            <input
              type="email"
              placeholder="Email"
              value={signupEmail}
              onChange={(e) => setSignupEmail(e.target.value)}
              className="w-full border border-gray-300 px-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={signupPassword}
              onChange={(e) => setSignupPassword(e.target.value)}
              className="w-full border border-gray-300 px-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <button
              onClick={async () => {
                if (!signupEmail || !signupPassword) {
                  toast.error("Both fields required");
                  return;
                }
                const { error } = await supabase.auth.signUp({
                  email: signupEmail,
                  password: signupPassword,
                });
                if (error) toast.error(error.message);
                else {
                  toast.success("User registered successfully");
                  setSignupEmail("");
                  setSignupPassword("");
                  setShowSignupModal(false);
                }
              }}
              className="w-full py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"
            >
              Register
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
