"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8001";

const MAXOL_LOGO =
  "https://a.mktgcdn.com/p/3ceG4Lyz3-nhUn3zNU-Z0maRT_MeJ1CG2EBigA2iTHI/468x142.png";

const NAV = ["IN-STORE", "FORECOURT", "BUSINESS", "ABOUT", "NEWS"] as const;

/** Must match backend `SEARCH_RETRIEVED_MAX` default (5). */
const MAX_SOURCES_SHOWN = 5;

const QUICK_LINKS = [
  { label: "Nearest Maxol", value: "Nearest Maxol" },
  { label: "Fuel Prices", value: "Maxol Fuel Prices" },
  { label: "Car Wash", value: "Car Wash" },
  { label: "Business Fuel", value: "Business Fuel" },
] as const;

type RetrievedItem = {
  content?: string;
  metadata?: unknown;
  // When intent routes to SQL, we return rows from `products`.
  id?: number;
  name?: string;
  category?: string;
  price?: number | string;
  stock?: number | string;
  location?: string;
};

type SearchResponse = {
  answer: string;
  retrieved: RetrievedItem[];
  intent?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
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

function makeId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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
    const sourceFile =
      typeof m["source_file"] === "string" ? (m["source_file"] as string) : undefined;
    const index =
      typeof m["index"] === "number" ? (m["index"] as number) : undefined;
    return { sourceFile, index };
  };

  useEffect(() => {
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: trimmed }),
      });

      const data = (await res.json()) as SearchResponse;

      const assistantMsg: ChatMessage = {
        id: makeId(),
        role: "assistant",
        text: data.answer,
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

  const quickLinks = useMemo(() => QUICK_LINKS, []);

  return (
    <main className="min-h-screen flex flex-col bg-white text-neutral-900">
      {/* Header — deep blue bar, white nav */}
      <header className="sticky top-0 z-50 bg-[#00568f] text-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[72px] flex items-center justify-between gap-4">
          <div className="flex items-center shrink-0">
            <Image
              src={MAXOL_LOGO}
              alt="Maxol"
              width={140}
              height={42}
              className="h-9 w-auto"
              priority
            />
          </div>
          <nav className="hidden lg:flex items-center gap-6 xl:gap-8 text-[11px] xl:text-xs font-semibold tracking-[0.12em] uppercase">
            {NAV.map((t) => (
              <a
                key={t}
                href="#"
                className="text-white/95 hover:text-white transition-colors whitespace-nowrap"
              >
                {t}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <section className="flex-1 px-4 sm:px-6 pt-10 sm:pt-14 pb-12">
        {!hasSearched ? (
          // Landing hero (before first search)
          <div className="max-w-3xl mx-auto text-center animate-fade-in">
            <h1 className="text-2xl sm:text-3xl md:text-[2rem] font-bold text-neutral-800 tracking-tight mb-0">
              <span className="inline-flex flex-wrap items-baseline justify-center gap-x-1.5 gap-y-1">
                <span>How can</span>
                <span className="relative inline-flex items-center justify-center px-1 min-w-[4.5ch]">
                  <span
                    className="pointer-events-none select-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.22] w-[4.25rem] h-[4.25rem] sm:w-[4.75rem] sm:h-[4.75rem] rounded-full overflow-hidden"
                    aria-hidden
                  >
                    <Image
                      src={MAXOL_LOGO}
                      alt=""
                      width={120}
                      height={120}
                      className="w-full h-full object-cover object-left scale-[1.35]"
                      priority
                    />
                  </span>
                  <span className="relative z-10">Maxol</span>
                </span>
                <span>help you today?</span>
              </span>
            </h1>

            <form
              onSubmit={handleSearch}
              className="mt-8 sm:mt-10 max-w-2xl mx-auto"
            >
              <div className="flex items-stretch rounded-full bg-white pl-4 sm:pl-5 pr-1.5 py-1.5 shadow-[0_4px_24px_rgba(12,61,108,0.12)] border border-neutral-200/90">
                <input
                  type="text"
                  className="flex-1 min-w-0 bg-transparent border-0 focus:ring-0 focus:outline-none text-base text-neutral-800 placeholder:text-neutral-400 py-3"
                  placeholder="Search anything about Maxol..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="shrink-0 inline-flex items-center justify-center gap-2 rounded-full bg-[#02568d] hover:bg-[#014a79] text-white text-sm font-semibold px-5 sm:px-6 py-3 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  <SearchIcon className="w-[18px] h-[18px]" />
                  {loading ? "..." : "Search"}
                </button>
              </div>
            </form>

            <div className="mt-8 flex flex-wrap justify-center gap-2 sm:gap-3">
              {quickLinks.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => void runSearch(item.value)}
                  className="rounded-full bg-[#f4f6f7] hover:bg-[#eaf1f6] text-[#03568d] text-xs sm:text-sm font-semibold px-4 sm:px-5 py-2 sm:py-2.5 border border-[#c5d4e8]/80 transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          // Chat UI (after first search)
          <div className="max-w-3xl mx-auto">
            <div className="mt-4 mb-6">
              <div className="text-center text-[#00568f] font-bold text-lg">
                Chat
              </div>
            </div>

            <div className="max-h-[62vh] overflow-y-auto pr-1 no-scrollbar">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex my-3 ${
                    m.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {m.role === "user" ? (
                    <div className="max-w-[80%] rounded-2xl bg-[#eaf1f6] text-[#02568d] border border-[#c5d4e8]/70 px-4 py-3 text-sm sm:text-base font-medium whitespace-pre-wrap">
                      {m.text}
                    </div>
                  ) : (
                    <div className="max-w-[80%] rounded-2xl bg-white border border-neutral-200/90 px-4 py-3 shadow-sm">
                      {m.pending ? (
                        <div className="flex items-center gap-2 text-neutral-600">
                          <Spinner className="text-[#02568d]" />
                          <span className="text-sm sm:text-base font-medium">
                            Thinking...
                          </span>
                        </div>
                      ) : (
                        <>
                          {m.intent && (
                            <div className="mb-2">
                              <span className="inline-block bg-[#00568f]/10 text-[#00568f] px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest border border-[#00568f]/20">
                                {m.intent} mode
                              </span>
                            </div>
                          )}
                          <div className="text-neutral-800 leading-relaxed whitespace-pre-wrap text-sm sm:text-base font-medium">
                            {m.text}
                          </div>

                          {m.retrieved && m.retrieved.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-neutral-200">
                              <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">
                                Sources
                              </div>
                              <div className="grid gap-2">
                                {m.retrieved
                                  .slice(0, MAX_SOURCES_SHOWN)
                                  .map((item, idx) => {
                                  const isProductRow =
                                    typeof (item as RetrievedItem).name ===
                                      "string" ||
                                    typeof (item as RetrievedItem).category ===
                                      "string";

                                  const { sourceFile, index } = getSourceMeta(
                                    item.metadata
                                  );
                                  const label = isProductRow
                                    ? (item.category ?? "Product")
                                    : getSourceLabel(sourceFile);

                                  const snippet = isProductRow
                                    ? [
                                        item.name ?? "Untitled product",
                                        item.price !== undefined
                                          ? `Price: ${item.price}`
                                          : null,
                                        item.stock !== undefined
                                          ? `Stock: ${item.stock}`
                                          : null,
                                        item.location
                                          ? `Location: ${item.location}`
                                          : null,
                                      ]
                                        .filter(Boolean)
                                        .join(" • ")
                                    : typeof item.content === "string"
                                      ? item.content.slice(0, 220)
                                      : "";

                                  const productId =
                                    isProductRow && typeof item.id === "number"
                                      ? item.id
                                      : undefined;
                                  return (
                                    <div
                                      key={idx}
                                      className="bg-[#f8fbff] p-3 rounded-xl border border-neutral-200 text-xs"
                                    >
                                      <div className="flex items-center justify-between gap-3 mb-2">
                                        <span className="inline-flex items-center bg-[#00568f]/10 text-[#00568f] px-2 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest border border-[#00568f]/20 whitespace-nowrap">
                                          {label}
                                        </span>
                                        {typeof productId === "number" && (
                                          <span className="text-[10px] text-neutral-400 font-mono">
                                            #{productId}
                                          </span>
                                        )}
                                        {typeof productId !== "number" &&
                                          typeof index === "number" && (
                                          <span className="text-[10px] text-neutral-400 font-mono">
                                            #{index}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-neutral-600 font-mono whitespace-pre-wrap">
                                        {snippet.slice(0, 220)}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="mt-6">
              <form onSubmit={handleSearch}>
                <div className="flex items-stretch rounded-full bg-white pl-4 sm:pl-5 pr-1.5 py-1.5 shadow-[0_4px_24px_rgba(12,61,108,0.12)] border border-neutral-200/90">
                  <input
                    ref={followUpInputRef}
                    type="text"
                    className="flex-1 min-w-0 bg-transparent border-0 focus:ring-0 focus:outline-none text-base text-neutral-800 placeholder:text-neutral-400 py-3"
                    placeholder="Ask a follow-up question..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Follow-up search"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="shrink-0 inline-flex items-center justify-center gap-2 rounded-full bg-[#02568d] hover:bg-[#014a79] text-white text-sm font-semibold px-5 sm:px-6 py-3 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    <SearchIcon className="w-[18px] h-[18px]" />
                    {loading ? "..." : "Search"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </section>

      {/* Gold divider + footer — deep blue */}
      <div className="h-1 bg-[#d4c767] w-full shrink-0" aria-hidden />
      <footer className="bg-[#00568f] text-white shrink-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] sm:text-[11px] font-semibold tracking-[0.1em] uppercase">
          <div className="flex items-center">
            <Image
              src={MAXOL_LOGO}
              alt="Maxol"
              width={100}
              height={30}
              className="h-7 w-auto opacity-95"
            />
          </div>
          <p className="text-center text-white/95 order-3 sm:order-none">
            © {new Date().getFullYear()} THE MAXOL GROUP. ALL RIGHTS RESERVED.
          </p>
          <div className="flex items-center gap-4 sm:gap-6">
            {["Privacy", "Terms", "Contact"].map((t) => (
              <a
                key={t}
                href="#"
                className="text-white/90 hover:text-white transition-colors"
              >
                {t}
              </a>
            ))}
          </div>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
        .animate-slide-up {
          animation: slide-up 0.45s ease-out;
        }

        /* Hide scrollbars while preserving scroll behavior */
        .no-scrollbar {
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE/Edge legacy */
        }
        .no-scrollbar::-webkit-scrollbar {
          width: 0;
          height: 0;
          display: none; /* Chrome/Safari */
        }
      `}</style>
    </main>
  );
}
