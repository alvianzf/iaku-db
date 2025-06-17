import React from "react";
import iaku from '../../assets/iaku.png';

import {Search, GraduationCap, Users } from "lucide-react";

function SearchHeader({ query, onSearch, isLoading }) {
  return (
   <div className="w-full max-w-6xl mx-auto px-4">
      <div className="text-center mb-10">
        <div className="flex items-center justify-center">
          <div className="">
            <img
              src={iaku}
              alt="Logo IAKU"
              className="w-80 h-80 object-cover"
            />
          </div>
        </div>
        <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3">
          Database Alumni Kimia Unpad
        </h1>
        <p className="text-lg text-gray-600 mb-6">
          Temukan informasi alumni jurusan kimia Unpad dengan mudah dan cepat
        </p>
      </div>

      <div className="relative mb-8">
        <div className="relative">
          <Search className="absolute left-6 top-1/2 transform -translate-y-1/2 text-gray-400 w-6 h-6" />
          <input
            type="text"
            value={query}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Cari berdasarkan nama, bidang pekerjaan, jabatan, atau lokasi..."
            className="w-full pl-16 pr-6 py-5 text-lg border-2 border-gray-200 rounded-2xl focus:border-blue-500 focus:outline-none transition-all duration-200 shadow-sm hover:shadow-md bg-white"
            disabled={isLoading}
          />
          {isLoading && (
            <div className="absolute right-6 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SearchHeader;