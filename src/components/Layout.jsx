import React from "react";
import { Link } from "react-router-dom";

const Layout = ({ children }) => {
  return (
    <div className="bg-gradient-to-br from-blue-50 via-white to-purple-50 min-h-screen flex flex-col">
      <nav className="bg-gradient-to-br from-blue-50 via-white to-purple-50 text-black p-4">
        <div className="container mx-auto flex justify-between items-center">
          <Link to="/" className="text-xl font-bold">
            IAKU Database
          </Link>
          <div className="space-x-4">
            <Link to="/" className="hover:text-gray-200">
              Home
            </Link>
            <Link to="/stats" className="hover:text-gray-200">
              Statistik
            </Link>
          </div>
        </div>
      </nav>

      <main className="">{children}</main>

      <footer className="bg-gradient-to-br from-blue-50 via-white to-purple-50 mt-4 text-center text-gray-500 text-sm mb-6">
        &copy; {new Date().getFullYear()} Database Alumni Kimia Unpad. All
        rights reserved.
      </footer>
    </div>
  );
};

export default Layout;
