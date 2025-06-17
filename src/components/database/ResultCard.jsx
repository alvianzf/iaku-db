import React from "react";
import { GraduationCap, MessageCircle } from "lucide-react";
import { maskName, maskWhatsapp } from "../../utils/mask";

const ResultCard = ({ query, alumni = {} }) => {
  const {
    nama_lengkap,
    perusahaan,
    angkatan,
    bidang_pekerjaan,
    subbidang_pekerjaan,
    jabatan,
    domisili_kota,
    domisili_provinsi,
    whatsapp,
  } = alumni;

  const obscuredName = maskName(nama_lengkap || "Name Not Available");
  const obscuredWhatsapp = maskWhatsapp(whatsapp || "");

  return (
    <div className="w-full min-w-[308px] md:w-1/4 bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center space-x-4 mb-4">
        <div className="bg-gradient-to-br from-blue-100 to-purple-100 rounded-full p-3">
          <GraduationCap className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h3 className="text-xl font-semibold text-gray-900">
            {obscuredName}
          </h3>
          <p className="text-gray-600">Angkatan {angkatan || "N/A"}</p>
        </div>
      </div>


      <div className="space-y-3">
        <div>
          <div>
            <p className="text-sm font-medium text-gray-500">Perusahaan</p>
            <p className="text-gray-700">{perusahaan || "N/A"}</p>
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Pekerjaan</p>
          <p className="text-gray-700">
            {bidang_pekerjaan || "N/A"} - {subbidang_pekerjaan || "N/A"}
          </p>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-500">Jabatan</p>
          <p className="text-gray-700">{jabatan || "N/A"}</p>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-500">Domisili</p>
          <p className="text-gray-700">
            {domisili_kota || "N/A"}, {domisili_provinsi || "N/A"}
          </p>
        </div>

        {whatsapp && (
          <div>
            <p className="text-sm font-medium text-gray-500">Whatsapp</p>
            <p className="text-gray-700">{obscuredWhatsapp}</p>
          </div>
        )}

        <div>
          <button
            onClick={() =>
              window.open(
                `https://wa.me/6281312771595?text=${encodeURIComponent(
                  `Halo, saya membutuhkan data alumni "${query}`
                )}`,
                "_blank"
              )
            }
            className="text-black-600 hover:underline button px-4 py-2 rounded-lg bg-green-50 hover:bg-green-100 transition-colors duration-200"
            disabled={!whatsapp}
          >
            <MessageCircle className="inline-block mr-2 w-4 h-4" />
            Hubungi untuk Info
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResultCard;
