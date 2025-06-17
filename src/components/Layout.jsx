import React from "react";
import { Link } from "react-router-dom";
import iaku from '../assets/iaku.png';

const Layout = ({ children }) => {
  return (
    <div className="bg-gradient-to-br from-blue-50 via-white to-purple-50 min-h-screen flex flex-col">
      <nav className="text-black p-4">
        <div className="container mx-auto flex justify-between items-center">
          <Link to="/" className="text-xl font-bold">
            <img src={iaku} alt="Logo IAKU" className="w-16 h-16 object-cover" />
          </Link>
          <div className="space-x-6 text-2xl">
            <Link to="/" className="hover:text-blue-600">
              Home
            </Link>
            <Link to="/stats" className="hover:text-blue-600">
              Statistik
            </Link>
            <Link to="/form-alumni" className="hover:text-blue-600">
              Form Alumni
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-grow container mx-auto px-4 py-6">{children}</main>

      <footer className="text-center text-gray-500 text-sm py-6">
        &copy; {new Date().getFullYear()} Database Alumni Kimia Unpad. All rights reserved.
      </footer>
    </div>
  );
};

export default Layout;
