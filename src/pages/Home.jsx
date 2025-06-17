import { useEffect, useState } from "react";
import { searchAlumni } from "../lib/searchAlumni";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

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

  const onSearch = async (query) => {
    setQuery(query);
    try {
      const queryResult = await searchAlumni(query);

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

        {results.length > 0 && (
            <h3 className="text-gray-600 text-center mb-6">
                Menampilkan <strong>{results.length}</strong> hasil untuk{" "}
                <strong>"{query}"</strong>
                dari total <strong>{totalResults}</strong> alumni
            </h3>
        )}

        {results.length > 0 && totalPages > 1 && (
            <div className="w-full flex justify-center mt-8">
                <div className="flex items-center space-x-2">
                    {page > 1 && (
                        <button
                            onClick={() => setPage(1)}
                            className="p-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-blue-500 hover:text-white"
                        >
                            <ChevronsLeft size={20} />
                        </button>
                    )}
                    {page > 1 && (
                        <button
                            onClick={() => setPage(page - 1)}
                            className="p-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-blue-500 hover:text-white"
                        >
                            <ChevronLeft size={20} />
                        </button>
                    )}
                    
                    {[...Array(Math.min(3, totalPages))].map((_, i) => (
                        <button
                            key={i + 1}
                            onClick={() => setPage(i + 1)}
                            className={`px-4 py-2 rounded-lg ${
                                page === i + 1
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-200 text-gray-700 hover:bg-blue-500 hover:text-white"
                            }`}
                        >
                            {i + 1}
                        </button>
                    ))}
                    
                    {totalPages > 3 && <span className="px-2">...</span>}
                    
                    {totalPages > 3 && (
                        <button
                            onClick={() => setPage(totalPages)}
                            className={`px-4 py-2 rounded-lg ${
                                page === totalPages
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-200 text-gray-700 hover:bg-blue-500 hover:text-white"
                            }`}
                        >
                            {totalPages}
                        </button>
                    )}

                    {page < totalPages && (
                        <button
                            onClick={() => setPage(page + 1)}
                            className="p-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-blue-500 hover:text-white"
                        >
                            <ChevronRight size={20} />
                        </button>
                    )}
                    {page < totalPages && (
                        <button
                            onClick={() => setPage(totalPages)}
                            className="p-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-blue-500 hover:text-white"
                        >
                            <ChevronsRight size={20} />
                        </button>
                    )}
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
