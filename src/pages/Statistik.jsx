import { use, useEffect, useState } from "react";
import { getAlumniStats } from "../lib/getAlumniStats";
import { getTotalAlumni } from "../lib/searchAlumni";
import { BriefcaseBusiness, GitGraph, MapPin } from "lucide-react";

function Statistik() {
  const [stats, setStats] = useState([]);
  const [isLoading, setLoading] = useState(true);
  const [totalAlumni, setTotalAlumni] = useState(0);
  const [provinces, setProvinces] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      const data = await getAlumniStats();
      setStats(data);

      const provinces = data.filter(stat => stat.category === "domisili_kota");
      setProvinces(provinces.length);
      
      setLoading(false);
    };
    fetchStats();
  }, []);

  useEffect(() => {
    const fetchTotalAlumni = async () => {
      const total = await getTotalAlumni();
      document.title = `Statistik Alumni (${total})`;
      setTotalAlumni(total);
    };
    fetchTotalAlumni();
  }, []);

  const renderStatGrid = (title, icon, category) => {
    const grouped = stats.reduce((acc, stat) => {
      if (stat.category === category) {
        if (!acc[stat.value]) acc[stat.value] = { ...stat, count: 0 };
        acc[stat.value].count += stat.count;
      }
      return acc;
    }, {});

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-24">
        <h3 className="text-4xl font-bold col-span-full bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-8">
          {icon}
          {title}
        </h3>
        {Object.entries(grouped).map(([value, stat]) => (
          <div key={value} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-center mb-4">
              <div className="text-center">
                <h3 className="text-xl font-semibold text-gray-500">{value}</h3>
                <p className="text-7xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {stat.count}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto py-12 px-4 w-full max-w-6xl">
        <div className="flex justify-center mb-4">
          <GitGraph className="w-24 h-24 text-blue-600" />
        </div>
        {/* <h1 className="text-center text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-12">
          Statistik Alumni Kimia Unpad
        </h1> */}

        <div className="text-center mb-24 text-3xl">
          <span className="text-7xl font-bold bg-gradient-to-r mx-5 from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {totalAlumni}
          </span> alumni yang tersebar di <span className="mx-5 text-7xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {provinces}
          </span> Kota di seluruh dunia.
        </div>

        {renderStatGrid(
          "Lokasi Alumni",
          <MapPin className="w-12 h-12 text-blue-600 inline-block mr-2" />,
          "domisili_provinsi"
        )}
        {renderStatGrid(
          "Bidang Pekerjaan",
          <BriefcaseBusiness className="w-12 h-12 text-blue-600 inline-block mr-2" />,
          "bidang_pekerjaan"
        )}
      </div>
    </div>
  );
}

export default Statistik;
