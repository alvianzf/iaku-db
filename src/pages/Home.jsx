import { useEffect, useState } from "react";
import { searchAlumni } from "../lib/searchAlumni";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import ResultCard from "../components/database/ResultCard";
import SearchHeader from "../components/Search/SearchHeader";

function App() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    document.title = "IAKU | Alumni Database";
  }, []);

  const onSearch = async (query, page = 1) => {
    setQuery(query);
    try {
      const queryResult = await searchAlumni(query, page);

      setResults(queryResult.data);
      setPage(queryResult.page);
      setTotalResults(queryResult.totalResults);
      setTotalPages(Math.ceil(queryResult.totalPages));
      setLoading(true); // Moved to start

      if (queryResult.data.length === 0) {
        console.warn("No results found for query:", query);
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto py-12">
        <SearchHeader query={query} onSearch={onSearch} isLoading={loading} />
      </div>

      {results.length > 0 && totalPages > 1 && (
        <div className="w-full flex justify-center mt-8">
          <div className="flex flex-wrap justify-center gap-2 max-w-xl">
            <button
              onClick={() => onSearch(query, 1)}
              disabled={page === 1}
              className={`p-2 rounded-lg ${
                page === 1
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-gray-200 text-gray-700 hover:bg-blue-500 hover:text-white"
              } transition-colors duration-200`}
            >
              <ChevronsLeft size={20} />
            </button>

            <button
              onClick={() => onSearch(query, page - 1)}
              disabled={page === 1}
              className={`p-2 rounded-lg ${
                page === 1
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-gray-200 text-gray-700 hover:bg-blue-500 hover:text-white"
              } transition-colors duration-200`}
            >
              <ChevronLeft size={20} />
            </button>

            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => onSearch(query, i + 1)}
                className={`px-4 py-2 rounded-lg ${
                  page === i + 1
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-blue-500 hover:text-white"
                } transition-colors duration-200`}
              >
                {i + 1}
              </button>
            ))}

            <button
              onClick={() => onSearch(query, page + 1)}
              disabled={page === totalPages}
              className={`p-2 rounded-lg ${
                page === totalPages
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-gray-200 text-gray-700 hover:bg-blue-500 hover:text-white"
              } transition-colors duration-200`}
            >
              <ChevronRight size={20} />
            </button>

            <button
              onClick={() => onSearch(query, totalPages)}
              disabled={page === totalPages}
              className={`p-2 rounded-lg ${
                page === totalPages
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-gray-200 text-gray-700 hover:bg-blue-500 hover:text-white"
              } transition-colors duration-200`}
            >
              <ChevronsRight size={20} />
            </button>
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-column flex-wrap px-4 gap-4 justify-center">
        {results.length > 0 ? (
          results.map((result, index) => (
            <ResultCard
              key={index}
              searchQuery={query}
              alumni={result}
              page={page}
              query={query}
              isLoading={loading}
            />
          ))
        ) : (
          <div>
            <p className="text-gray-500 text-center">
              {query.length === 0
                ? "Silahkan mulai mencari Alumni"
                : "Tidak ada alumni yang ditemukan."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
