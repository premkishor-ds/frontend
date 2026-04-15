"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

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
    <div className="w-full space-y-5 animate-pulse" role="status" aria-busy="true">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#02568d] animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-2 h-2 rounded-full bg-[#02568d] animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-2 h-2 rounded-full bg-[#02568d] animate-bounce"></div>
        </div>
        <span className="text-[10px] font-black text-[#02568d] uppercase tracking-[0.25em]">Maxol AI is generating...</span>
      </div>
      
      <div className="space-y-3">
        <div className="h-4 bg-neutral-100 rounded-full w-[95%]" />
        <div className="h-4 bg-neutral-100 rounded-full w-4/5" />
        <div className="h-4 bg-neutral-100 rounded-full w-[85%]" />
      </div>

      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer pointer-events-none" />
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

  // Typing Placeholder Logic
  const placeholderSuggestions = useMemo(() => [
    "Search across 240+ Maxol stations...",
    "Find Gear or Transmission Oil...",
    "Compare 15W/40 Engine Oils...",
    "Ask about Business Fuel Cards...",
    "Search the Maxol FAQ knowledge base...",
    "Where is the nearest car wash?"
  ], []);
  const [placeholder, setPlaceholder] = useState("");
  const [pIdx, setPIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentFull = placeholderSuggestions[pIdx];
    const typingSpeed = isDeleting ? 40 : 80;
    const pauseTime = isDeleting ? 0 : 2000;

    const timeout = setTimeout(() => {
      if (!isDeleting && charIdx < currentFull.length) {
        setPlaceholder(currentFull.substring(0, charIdx + 1));
        setCharIdx(charIdx + 1);
      } else if (isDeleting && charIdx > 0) {
        setPlaceholder(currentFull.substring(0, charIdx - 1));
        setCharIdx(charIdx - 1);
      } else if (!isDeleting && charIdx === currentFull.length) {
        setTimeout(() => setIsDeleting(true), pauseTime);
      } else {
        setIsDeleting(false);
        setPIdx((pIdx + 1) % placeholderSuggestions.length);
        setCharIdx(0);
      }
    }, typingSpeed);

    return () => clearTimeout(timeout);
  }, [charIdx, isDeleting, pIdx, placeholderSuggestions]);

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
          <button 
            onClick={() => window.location.reload()}
            className="flex items-center shrink-0 hover:opacity-80 transition-opacity"
          >
            <Image src={MAXOL_LOGO} alt="Maxol" width={140} height={42} className="h-9 w-auto" priority />
          </button>
          <nav className="hidden lg:flex items-center gap-6 xl:gap-8 text-[11px] xl:text-xs font-semibold tracking-[0.12em] uppercase">
            {NAV.map((t) => (
              <a key={t} href="#" className="text-white/95 hover:text-white transition-colors">
                {t}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <section className="flex-1 w-full px-4 sm:px-6 pt-10 sm:pt-14 pb-12 relative flex flex-col items-center">
        {/* Premium Background Decoration */}
        <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-[#02568d]/5 blur-[120px] rounded-[100%] pointer-events-none -z-10" />
        <div className="absolute top-[10%] right-[10%] w-[300px] h-[300px] bg-[#02568d]/10 blur-[80px] rounded-full pointer-events-none -z-10 animate-pulse" />
        <div className="absolute bottom-[20%] left-[5%] w-[400px] h-[400px] bg-[#02568d]/5 blur-[100px] rounded-full pointer-events-none -z-10" />

        {!hasSearched ? (
          <div className="w-full max-w-4xl mx-auto py-12 lg:py-24 flex flex-col items-center text-center animate-fade-in relative z-10">
            <h1 className="text-3xl sm:text-4xl md:text-[3.75rem] font-black text-neutral-900 leading-[1.1] tracking-tight mb-6 animate-slide-up">
              How can Maxol help you today?
            </h1>
            
            <p className="text-lg text-neutral-500 max-w-xl mb-12 leading-relaxed font-semibold animate-slide-up [animation-delay:0.1s] opacity-80">
              Your intelligent assistant for fuels, stores, and more.
            </p>

            <form onSubmit={handleSearch} className="w-full max-w-2xl mx-auto relative group mb-16" aria-busy={loading}>
              <div className="absolute inset-0 bg-[#02568d]/10 blur-3xl opacity-0 group-focus-within:opacity-100 transition-all duration-700 rounded-full" />
              <div className="relative flex items-stretch rounded-full bg-white/80 backdrop-blur-xl pl-8 pr-2.5 py-2.5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.12)] border border-neutral-100 hover:border-neutral-200 focus-within:border-[#02568d] focus-within:ring-4 focus-within:ring-[#02568d]/5 transition-all duration-300">
                <input
                  type="text"
                  placeholder={placeholder}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1 bg-transparent border-none focus:outline-none text-neutral-800 text-lg placeholder-neutral-300 font-medium py-3"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="shrink-0 min-w-[9rem] inline-flex items-center justify-center gap-2 rounded-full bg-[#02568d] hover:bg-[#014a79] text-white text-sm font-bold px-6 transition-all shadow-lg shadow-[#02568d]/20 disabled:opacity-70"
                >
                  {loading ? (
                    <>
                      <Spinner className="w-[18px] h-[18px] text-white" />
                      <span>Thinking...</span>
                    </>
                  ) : (
                    <>
                      <SearchIcon className="w-[18px] h-[18px]" />
                      <span>Search</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-10 flex flex-wrap justify-center gap-3 animate-slide-up [animation-delay:0.2s]">
              {quickLinks.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => void runSearch(item.value)}
                  className="rounded-full bg-white hover:bg-neutral-50 text-[#03568d] text-sm font-bold px-7 py-3 border border-neutral-100 shadow-sm transition-all hover:translate-y-[-1px] active:translate-y-0"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="w-full max-w-6xl mx-auto animate-fade-in px-6 sm:px-10 pb-36">
            {/* Thread Header with Reset */}
            <div className="mb-12 flex items-center justify-between gap-4 border-b border-neutral-100 pb-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#00568f] flex items-center justify-center text-white shadow-lg shadow-[#00568f]/20">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-neutral-800 leading-none">Maxol Search Assistant</h2>
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1">Trusted Knowledge Source</p>
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

            <div className="space-y-12">
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
                      <div className="rounded-2xl sm:rounded-3xl bg-white border border-neutral-100 p-6 sm:p-10 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.06)] relative overflow-hidden group/ans">
                        {m.pending ? (
                          <AssistantLoadingBubble />
                        ) : (
                          <div className="relative">
                            <button 
                              onClick={() => navigator.clipboard.writeText(m.text)}
                              className="absolute -top-4 -right-4 opacity-0 group-hover/ans:opacity-100 p-2.5 rounded-xl bg-neutral-50/80 backdrop-blur-sm text-neutral-400 hover:text-[#00568f] hover:bg-neutral-100 transition-all shadow-sm border border-neutral-100/50"
                              title="Copy response"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                            </button>
                            <div className="text-neutral-800 leading-relaxed text-[17px] font-normal prose prose-neutral max-w-none">
                              <ReactMarkdown>{m.text}</ReactMarkdown>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Sources Section (Below Answer) */}
                      {!m.pending && m.retrieved && m.retrieved.length > 0 && (
                        <div className="space-y-4 px-2">
                          <div className="flex items-center gap-3">
                            <div className="h-px bg-neutral-100 flex-1" />
                            <span className="text-[11px] font-black text-neutral-400 uppercase tracking-[0.2em] whitespace-nowrap">Verified Sources</span>
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
                              Suggested Questions
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

            {/* Fixed Search Input at Bottom */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl pt-6 pb-8 px-4 sm:px-10 z-40 border-t border-neutral-100/50">
              <form onSubmit={handleSearch} className="max-w-5xl mx-auto">
                <div className="flex items-stretch rounded-full bg-white pl-10 pr-3 py-4 shadow-[0_20px_70px_-5px_rgb(0,0,0,0.18)] border border-neutral-100 focus-within:border-[#02568d] transition-all">
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
        /* Markdown Bullet Styling */
        .prose ul {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin-top: 0.75rem;
          margin-bottom: 0.75rem;
        }
        .prose li {
          margin-bottom: 0.5rem;
          display: list-item;
        }
        .prose strong {
          color: #00568f;
          font-weight: 800;
        }
      `}</style>
    </main>
  );
}
