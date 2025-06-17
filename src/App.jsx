import { useState } from "react";
import { searchAlumni } from "./lib/searchAlumni";

import ResultCard from "./components/database/ResultCard";
import SearchHeader from "./components/Search/SearchHeader";

function App() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

  const onSearch = async (query) => {
    setQuery(query);
    try {
      const queryResult = await searchAlumni(query);
      setResults(queryResult);
      if (queryResult.length === 0) {
        console.warn("No results found for query:", query);
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto py-12">
        <SearchHeader query={query} onSearch={onSearch} isLoading={loading} />
      </div>
      {results.length > 0 && (
        <h3 className="text-gray-600 text-center mb-6">
        Menampilkan <strong>{results.length}</strong> hasil untuk <strong>"{query}"</strong>
        </h3>
      )}
      <div className="mt-8 flex flex-column flex-wrap px-4 gap-4 justify-center">
      
        {results.length > 0 ? (
          results.map((result, index) => (
            <ResultCard
              key={index}
              searchQuery={query}
              alumni={result}
              isLoading={loading}
            />
          ))
        ) : (
          <div>
            <p className="text-gray-500 text-center">
              {loading ? "Alumni tidak ditemukan, sedang memuat..." : "Tidak ada alumni yang ditemukan."}
            </p>
          </div>
        )}
      </div>
      <footer className="mt-12 text-center text-gray-500 text-sm mb-12">
        &copy; {new Date().getFullYear()} Database Alumni Kimia Unpad. All rights reserved.
      </footer>
    </div>
  );
}

export default App;
