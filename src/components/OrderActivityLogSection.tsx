"use client";

import { useState, useMemo } from "react";
import type { Order, OrderActivityLog, FieldChange } from "@/types";
import { formatLogDateTime, formatRelativeTime, extractOrderLogs } from "@/lib/orderLogs";
import { formatDate } from "@/lib/utils";

interface Props {
  order: Order;
  additionalLogs?: OrderActivityLog[];
}

export default function OrderActivityLogSection({ order, additionalLogs = [] }: Props) {
  const [filter, setFilter] = useState<"all" | "update" | "status" | "create">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Merge embedded logs, additional logs, and fallback if empty
  const allLogs = useMemo(() => {
    const embedded = extractOrderLogs(order.stitching_measurement_number);
    const combined = [...additionalLogs, ...embedded];

    // Deduplicate by ID
    const seen = new Set<string>();
    const unique: OrderActivityLog[] = [];
    for (const log of combined) {
      if (!seen.has(log.id)) {
        seen.add(log.id);
        unique.push(log);
      }
    }

    // Also inject item progress history if available and not already logged
    if (order.order_items) {
      for (const itm of order.order_items) {
        if (itm.progress_history) {
          for (const ph of itm.progress_history) {
            const histId = `stage-hist-${ph.id}`;
            if (!seen.has(histId)) {
              seen.add(histId);
              unique.push({
                id: histId,
                order_id: order.id,
                action: "stage_change",
                title: `${itm.item_type.toUpperCase()} - ${ph.stage.toUpperCase()}: ${ph.new_status.toUpperCase()}`,
                title_gu: `${ph.stage} સ્ટેજ: ${ph.new_status}`,
                description: `Production stage updated from ${ph.old_status || "none"} to ${ph.new_status}`,
                changes: [{
                  field: `${itm.item_type.toUpperCase()} ${ph.stage} Stage`,
                  label_gu: `${ph.stage} સ્ટેજ`,
                  old_value: ph.old_status || "—",
                  new_value: ph.new_status,
                }],
                created_at: ph.changed_at,
                user_name: ph.profile?.full_name || "Staff",
              });
            }
          }
        }
      }
    }

    // If order has no logs at all (legacy orders created prior to tracking), synthesize creation log
    if (unique.length === 0) {
      unique.push({
        id: `legacy-create-${order.id}`,
        order_id: order.id,
        action: "create",
        title: "Order Created",
        title_gu: "ઓર્ડર બનાવ્યો",
        description: `Order ${order.order_number} originally registered in system`,
        changes: [
          { field: "Order Number", label_gu: "ઓર્ડર નંબર", old_value: null, new_value: order.order_number },
          { field: "Customer", label_gu: "ગ્રાહક", old_value: null, new_value: order.party?.name || "Customer" },
          { field: "Phone", label_gu: "મોબાઇલ નંબર", old_value: null, new_value: order.phone || "—" },
          { field: "Order Date", label_gu: "ઓર્ડર તારીખ", old_value: null, new_value: formatDate(order.order_date) },
          { field: "Delivery Date", label_gu: "ડિલિવરી તારીખ", old_value: null, new_value: order.delivery_date ? formatDate(order.delivery_date) : "Not Set" },
        ],
        created_at: order.created_at,
        user_name: "Staff",
      });

      if (order.updated_at && order.updated_at !== order.created_at) {
        unique.push({
          id: `legacy-update-${order.id}`,
          order_id: order.id,
          action: "update",
          title: "Order Record Updated",
          title_gu: "ઓર્ડર વિગતો સુધારી",
          description: "Order record modified in system",
          created_at: order.updated_at,
          user_name: "Staff",
        });
      }
    }

    // Sort newest first
    return unique.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [order, additionalLogs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return allLogs.filter((log) => {
      // Type filter
      if (filter === "update" && log.action !== "update") return false;
      if (filter === "status" && log.action !== "status_change" && log.action !== "stage_change") return false;
      if (filter === "create" && log.action !== "create") return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = log.title?.toLowerCase().includes(q) || log.title_gu?.toLowerCase().includes(q);
        const matchesDesc = log.description?.toLowerCase().includes(q);
        const matchesUser = log.user_name?.toLowerCase().includes(q);
        const matchesChanges = log.changes?.some(
          (c) =>
            c.field.toLowerCase().includes(q) ||
            c.label_gu?.toLowerCase().includes(q) ||
            c.old_value?.toLowerCase().includes(q) ||
            c.new_value?.toLowerCase().includes(q)
        );
        return matchesTitle || matchesDesc || matchesUser || matchesChanges;
      }
      return true;
    });
  }, [allLogs, filter, searchQuery]);

  return (
    <div
      className="rounded-xl border bg-card p-4 sm:p-6 shadow-sm space-y-5"
      style={{ borderColor: "hsl(var(--border))" }}
    >
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4" style={{ borderColor: "hsl(var(--border))" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-primary/10 text-primary">
            📜
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base sm:text-lg" style={{ fontFamily: "Cormorant Garamond, serif" }}>
                Order Activity & Audit Trail
              </h3>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                {allLogs.length} Event{allLogs.length !== 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              ઓર્ડર પ્રવૃત્તિ અને ફેરફાર ઇતિહાસ (તારીખ અને સમય સાથે તમામ વિગત)
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              filter === "all"
                ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                : "border hover:bg-muted text-muted-foreground"
            }`}
            style={filter !== "all" ? { borderColor: "hsl(var(--border))" } : {}}
          >
            All ({allLogs.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("update")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              filter === "update"
                ? "bg-blue-600 text-white shadow-sm font-semibold"
                : "border hover:bg-muted text-muted-foreground"
            }`}
            style={filter !== "update" ? { borderColor: "hsl(var(--border))" } : {}}
          >
            ✏️ Field Updates
          </button>
          <button
            type="button"
            onClick={() => setFilter("status")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              filter === "status"
                ? "bg-amber-600 text-white shadow-sm font-semibold"
                : "border hover:bg-muted text-muted-foreground"
            }`}
            style={filter !== "status" ? { borderColor: "hsl(var(--border))" } : {}}
          >
            🔄 Status & Stages
          </button>
          <button
            type="button"
            onClick={() => setFilter("create")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              filter === "create"
                ? "bg-emerald-600 text-white shadow-sm font-semibold"
                : "border hover:bg-muted text-muted-foreground"
            }`}
            style={filter !== "create" ? { borderColor: "hsl(var(--border))" } : {}}
          >
            ✨ Created
          </button>
        </div>
      </div>

      {/* Search Input within logs if more than 3 logs */}
      {allLogs.length > 3 && (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">🔍</span>
          <input
            type="text"
            placeholder="Search change history (e.g. Chati, Chest, Phone, Status, Raymond)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-4 py-1.5 text-xs rounded-lg border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            style={{ borderColor: "hsl(var(--border))" }}
          />
        </div>
      )}

      {/* Timeline List */}
      <div className="space-y-4 relative before:absolute before:inset-0 before:left-3 sm:before:left-4 before:w-0.5 before:bg-border/60">
        {filteredLogs.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground pl-6">
            No events match the selected filter.
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isCreate = log.action === "create";
            const isUpdate = log.action === "update";
            const isStatus = log.action === "status_change";
            const isStage = log.action === "stage_change";
            const isDelete = log.action === "delete";

            // Visual styling based on action
            let badgeBg = "bg-muted text-foreground border-border";
            let iconText = "📋";
            if (isCreate) {
              badgeBg = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
              iconText = "✨";
            } else if (isUpdate) {
              badgeBg = "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30";
              iconText = "✏️";
            } else if (isStatus) {
              badgeBg = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30";
              iconText = "🔄";
            } else if (isStage) {
              badgeBg = "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30";
              iconText = "🧵";
            } else if (isDelete) {
              badgeBg = "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30";
              iconText = "🗑️";
            }

            return (
              <div key={log.id} className="relative pl-8 sm:pl-10 space-y-2 group">
                {/* Timeline node icon */}
                <div
                  className={`absolute left-1 sm:left-2 top-1.5 -translate-x-1/2 w-6 h-6 rounded-full border flex items-center justify-center text-xs shadow-sm bg-card transition-transform group-hover:scale-110 ${badgeBg}`}
                >
                  {iconText}
                </div>

                {/* Event Card */}
                <div
                  className="rounded-xl border bg-card/60 p-3.5 sm:p-4 space-y-3 transition-colors hover:bg-card/90"
                  style={{ borderColor: "hsl(var(--border))" }}
                >
                  {/* Event Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${badgeBg}`}>
                        {log.title}
                      </span>
                      {log.title_gu && (
                        <span className="text-xs text-muted-foreground font-medium">
                          ({log.title_gu})
                        </span>
                      )}
                      {log.user_name && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          · 👤 <span className="font-medium text-foreground">{log.user_name}</span>
                        </span>
                      )}
                    </div>

                    {/* Date and Time Badges */}
                    <div className="flex items-center gap-2 text-xs flex-shrink-0">
                      <span className="text-muted-foreground hidden sm:inline">
                        {formatRelativeTime(log.created_at)} ·
                      </span>
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted text-foreground border" style={{ borderColor: "hsl(var(--border))" }}>
                        🕒 {formatLogDateTime(log.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Description if present */}
                  {log.description && (
                    <p className="text-xs text-muted-foreground">
                      {log.description}
                    </p>
                  )}

                  {/* Changes List / Table */}
                  {log.changes && log.changes.length > 0 && (
                    <div className="mt-2 space-y-2">
                      <div
                        className="rounded-lg border overflow-hidden bg-background/50 divide-y"
                        style={{ borderColor: "hsl(var(--border))" }}
                      >
                        {log.changes.map((change, idx) => (
                          <div
                            key={idx}
                            className="p-2 sm:px-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-muted/40 transition-colors"
                          >
                            {/* Field Name & Gujarati Label */}
                            <div className="flex items-center gap-1.5 sm:w-1/3 flex-shrink-0">
                              <span className="font-semibold text-foreground">
                                {change.field}
                              </span>
                              {change.label_gu && (
                                <span className="text-[11px] text-muted-foreground">
                                  ({change.label_gu})
                                </span>
                              )}
                            </div>

                            {/* Old Value -> New Value */}
                            <div className="flex items-center gap-2 flex-1 sm:justify-end overflow-hidden flex-wrap">
                              {change.old_value !== null ? (
                                <span className="line-through text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded font-mono text-[11px] max-w-[200px] truncate">
                                  {change.old_value || "—"}
                                </span>
                              ) : (
                                <span className="text-[11px] text-muted-foreground italic">
                                  (Initial)
                                </span>
                              )}

                              <span className="text-muted-foreground font-bold text-xs">
                                →
                              </span>

                              <span className="font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded font-mono text-[11px] max-w-[280px] break-words">
                                {change.new_value || "—"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
