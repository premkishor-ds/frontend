"use client";

import { useState } from "react";

export default function Home() {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setResponse(null);

    try {
      const res = await fetch("http://localhost:8000/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });

      const data = await res.json();
      setResponse(data);
    } catch (err) {
      console.error("Error fetching data:", err);
      setResponse({ answer: "Failed to connect to the backend. Is it running?" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0f172a] text-white flex flex-col items-center p-8 font-sans">
      {/* Header Section */}
      <div className="max-w-4xl w-full text-center mb-12 animate-fade-in">
        <h1 className="text-5xl font-extrabold mb-4 bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
          Maxol AI Discovery Engine
        </h1>
        <p className="text-gray-400 text-lg">
          Ask anything about our products, inventory, or descriptions. I understand context!
        </p>
      </div>

      {/* Search Section */}
      <div className="max-w-3xl w-full bg-[#1e293b]/50 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-gray-700 mb-8">
        <form onSubmit={handleSearch} className="flex gap-4">
          <input
            type="text"
            className="flex-1 bg-[#0f172a] rounded-xl px-6 py-4 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-gray-200 text-lg placeholder-gray-500"
            placeholder="e.g., 'What is the price of coffee machine?' or 'Tell me about motor oil'"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-emerald-500 hover:bg-emerald-600 px-8 py-4 rounded-xl font-bold text-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </form>
      </div>

      {/* Response Section */}
      {response && (
        <div className="max-w-3xl w-full animate-slide-up">
          <div className="bg-[#1e293b] rounded-2xl p-8 border border-gray-700 shadow-xl">
             {/* Intent Badge */}
             {response.intent && (
                <div className="mb-4">
                    <span className="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full text-xs font-mono uppercase tracking-widest border border-blue-500/20">
                        {response.intent} SEARCH MODE
                    </span>
                </div>
             )}

            <h2 className="text-2xl font-semibold mb-4 text-emerald-400">AI Response</h2>
            <div className="prose prose-invert max-w-none text-gray-300 leading-relaxed text-lg whitespace-pre-wrap">
              {response.answer}
            </div>

            {/* Debugging Info (Can be hidden in production) */}
            {response.retrieved && response.retrieved.length > 0 && (
              <div className="mt-8 pt-8 border-t border-gray-700">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Sources Found</h3>
                <div className="grid gap-3">
                  {response.retrieved.map((item: any, idx: number) => (
                    <div key={idx} className="bg-[#0f172a] p-3 rounded-lg border border-gray-800 text-xs text-gray-400 font-mono">
                      {item.content || JSON.stringify(item)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer Branding */}
      <footer className="mt-auto pt-12 pb-4 text-gray-600 text-sm">
        Powered by OpenAI RAG + pgvector
      </footer>

      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.8s ease-out; }
        .animate-slide-up { animation: slide-up 0.5s ease-out; }
      `}</style>
    </main>
  );
}
