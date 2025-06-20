import React from "react";
import { Link } from "react-router-dom";
import iaku from "../assets/iaku.png";
import { Shield, MapPin } from "lucide-react";

const Layout = ({ children }) => {
  return (
    <div className="bg-gradient-to-br from-blue-50 via-white to-purple-50 min-h-screen flex flex-col">
      <nav className="text-black p-4">
        <div className="container mx-auto flex justify-between items-center">
          <Link to="/" className="text-xl font-bold">
            <img
              src={iaku}
              alt="Logo IAKU"
              className="w-16 h-16 object-cover"
            />
          </Link>
          <div className="space-x-10 text-2xl inline-flex items-center">
            <Link to="/" className="hover:text-blue-600">
              Home
            </Link>
            <Link to="/stats" className="hover:text-blue-600">
              Statistik
            </Link>
            <Link to="/form-alumni" className="hover:text-blue-600 ">
              Form Alumni
            </Link>
            <div className="inline-flex items-center">
              <Link
                to="/auth"
                className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 transition-colors duration-200"
              >
                <Shield size={24} />
              </Link>
            </div>
          </div>
        </div>
      </nav>
      <main className="flex-grow container mx-auto px-4 py-6">{children}</main>
      <footer className="text-center text-gray-500 text-sm py-6">
        <div className="mb-2">
          &copy; {new Date().getFullYear()} Database Alumni Kimia Unpad. All
          rights reserved.
        </div>
        <div className="flex justify-center items-start gap-2 mt-2 text-left text-gray-500 text-sm">
          <MapPin size={16} className="mt-0.5" />
          <div>
            Komplek Pondok Mas Indah, Jl. Pondok Mas 1 No 11, Kelurahan Leuwigajah, Kecamatan Cimahi Selatan, Kota Cimahi
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
