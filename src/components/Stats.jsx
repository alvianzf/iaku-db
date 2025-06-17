import { useEffect, useState } from "react";
import { getAlumniStats } from "../lib/getAlumniStats";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Title, Tooltip, Legend } from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";

ChartJS.register(ArcElement, Title, Tooltip, Legend);

function Stats() {
  const [stats, setStats] = useState([]);

  useEffect(() => {
    getAlumniStats().then(setStats);
  }, []);

  const bidang = stats.filter((s) => s.category === "bidang_pekerjaan");

  const data = {
    labels: bidang.map((b) => `${b.value} (${b.count})`),
    datasets: [
      {
        data: bidang.map((b) => b.count),
        backgroundColor: [
          "rgba(255, 99, 132, 0.6)",
          "rgba(54, 162, 235, 0.6)",
          "rgba(255, 206, 86, 0.6)",
          "rgba(75, 192, 192, 0.6)",
          "rgba(153, 102, 255, 0.6)",
          "rgba(255, 159, 64, 0.6)",
        ],
      },
    ],
  };

  const options = {
    plugins: {
      legend: {
        position: "right",
        display: true,
      },
      tooltip: {
        enabled: true,
      },
      datalabels: {
        display: false
      },
    },
  };

  return (
    <div>
      <h2>Bidang Pekerjaan</h2>
      <Pie data={data} options={options} plugins={[ChartDataLabels]} />
    </div>
  );
}

export default Stats;
