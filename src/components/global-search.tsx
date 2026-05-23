"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, Building2, User, Handshake, FolderKanban, FileText } from "lucide-react";
import { globalSearch, type SearchResult } from "@/actions/search";
import { useRouter } from "next/navigation";

const typeIcons: Record<SearchResult["type"], typeof Building2> = {
  company: Building2,
  contact: User,
  deal: Handshake,
  project: FolderKanban,
  invoice: FileText,
};

const typeLabels: Record<SearchResult["type"], string> = {
  company: "Company",
  contact: "Contact",
  deal: "Deal",
  project: "Project",
  invoice: "Invoice",
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>(undefined);
  const router = useRouter();

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const r = await globalSearch(q);
      setResults(r);
      setActive(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
        setResults([]);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const navigate = (href: string) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      navigate(results[active].href);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:border-ring hover:text-foreground transition-colors"
        title="Search (⌘K)"
      >
        <Search className="w-4 h-4" />
      </button>
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={() => { setOpen(false); setQuery(""); setResults([]); }}
      />
      <div className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-lg z-50">
        <div className="mx-4 bg-background border border-border rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center px-4 h-12 border-b border-border">
            <Search className="w-4 h-4 text-muted-foreground mr-3 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search companies, contacts, deals..."
              className="flex-1 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground/50 outline-none"
            />
            {query && (
              <button onClick={() => { setQuery(""); setResults([]); }} className="text-muted-foreground hover:text-foreground ml-2">
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => { setOpen(false); setQuery(""); setResults([]); }}
              className="ml-3 text-[11px] text-muted-foreground border border-border rounded px-1.5 py-0.5"
            >
              ESC
            </button>
          </div>

          {(results.length > 0 || loading || (query.length >= 2 && !loading && results.length === 0)) && (
            <div className="max-h-[50vh] overflow-y-auto py-2">
              {loading && (
                <p className="text-[12px] text-muted-foreground px-4 py-3">Searching...</p>
              )}
              {!loading && query.length >= 2 && results.length === 0 && (
                <p className="text-[12px] text-muted-foreground px-4 py-3">No results found.</p>
              )}
              {results.map((result, i) => {
                const Icon = typeIcons[result.type];
                return (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => navigate(result.href)}
                    onMouseEnter={() => setActive(i)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      i === active ? "bg-muted/40" : "hover:bg-muted/20"
                    }`}
                  >
                    <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-foreground truncate">{result.title}</p>
                      {result.subtitle && (
                        <p className="text-[11px] text-muted-foreground truncate">{result.subtitle}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground/70 uppercase shrink-0">{typeLabels[result.type]}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
