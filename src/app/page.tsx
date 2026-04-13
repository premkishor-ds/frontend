"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://ai-based-maxol-rag-search-backend.24livehost.com";

const MAXOL_LOGO =
  "https://a.mktgcdn.com/p/3ceG4Lyz3-nhUn3zNU-Z0maRT_MeJ1CG2EBigA2iTHI/468x142.png";

const NAV = ["IN-STORE", "FORECOURT", "BUSINESS", "ABOUT", "NEWS"] as const;

/** Must match backend `SEARCH_RETRIEVED_MAX` default (5). */
const MAX_SOURCES_SHOWN = 5;

type Suggestion = { label: string; value: string };

type RetrievedItem = {
  content?: string;
  metadata?: unknown;
  id?: number;
  name?: string;
  category?: string;
  price?: number | string;
  stock?: number | string;
  location?: string;
};

type SearchResponse = {
  answer: string;
  suggestions?: string[];
  retrieved: RetrievedItem[];
  intent?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  suggestions?: string[];
  pending?: boolean;
  intent?: string;
  retrieved?: RetrievedItem[];
};

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={className ?? "animate-spin"}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        opacity="0.25"
      />
      <path
        d="M22 12c0-5.523-4.477-10-10-10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AssistantLoadingBubble() {
  return (
    <div className="w-full space-y-4 animate-fade-in" role="status" aria-busy="true">
      <div className="rounded-2xl bg-white border border-neutral-100 p-5 shadow-[0_4px_15px_-3px_rgba(0,0,0,0.03)] space-y-4 overflow-hidden relative">
        <div className="flex items-center gap-2 mb-2">
          <Spinner className="text-[#02568d] w-4 h-4" />
          <span className="text-[10px] font-bold text-[#02568d] uppercase tracking-[0.2em] animate-pulse">Maxol AI is working on your request…</span>
        </div>
        
        {/* Answer Skeleton */}
        <div className="space-y-2">
          <div className="h-4 bg-neutral-100 rounded-full w-[90%] animate-pulse" />
          <div className="h-4 bg-neutral-100 rounded-full w-[75%] animate-pulse delay-75" />
          <div className="h-4 bg-neutral-100 rounded-full w-[85%] animate-pulse delay-150" />
        </div>

        {/* Shine Animation overlay */}
        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer pointer-events-none" />
      </div>

      {/* Sources Skeleton Header */}
      <div className="flex items-center gap-3 px-2 pt-2">
        <div className="h-3 bg-neutral-100 rounded-full w-[120px] animate-pulse" />
      </div>

      {/* Source Cards Skeletons */}
      <div className="space-y-3 opacity-60">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white border border-neutral-50 rounded-xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] space-y-3">
            <div className="flex justify-between items-center">
              <div className="h-4 bg-neutral-100 rounded-lg w-[80px] animate-pulse" />
              <div className="h-2 bg-neutral-100 rounded-full w-[30px] animate-pulse" />
            </div>
            <div className="space-y-1.5">
              <div className="h-3 bg-neutral-50 rounded-full w-full animate-pulse" />
              <div className="h-3 bg-neutral-50 rounded-full w-[60%] animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function makeId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const followUpInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const hasSearched = messages.length > 0;

  const getSourceLabel = (sourceFile?: string) => {
    if (!sourceFile) return "Source";
    const s = sourceFile.toLowerCase();
    if (s.includes("aboutus")) return "About Us";
    if (s.includes("business")) return "Business";
    if (s.includes("faq")) return "FAQ";
    if (s.includes("forecourt")) return "Forecourt";
    if (s.includes("instore")) return "In-Store";
    if (s.includes("location")) return "Locations";
    if (s.includes("product")) return "Products";
    return sourceFile.replace(".json", "");
  };

  const getSourceMeta = (metadata: unknown) => {
    if (!metadata || typeof metadata !== "object") return {};
    const m = metadata as Record<string, unknown>;
    const sourceFile = typeof m["source_file"] === "string" ? (m["source_file"] as string) : undefined;
    const index = typeof m["index"] === "number" ? (m["index"] as number) : undefined;
    return { sourceFile, index };
  };

  useEffect(() => {
    // Fetch dynamic initial suggestions
    fetch(`${BACKEND_URL}/initial-suggestions`)
      .then((res) => res.json())
      .then((data) => setSuggestions(data as Suggestion[]))
      .catch((err) => {
        console.error("Failed to fetch suggestions:", err);
        setSuggestions([
          { label: "Nearest Maxol", value: "Nearest Maxol" },
          { label: "Fuel Prices", value: "Maxol Fuel Prices" },
          { label: "Engine Oil", value: "Maxol Engine Oil" },
          { label: "Business Fuel", value: "Business Fuel" },
        ]);
      });

    if (!bottomRef.current) return;
    bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const runSearch = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: makeId(),
      role: "user",
      text: trimmed,
    };
    const pendingId = makeId();
    const pendingMsg: ChatMessage = {
      id: pendingId,
      role: "assistant",
      text: "Thinking...",
      pending: true,
    };

    setMessages((prev) => [...prev, userMsg, pendingMsg]);
    setLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });

      const data = (await res.json()) as SearchResponse;

      const assistantMsg: ChatMessage = {
        id: makeId(),
        role: "assistant",
        text: data.answer,
        suggestions: data.suggestions,
        intent: data.intent,
        retrieved: data.retrieved,
      };
      setMessages((prev) =>
        prev.map((m) => (m.id === pendingId ? { ...assistantMsg, pending: false } : m))
      );
    } catch (err) {
      console.error("Error fetching data:", err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                id: pendingId,
                role: "assistant",
                text: "Failed to connect to the backend. Is it running?",
                retrieved: [],
                pending: false,
              }
            : m
        )
      );
    } finally {
      setLoading(false);
      setQuery("");
      setTimeout(() => followUpInputRef.current?.focus(), 0);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await runSearch(query);
  };

  const quickLinks = suggestions;

  return (
    <main className="min-h-screen flex flex-col bg-white text-neutral-900 font-sans">
      <header className="sticky top-0 z-50 bg-[#00568f] text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[72px] flex items-center justify-between gap-4">
          <div className="flex items-center shrink-0">
            <Image src={MAXOL_LOGO} alt="Maxol" width={140} height={42} className="h-9 w-auto" priority />
          </div>
          <nav className="hidden lg:flex items-center gap-6 xl:gap-8 text-[11px] xl:text-xs font-semibold tracking-[0.12em] uppercase">
            {NAV.map((t) => (
              <a key={t} href="#" className="text-white/95 hover:text-white transition-colors">
                {t}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <section className="flex-1 px-4 sm:px-6 pt-10 sm:pt-14 pb-12 relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-[#f0f7ff] to-white pointer-events-none -z-10" />

        {!hasSearched ? (
          <div className="max-w-3xl mx-auto text-center animate-fade-in py-10">
            <h1 className="text-3xl sm:text-4xl md:text-[2.75rem] font-bold text-neutral-800 tracking-tight mb-4">
              How can <span className="text-[#00568f]">Maxol</span> help you today?
            </h1>
            <p className="text-neutral-500 mb-10 text-lg">Your intelligent assistant for fuels, stores, and more.</p>

            <form onSubmit={handleSearch} className="max-w-2xl mx-auto" aria-busy={loading}>
              <div className="flex items-stretch rounded-full bg-white pl-6 pr-2 py-2 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-neutral-100 hover:border-neutral-200 focus-within:border-[#00568f]/30 transition-all">
                <input
                  type="text"
                  className="flex-1 min-w-0 bg-transparent border-0 focus:ring-0 focus:outline-none text-lg text-neutral-800 placeholder:text-neutral-400 py-3"
                  placeholder="Search anything about Maxol..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="shrink-0 min-w-[8rem] inline-flex items-center justify-center gap-2 rounded-full bg-[#02568d] hover:bg-[#014a79] text-white text-sm font-bold px-6 transition-all shadow-lg shadow-[#02568d]/20"
                >
                  {loading ? <Spinner className="w-[18px] h-[18px] text-white" /> : <SearchIcon className="w-[18px] h-[18px]" />}
                  <span>{loading ? "Thinking" : "Search"}</span>
                </button>
              </div>
            </form>

            <div className="mt-10 flex flex-wrap justify-center gap-3">
              {quickLinks.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => void runSearch(item.value)}
                  className="rounded-full bg-white hover:bg-neutral-50 text-[#03568d] text-sm font-semibold px-6 py-2.5 border border-neutral-100 shadow-sm transition-all hover:translate-y-[-1px] active:translate-y-0"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto animate-fade-in px-2 sm:px-0">
            {/* Thread Header with Reset */}
            <div className="mb-8 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#00568f] flex items-center justify-center text-white shadow-lg shadow-[#00568f]/20">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-neutral-800 leading-none">Maxol Discovery Thread</h2>
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1">AI-Powered Search • {messages.filter(m => m.role === 'assistant').length} Results</p>
                </div>
              </div>

              <button 
                onClick={() => setMessages([])}
                className="flex items-center gap-2 px-4 py-2 rounded-full border border-neutral-100 bg-white text-neutral-500 hover:text-[#00568f] hover:border-[#00568f]/20 hover:bg-[#00568f]/5 text-xs font-bold transition-all"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                New Search
              </button>
            </div>

            <div className="space-y-12 max-h-[72vh] overflow-y-auto pr-2 no-scrollbar">
              {messages.map((m, mIdx) => (
                <div key={m.id} className="space-y-4">
                  {/* User Message */}
                  {m.role === "user" && (
                    <div className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-[#02568d] to-[#014a79] text-white px-5 py-3.5 text-[15px] font-medium shadow-md">
                        {m.text}
                      </div>
                    </div>
                  )}

                  {/* Assistant Message Block */}
                  {m.role === "assistant" && (
                    <div className="space-y-8 animate-fade-in">
                      {/* Answer Bubble */}
                      <div className="rounded-3xl bg-white border border-neutral-100 p-8 shadow-[0_8px_30px_-10px_rgba(0,0,0,0.05)] relative overflow-hidden group/ans">
                        {m.pending ? (
                          <AssistantLoadingBubble />
                        ) : (
                          <div className="space-y-6">
                            <div className="flex items-center justify-between">
                              {m.intent && (
                                <span className="inline-flex items-center bg-[#00568f]/5 text-[#00568f] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-[#00568f]/10">
                                  {m.intent} Mode
                                </span>
                              )}
                              <button 
                                onClick={() => navigator.clipboard.writeText(m.text)}
                                className="opacity-0 group-hover/ans:opacity-100 p-2 rounded-lg hover:bg-neutral-50 text-neutral-400 hover:text-[#00568f] transition-all"
                                title="Copy response"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                              </button>
                            </div>
                            <div className="text-neutral-800 leading-relaxed text-[17px] font-normal whitespace-pre-wrap">
                              {m.text}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Sources Section (Below Answer) */}
                      {!m.pending && m.retrieved && m.retrieved.length > 0 && (
                        <div className="space-y-4 px-2">
                          <div className="flex items-center gap-3">
                            <div className="h-px bg-neutral-100 flex-1" />
                            <span className="text-[11px] font-black text-neutral-400 uppercase tracking-[0.2em] whitespace-nowrap">Reliable Citations & Sources</span>
                            <div className="h-px bg-neutral-100 flex-1" />
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {m.retrieved.slice(0, MAX_SOURCES_SHOWN).map((item, idx) => {
                              const isProduct = typeof item.name === "string";
                              const { sourceFile, index } = getSourceMeta(item.metadata);
                              const label = isProduct ? item.category ?? "Product" : getSourceLabel(sourceFile);
                              
                              let snippet = isProduct
                                ? [item.name, item.price ? `€${item.price}` : null].filter(Boolean).join(" • ")
                                : (item.content || "");
                              
                              let url = snippet.match(/https?:\/\/[^\s$,]+/gi)?.[0] || "";
                              let cleanText = snippet.replace(/https?:\/\/[^\s$,]+/gi, "").replace(/faq_\d+|ce_[a-zA-Z]+|root|ltr|paragraph|text normal|noopener|search-[a-zA-Z-]+/gi, "").replace(/\b\d{8,}\b/g, "").replace(/\s+/g, " ").trim();
                              if (cleanText.length > 150) cleanText = cleanText.slice(0, 150) + "...";

                              const sMap = (l: string) => {
                                const low = l.toLowerCase();
                                if (low.includes("faq")) return { bg: "bg-emerald-50", text: "text-emerald-700", accent: "border-emerald-200" };
                                if (low.includes("location")) return { bg: "bg-amber-50", text: "text-amber-700", accent: "border-amber-200" };
                                return { bg: "bg-blue-50", text: "text-blue-700", accent: "border-blue-200" };
                              };
                              const s = sMap(label);

                              return (
                                <div key={idx} className="bg-white border border-neutral-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-[#00568f]/30 transition-all group/s relative overflow-hidden animate-slide-up" style={{ animationDelay: `${idx * 0.1}s` }}>
                                  <div className="flex items-center justify-between mb-3">
                                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${s.bg} ${s.text} border ${s.accent}`}>
                                      {label}
                                    </div>
                                    <span className="text-[10px] font-mono text-neutral-300 font-bold">#{(index ?? idx + 1).toString().padStart(2, "0")}</span>
                                  </div>
                                  <p className="text-[13px] text-neutral-600 leading-relaxed mb-4">{cleanText || "Source details extracted."}</p>
                                  {url && (
                                    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[#00568f] text-[10px] font-black uppercase tracking-widest hover:underline">
                                      View Original
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                    </a>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Follow-up Suggestions (only for last message) */}
                      {!m.pending && mIdx === messages.length - 1 && (
                        <div className="animate-slide-up pt-4">
                            <div className="flex items-center gap-2 mb-4 px-2 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-11.7 8.5 8.5 0 0 1 7.6 11.7z"/><polyline points="10 9 14 13 10 17"/></svg>
                              Suggested Exploration
                            </div>
                            <div className="flex flex-wrap gap-2 px-2">
                              {(m.suggestions ?? ["Tell me more about this", "Where can I find it?", "What are the opening hours?"]).map((s) => (
                                <button
                                  key={s}
                                  onClick={() => void runSearch(s)}
                                  className="px-5 py-2.5 rounded-full border border-neutral-100 bg-white text-neutral-600 text-[14px] font-semibold hover:text-[#00568f] hover:border-[#00568f]/30 transition-all flex items-center gap-2 group shadow-sm hover:shadow-md"
                                >
                                  {s}
                                  <svg className="opacity-0 group-hover:opacity-100 transition-all translate-x-[-4px] group-hover:translate-x-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                                </button>
                              ))}
                            </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <div ref={bottomRef} className="h-4" />
            </div>

            {/* Sticky Search Input at Bottom */}
            <div className="mt-6 sticky bottom-0 bg-gradient-to-t from-white via-white/95 to-transparent pb-8 pt-12 px-2 -mx-2">
              <form onSubmit={handleSearch} className="max-w-3xl mx-auto">
                <div className="flex items-stretch rounded-full bg-white pl-7 pr-2 py-2.5 shadow-[0_15px_50px_-5px_rgb(0,0,0,0.12)] border border-neutral-100 focus-within:border-[#00568f]/40 transition-all">
                  <input
                    ref={followUpInputRef}
                    type="text"
                    className="flex-1 min-w-0 bg-transparent border-0 focus:ring-0 focus:outline-none text-[16px] text-neutral-800 placeholder:text-neutral-400 py-3"
                    placeholder="Ask a follow-up or search again..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    disabled={loading}
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="shrink-0 min-w-[8.5rem] inline-flex items-center justify-center gap-2 rounded-full bg-[#02568d] hover:bg-[#014a79] text-white text-[15px] font-bold px-6 transition-all disabled:opacity-50 shadow-lg shadow-[#02568d]/10"
                  >
                    {loading ? <Spinner className="w-[18px] h-[18px]" /> : <SearchIcon className="w-[18px] h-[18px]" />}
                    <span>Search</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </section>

      <footer className="bg-[#00568f] text-white mt-auto border-t border-[#d4c767] border-t-4">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center sm:items-start gap-2">
            <Image src={MAXOL_LOGO} alt="Maxol" width={100} height={30} className="h-7 w-auto" />
            <p className="text-[10px] text-white/60 font-semibold tracking-wider uppercase">© {new Date().getFullYear()} THE MAXOL GROUP</p>
          </div>
          <div className="flex gap-8 text-[11px] font-bold uppercase tracking-widest text-white/80">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1); }
        .animate-slide-up { animation: slide-up 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite linear;
        }
      `}</style>
    </main>
  );
}
