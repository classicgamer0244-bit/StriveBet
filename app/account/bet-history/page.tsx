"use client";

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { X, LayoutGrid, Calendar, Trash2, ChevronDown, CheckCircle2, Trophy, XCircle, MinusCircle, CircleHelp } from "lucide-react";
import { OpenBetsList, type OpenBetsFilter } from "@/components/account/open-bets-list";
import { SettledBetsList } from "@/components/account/settled-bets-list";
import { useOpenBets } from "@/hooks/use-open-bets";
import { useAuth } from "@/hooks/use-auth";
import { PullToRefresh } from "@/components/common/pull-to-refresh";
import { cn } from "@/lib/utils";

function FilterDropdown<T extends string>({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: T;
  options: { value: T; icon?: React.ReactNode }[];
  onSelect: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1 rounded-full border border-[#3E404D] bg-transparent px-3 py-1 text-[12px] font-medium text-white"
      >
        {label}: {value} <ChevronDown className="size-3 text-[#999999]" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-lg border border-[#2C2E3B] bg-[#1A1C23] py-1 shadow-xl">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onSelect(opt.value); setOpen(false); }}
              className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#2C2E3B]"
            >
              <span className="flex items-center gap-2">{opt.icon}{opt.value}</span>
              {value === opt.value && <CheckCircle2 className="size-4 text-[#00E676]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BetHistoryPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "settled" ? "settled" : "open";
  const [activeTab, setActiveTab] = useState<"open" | "settled">(initialTab);
  const { openBets, refresh: refreshBets } = useOpenBets();
  const [openFilter, setOpenFilter] = useState<OpenBetsFilter>("all");
  const { player, balanceVisible } = useAuth();
  const balance = player?.balance ?? 0;
  const fmtBalance = balanceVisible ? balance.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "••••••";

  const [lastTabParam, setLastTabParam] = useState(searchParams.get("tab"));
  const tabParam = searchParams.get("tab");
  if (tabParam !== lastTabParam) {
    setLastTabParam(tabParam);
    setActiveTab(tabParam === "settled" ? "settled" : "open");
  }

  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [resultFilterOpen, setResultFilterOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<"All" | "Settled" | "Unsettled">("All");
  const [selectedResult, setSelectedResult] = useState<"All" | "Won" | "Lost" | "Void">("All");

  return (
    <PullToRefresh onRefresh={async () => { refreshBets(); }}>
      <div className="flex min-h-[calc(100vh-64px)] flex-col bg-background text-foreground relative">
        {/* Top Header (Mobile Only) */}
        <div className="flex items-center justify-end bg-navy px-4 py-3 lg:hidden">
          <div className="flex items-center gap-2">
            <div className="relative size-6 overflow-hidden rounded-full ring-2 ring-white/30">
              <img
                src="https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=96&h=96&fit=crop&crop=face"
                alt="Profile"
                className="h-full w-full object-cover"
              />
            </div>
            <span className="text-[13px] font-extrabold text-white">{balanceVisible ? "GHS " : ""}{fmtBalance}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-[#2A2B36]">
          <button
            onClick={() => setActiveTab("open")}
            className={cn(
              "flex-1 py-3.5 text-center text-[13px] font-bold border-b-2",
              activeTab === "open" ? "bg-card text-foreground border-transparent rounded-t-sm" : "text-[#999999] border-transparent"
            )}
          >
            My Bets ({openBets.length})
          </button>
          <button
            onClick={() => setActiveTab("settled")}
            className={cn(
              "flex-1 py-3.5 text-center text-[13px] font-bold border-b-2",
              activeTab === "settled" ? "bg-card text-foreground border-transparent rounded-t-sm" : "text-[#999999] border-transparent"
            )}
          >
            Bet History
          </button>
        </div>

        {/* Open Bets filters/banner */}
        {activeTab === "open" && (
          <>
            <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              <div className="flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                {(
                  [
                    { value: "all", label: "All" },
                    { value: "cashout", label: "Cashout Available" },
                    { value: "live", label: "Live Games" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setOpenFilter(opt.value)}
                    className={cn(
                      "shrink-0 rounded-[2px] px-3 py-1.5 text-[11px] font-bold",
                      openFilter === opt.value ? "bg-[#333333] text-white" : "bg-background font-semibold text-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <button className="ml-3 shrink-0 text-[#999999]">
                <LayoutGrid className="size-4" />
              </button>
            </div>

            <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1.5">
                <p className="text-[13px] text-foreground">
                  Set a rule to <strong className="font-bold text-foreground">Auto Cashout</strong> your bet.
                </p>
                <CircleHelp className="size-3.5 text-[#999999] fill-[#999999] text-white" />
              </div>
              <button className="text-[#999999]">
                <X className="size-4" />
              </button>
            </div>
          </>
        )}

        {/* Settled Bets filters */}
        {activeTab === "settled" && (
          <div className="flex items-center justify-between border-b border-border bg-[#121418] px-3 py-2 text-white">
            <div className="flex gap-2">
              <button
                onClick={() => setStatusFilterOpen(true)}
                className="flex items-center gap-1 rounded-full border border-[#3E404D] bg-transparent px-3 py-1 text-[12px] font-medium text-white lg:hidden"
              >
                Bet Status: {selectedStatus} <ChevronDown className="size-3 text-[#999999]" />
              </button>
              <button
                onClick={() => setResultFilterOpen(true)}
                className="flex items-center gap-1 rounded-full border border-[#3E404D] bg-transparent px-3 py-1 text-[12px] font-medium text-white lg:hidden"
              >
                Bet Result{selectedResult !== "All" && `: ${selectedResult}`} <ChevronDown className="size-3 text-[#999999]" />
              </button>
              <div className="hidden lg:flex lg:gap-2">
                <FilterDropdown
                  label="Bet Status"
                  value={selectedStatus}
                  onSelect={setSelectedStatus}
                  options={[{ value: "All" as const }, { value: "Settled" as const }, { value: "Unsettled" as const }]}
                />
                <FilterDropdown
                  label="Bet Result"
                  value={selectedResult}
                  onSelect={setSelectedResult}
                  options={[
                    { value: "All" as const },
                    { value: "Won" as const, icon: <Trophy className="size-4 text-[#FFC107]" /> },
                    { value: "Lost" as const, icon: <XCircle className="size-4 text-[#E53935]" /> },
                    { value: "Void" as const, icon: <MinusCircle className="size-4 text-[#999999]" /> },
                  ]}
                />
              </div>
            </div>
            <div className="flex gap-3 text-[#999999]">
              <button><Calendar className="size-4 hover:text-white" /></button>
              <button><Trash2 className="size-4 hover:text-white" /></button>
            </div>
          </div>
        )}

        {/* Lists */}
        <div className="flex-1 bg-muted/50">
          {activeTab === "open" ? (
            <OpenBetsList filter={openFilter} />
          ) : (
            <SettledBetsList key={activeTab} statusFilter={selectedStatus} resultFilter={selectedResult} />
          )}
        </div>

        {/* Mobile Bottom Sheet: Bet Status */}
        {statusFilterOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 lg:hidden" onClick={() => setStatusFilterOpen(false)}>
            <div className="w-full rounded-t-2xl bg-[#1A1C23] p-4 text-white animate-in slide-in-from-bottom duration-200" onClick={(e) => e.stopPropagation()}>
              <div className="flex flex-col divide-y divide-[#2C2E3B]">
                {(["Settled", "Unsettled", "All"] as const).map((s) => (
                  <button key={s} onClick={() => { setSelectedStatus(s); setStatusFilterOpen(false); }} className="flex items-center justify-between py-4 text-[15px] font-semibold text-left">
                    <span>{s}</span>
                    {selectedStatus === s && <CheckCircle2 className="size-5 text-[#00E676]" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Mobile Bottom Sheet: Bet Result */}
        {resultFilterOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 lg:hidden" onClick={() => setResultFilterOpen(false)}>
            <div className="w-full rounded-t-2xl bg-[#1A1C23] p-4 text-white animate-in slide-in-from-bottom duration-200" onClick={(e) => e.stopPropagation()}>
              <div className="flex flex-col divide-y divide-[#2C2E3B] mb-4">
                {([
                  { value: "Won", icon: <Trophy className="size-5 text-[#FFC107]" /> },
                  { value: "Lost", icon: <XCircle className="size-5 text-[#E53935]" /> },
                  { value: "Void", icon: <MinusCircle className="size-5 text-[#999999]" /> },
                ] as const).map(({ value, icon }) => (
                  <button key={value} onClick={() => { setSelectedResult(value); setResultFilterOpen(false); }} className="flex items-center gap-3 py-4 text-[15px] font-semibold text-left">
                    {icon}<span>{value}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => { setSelectedResult("All"); setResultFilterOpen(false); }} className="w-full py-3 text-center text-[14px] font-semibold text-[#8E92A4] hover:text-white">
                Clear
              </button>
            </div>
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
