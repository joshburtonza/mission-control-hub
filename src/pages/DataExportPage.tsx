import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Download, Database, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const TABLES = [
  "agent_commands", "agent_memory", "agent_metrics", "agent_registry", "agents",
  "approvals", "audit_log", "calendar_events", "client_activity", "client_activity_alerts",
  "clients", "debt_entries", "email_queue", "finance_config", "finance_transactions",
  "group_chat_history", "income_entries", "interaction_log", "kill_switch", "leads",
  "mc_users", "notifications", "outreach_log", "research_sources", "sophia_csm_config",
  "subscriptions", "system_config", "task_queue", "tasks", "user_models",
  "vanta_leads", "whatsapp_messages", "work_sessions",
] as const;

type Status = "idle" | "loading" | "done" | "error";

function toCsv(rows: Record<string, any>[]): string {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const header = keys.map(k => `"${k}"`).join(",");
  const body = rows.map(r =>
    keys.map(k => {
      const v = r[k];
      if (v === null || v === undefined) return "";
      const s = typeof v === "object" ? JSON.stringify(v) : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    }).join(",")
  ).join("\n");
  return header + "\n" + body;
}

function downloadFile(name: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DataExportPage() {
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);

  const exportTable = async (table: string) => {
    setStatuses(s => ({ ...s, [table]: "loading" }));
    try {
      const { data, error } = await (supabase as any).from(table).select("*").limit(10000);
      if (error) throw error;
      const rows = data || [];
      setCounts(c => ({ ...c, [table]: rows.length }));
      if (rows.length > 0) {
        downloadFile(table, toCsv(rows));
      }
      setStatuses(s => ({ ...s, [table]: "done" }));
    } catch {
      setStatuses(s => ({ ...s, [table]: "error" }));
    }
  };

  const exportAll = async () => {
    setBulkRunning(true);
    setBulkProgress(0);
    for (let i = 0; i < TABLES.length; i++) {
      await exportTable(TABLES[i]);
      setBulkProgress(i + 1);
    }
    setBulkRunning(false);
  };

  const doneCount = Object.values(statuses).filter(s => s === "done").length;

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--s-bg)" }}>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold" style={{ color: "var(--tc-85)" }}>Data Export</h1>
            <p className="text-xs" style={{ color: "var(--tc-35)" }}>
              Download all {TABLES.length} tables as CSV · {doneCount} exported
            </p>
          </div>
          <button
            onClick={exportAll}
            disabled={bulkRunning}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
            style={{ background: "var(--accent-blue)", color: "#fff" }}
          >
            {bulkRunning ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {bulkProgress}/{TABLES.length}
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                Export All Tables
              </>
            )}
          </button>
        </div>

        {/* Progress bar */}
        {bulkRunning && (
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--s-hover)" }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${(bulkProgress / TABLES.length) * 100}%`, background: "var(--accent-blue)" }}
            />
          </div>
        )}

        {/* Table grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TABLES.map(table => {
            const status = statuses[table] || "idle";
            const count = counts[table];
            return (
              <button
                key={table}
                onClick={() => exportTable(table)}
                disabled={status === "loading"}
                className="flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all"
                style={{
                  background: "var(--s-card)",
                  border: "1px solid var(--s-pill-b)",
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Database className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--tc-25)" }} />
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium truncate" style={{ color: "var(--tc-70)" }}>{table}</p>
                    {count !== undefined && (
                      <p className="text-[10px]" style={{ color: "var(--tc-30)" }}>{count} rows</p>
                    )}
                  </div>
                </div>
                <div className="shrink-0">
                  {status === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: "var(--tc-25)" }} />}
                  {status === "done" && <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "#4ade80" }} />}
                  {status === "error" && <AlertCircle className="h-3.5 w-3.5" style={{ color: "#f87171" }} />}
                  {status === "idle" && <Download className="h-3.5 w-3.5" style={{ color: "var(--tc-20)" }} />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
