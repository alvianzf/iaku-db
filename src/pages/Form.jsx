import React, { useState } from "react";
import { addAlumni } from "../lib/searchAlumni";
import {
  User,
  Building2,
  Briefcase,
  Layers,
  Phone,
  MapPin,
  SendHorizonal,
  GraduationCap,
  FormInput,
} from "lucide-react";

const fields = [
  { label: "Nama Lengkap", name: "nama_lengkap", icon: <User /> },
  {
    label: "Angkatan",
    name: "angkatan",
    type: "number",
    icon: <GraduationCap />,
  },
  { label: "Perusahaan", name: "perusahaan", icon: <Building2 /> },
  { label: "Jabatan", name: "jabatan", icon: <Briefcase /> },
  { label: "Bidang Pekerjaan", name: "bidang_pekerjaan", icon: <Layers /> },
  {
    label: "Sub Bidang Pekerjaan",
    name: "subbidang_pekerjaan",
    icon: <Layers />,
  },
  { label: "WhatsApp", name: "whatsapp", type: "tel", icon: <Phone /> },
  { label: "Provinsi", name: "domisili_provinsi", icon: <MapPin /> },
  { label: "Kota", name: "domisili_kota", icon: <MapPin /> },
];

const Form = () => {
  const [formData, setFormData] = useState(
    Object.fromEntries(fields.map((f) => [f.name, ""]))
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await addAlumni(formData);
      setFormData(Object.fromEntries(fields.map((f) => [f.name, ""])));
    } catch (error) {
      console.error("Error adding alumni:", error);
    }
  };

  return (
    <>
    <div className="flex justify-center mb-4">
          <FormInput className="w-24 h-24 text-blue-600" />
        </div>
      <h1 className="text-center text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-16">
        Registrasi Alumni Kimia Unpad
      </h1>
      <form
        onSubmit={handleSubmit}
        className="max-w-lg mx-auto mt-8 space-y-4 p-4 bg-white rounded-lg shadow-md"
      >
        {fields.map(({ label, name, type = "text", icon }) => (
          <div key={name} className="flex items-center gap-2">
            {icon && <span className="text-gray-500">{icon}</span>}
            <input
              type={type}
              name={name}
              value={formData[name]}
              onChange={handleChange}
              placeholder={label}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            />
          </div>
        ))}

        <button
          type="submit"
          className="w-full flex justify-center items-center gap-2 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition"
        >
          <SendHorizonal size={18} /> Submit
        </button>
      </form>
    </>
  );
};

export default Form;
