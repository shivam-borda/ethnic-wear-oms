"use client";

import { PrintableJobSheet } from "@/components/PrintableJobSheet";
import { parseMeasurements, getCleanSlipNumber, ITEM_TYPE_LABELS } from "@/types";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Order } from "@/types";
import { formatDate, getDeliveryLabel, getCurrentStageLabel } from "@/lib/utils";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

interface Props {
  initialOrders: Order[];
}

function getStatusStyle(status: string) {
  if (status === "active") return { bg: "hsl(345,70%,28%,0.1)", color: "hsl(345,70%,28%)" };
  if (status === "delivered") return { bg: "hsl(140,40%,40%,0.1)", color: "hsl(140,40%,30%)" };
  return { bg: "hsl(0,60%,50%,0.1)", color: "hsl(0,60%,40%)" };
}

const FILTER_LABELS: Record<string, string> = {
  todayOrders: "Today's Orders",
  todayDeliveries: "Today's Deliveries",
  tomorrowDeliveries: "Tomorrow's Deliveries",
  next7Days: "Next 7 Days Deliveries",
  pendingStitching: "Pending Stitching Orders",
  pendingWork: "Pending Hand Work Orders",
  active: "Active Orders",
  delivered: "Delivered Orders",
  cancelled: "Cancelled Orders",
};

export default function OrdersClient({ initialOrders }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlFilter = searchParams.get("filter") || "";
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState<Order | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<string>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const filtered = useMemo(() => {
    let result = [...orders];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (o) =>
          o.order_number.toLowerCase().includes(q) ||
          o.party?.name?.toLowerCase().includes(q) ||
          o.phone?.toLowerCase().includes(q) ||
          o.vyapar_order_number?.toLowerCase().includes(q) ||
          o.stitching_measurement_number?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      result = result.filter((o) => o.status === statusFilter);
    }
    if (urlFilter) {
      const todayStr = new Date().toISOString().split("T")[0];
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];
      const next7 = new Date();
      next7.setDate(next7.getDate() + 7);
      const next7Str = next7.toISOString().split("T")[0];

      if (urlFilter === "todayOrders") {
        result = result.filter((o) => o.order_date === todayStr);
      } else if (urlFilter === "todayDeliveries") {
        result = result.filter((o) => o.delivery_date === todayStr);
      } else if (urlFilter === "tomorrowDeliveries") {
        result = result.filter((o) => o.delivery_date === tomorrowStr);
      } else if (urlFilter === "next7Days") {
        result = result.filter(
          (o) => o.delivery_date && o.delivery_date >= todayStr && o.delivery_date <= next7Str
        );
      } else if (urlFilter === "pendingStitching") {
        result = result.filter((o) => {
          const items = o.order_items || [];
          return items.some(
            (i) => i.item_progress?.stitching_status === "pending" || i.item_progress?.stitching_status === "in_progress"
          );
        });
      } else if (urlFilter === "pendingWork") {
        result = result.filter((o) => {
          const items = o.order_items || [];
          return items.some(
            (i) => i.item_progress?.work_status === "pending" || i.item_progress?.work_status === "in_progress"
          );
        });
      } else if (urlFilter === "active" || urlFilter === "delivered" || urlFilter === "cancelled") {
        result = result.filter((o) => o.status === urlFilter);
      }
    }
    result.sort((a, b) => {
      let av: string | number = 0, bv: string | number = 0;
      if (sortField === "order_number") { av = a.order_number; bv = b.order_number; }
      else if (sortField === "party") { av = a.party?.name || ""; bv = b.party?.name || ""; }
      else if (sortField === "order_date") { av = a.order_date; bv = b.order_date; }
      else if (sortField === "delivery_date") { av = a.delivery_date || ""; bv = b.delivery_date || ""; }
      else { av = a.created_at; bv = b.created_at; }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  }, [orders, search, statusFilter, sortField, sortDir, urlFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (field: string) => {
    if (field === sortField) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const handlePrintSheet = (order: Order) => {
    setSelectedOrderForPrint(order);
    setIsPrintModalOpen(true);
  };

  const handleDelete = async (id: string, orderNo: string) => {
    if (!confirm(`Delete order ${orderNo}? This cannot be undone.`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("oms_orders").delete().eq("id", id);
    if (error) { toast.error("Failed to delete order"); return; }
    toast.success(`Order ${orderNo} deleted`);
    setOrders((prev) => prev.filter((o) => o.id !== id));
  };

  const SortIcon = ({ field }: { field: string }) =>
    sortField === field ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕";

  return (
    <>
      <div className="space-y-5">
        {urlFilter && FILTER_LABELS[urlFilter] && (
          <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-xs font-semibold">
            <div className="flex items-center gap-2">
              <span className="text-base">📊</span>
              <span>Dashboard Widget Filter: <strong className="text-primary font-bold">{FILTER_LABELS[urlFilter]}</strong> ({filtered.length} order{filtered.length !== 1 ? "s" : ""})</span>
            </div>
            <Link href="/orders" prefetch={true} className="px-2.5 py-1 rounded-md bg-white border shadow-sm text-xs font-bold text-foreground hover:bg-muted transition-colors">
              ✕ Clear Filter
            </Link>
          </div>
        )}
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-48 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">🔍</span>
            <input
              id="orders-search"
              type="text"
              placeholder="Search by order no., party, phone, Vyapar no..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border bg-card text-sm outline-none focus:ring-2"
              style={{ borderColor: "hsl(var(--border))" }}
            />
          </div>
          <div className="w-44">
            <SearchableSelect
              id="orders-status-filter"
              options={[
                { value: "all", label: "All Status" },
                { value: "active", label: "Active" },
                { value: "delivered", label: "Delivered" },
                { value: "cancelled", label: "Cancelled" },
              ]}
              value={statusFilter}
              onChange={(val) => { setStatusFilter(val || "all"); setPage(1); }}
              placeholder="Filter by Status"
              searchPlaceholder="Search status..."
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex border rounded-lg overflow-hidden bg-card text-xs font-semibold shadow-sm" style={{ borderColor: "hsl(var(--border))" }}>
            <button
              type="button"
              id="orders-view-cards-btn"
              onClick={() => setViewMode("cards")}
              className={`px-3 py-2 flex items-center gap-1.5 transition-colors ${
                viewMode === "cards" ? "bg-primary text-white font-bold" : "hover:bg-muted text-muted-foreground"
              }`}
            >
              <span>🎴</span> Cards View
            </button>
            <button
              type="button"
              id="orders-view-table-btn"
              onClick={() => setViewMode("table")}
              className={`px-3 py-2 flex items-center gap-1.5 transition-colors ${
                viewMode === "table" ? "bg-primary text-white font-bold" : "hover:bg-muted text-muted-foreground"
              }`}
            >
              <span>📑</span> Table View
            </button>
          </div>

          <Link
            href="/orders/new"
            id="orders-new-btn"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
            style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
          >
            <span>+</span> New Order
          </Link>
        </div>

        {/* Dynamic View Rendering */}
        {viewMode === "cards" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1 text-xs text-muted-foreground font-medium">
              <span>Showing {paginated.length} of {filtered.length} order{filtered.length !== 1 ? "s" : ""}</span>
            </div>

            {paginated.length === 0 ? (
              <div className="rounded-xl border bg-card shadow-sm p-12 text-center text-muted-foreground text-sm" style={{ borderColor: "hsl(var(--border))" }}>
                {search || statusFilter !== "all" ? "No orders match your filters." : (
                  <span>No orders yet. <Link href="/orders/new" className="underline font-semibold" style={{ color: "hsl(var(--primary))" }}>Create your first order</Link></span>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginated.map((order) => {
                  const ss = getStatusStyle(order.status);
                  const m = parseMeasurements(order.stitching_measurement_number);
                  const slipNo = getCleanSlipNumber(order);
                  const allItems = order.order_items || [];
                  const itemsSummary = allItems
                    .map((i) => ITEM_TYPE_LABELS[i.item_type] || i.item_type)
                    .join(", ");
                  const stage = allItems.length > 0
                    ? getCurrentStageLabel(allItems[0]?.item_progress)
                    : "—";

                  return (
                    <div
                      key={order.id}
                      className="rounded-xl border bg-card shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4"
                      style={{ borderColor: "hsl(var(--border))" }}
                    >
                      <div>
                        {/* Top Header */}
                        <div className="flex items-start justify-between gap-2 border-b pb-3 mb-3" style={{ borderColor: "hsl(var(--border))" }}>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Link href={`/orders/${order.id}`} className="font-bold text-base hover:underline" style={{ color: "hsl(var(--primary))" }}>
                                Order #{order.order_number}
                              </Link>
                              {slipNo && (
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                                  Slip #: {slipNo}
                                </span>
                              )}
                            </div>
                            {order.vyapar_order_number && (
                              <p className="text-xs text-muted-foreground mt-0.5">Vyapar #: {order.vyapar_order_number}</p>
                            )}
                          </div>
                          <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize" style={{ background: `${ss.bg}`, color: ss.color }}>
                            {order.status}
                          </span>
                        </div>

                        {/* Customer Info */}
                        <div className="space-y-1.5">
                          <h3 className="font-bold text-base text-foreground" style={{ fontFamily: "Cormorant Garamond, serif" }}>
                            👤 {order.party?.name || "Unknown Party"}
                          </h3>
                          <p className="text-xs text-muted-foreground">📞 {order.phone || order.party?.phone || "No Phone"}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                            <span>📅 Order: <strong className="text-foreground font-medium">{formatDate(order.order_date)}</strong></span>
                            <span>🚚 Delivery: <strong className={order.delivery_date && order.delivery_date <= new Date().toISOString().split("T")[0] && order.status === "active" ? "text-red-600 font-semibold" : "text-foreground font-medium"}>{order.delivery_date ? getDeliveryLabel(order.delivery_date) : "—"}</strong></span>
                          </div>
                          {itemsSummary && (
                            <p className="text-xs text-muted-foreground mt-1">
                              👗 <span className="font-medium text-foreground">{itemsSummary}</span>
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            ⚙️ Stage: <span className="font-medium text-foreground">{stage}</span>
                          </p>
                        </div>

                        {/* Measurements Summary Chips */}
                        {(m.kurta_length || m.chest || m.shoulder || m.pant_length || m.pant_waist || m.bottom_mori) && (
                          <div className="mt-4 pt-3 border-t grid grid-cols-2 gap-2 text-xs" style={{ borderColor: "hsl(var(--border))" }}>
                            {/* Upper */}
                            <div className="bg-muted/50 p-2 rounded-lg space-y-0.5">
                              <p className="font-semibold text-primary">👔 Upper (ઉપર)</p>
                              <p className="text-muted-foreground">Len: <span className="font-medium text-foreground">{m.kurta_length || "-"}</span></p>
                              <p className="text-muted-foreground">Chest: <span className="font-medium text-foreground">{m.chest || "-"}</span></p>
                              <p className="text-muted-foreground">Shldr: <span className="font-medium text-foreground">{m.shoulder || "-"}</span></p>
                            </div>
                            {/* Lower */}
                            <div className="bg-muted/50 p-2 rounded-lg space-y-0.5">
                              <p className="font-semibold text-primary">👖 Lower (નીચે)</p>
                              <p className="text-muted-foreground">Len: <span className="font-medium text-foreground">{m.pant_length || "-"}</span></p>
                              <p className="text-muted-foreground">Waist: <span className="font-medium text-foreground">{m.pant_waist || "-"}</span></p>
                              <p className="text-muted-foreground">Mori: <span className="font-medium text-foreground">{m.bottom_mori || "-"}</span></p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Card Actions */}
                      <div className="flex items-center gap-1.5 pt-3 border-t" style={{ borderColor: "hsl(var(--border))" }}>
                        <Link
                          href={`/orders/${order.id}`}
                          className="flex-1 py-1.5 px-2 rounded-lg border text-xs font-semibold hover:bg-muted transition-colors text-center"
                          style={{ borderColor: "hsl(var(--border))" }}
                        >
                          👁️ View
                        </Link>
                        <Link
                          href={`/orders/${order.id}/edit`}
                          className="flex-1 py-1.5 px-2 rounded-lg border text-xs font-semibold hover:bg-muted transition-colors text-center"
                          style={{ borderColor: "hsl(var(--border))" }}
                        >
                          ✏️ Edit
                        </Link>
                        <button
                          onClick={() => handlePrintSheet(order)}
                          className="flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90 text-center flex items-center justify-center gap-1"
                          style={{ background: "hsl(var(--primary))" }}
                        >
                          <span>🖨️</span> Print Sheet
                        </button>
                        <button
                          onClick={() => handleDelete(order.id, order.order_number)}
                          className="py-1.5 px-2.5 rounded-lg border text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors"
                          title="Delete Order"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Cards Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 rounded-xl border bg-card shadow-sm text-xs" style={{ borderColor: "hsl(var(--border))" }}>
                <span className="text-muted-foreground">
                  Page {page} of {totalPages} ({filtered.length} orders)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 rounded-lg border hover:bg-muted disabled:opacity-40 font-medium transition-colors"
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 rounded-lg border hover:bg-muted disabled:opacity-40 font-medium transition-colors"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Table View */
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "hsl(var(--border))" }}>
              <span className="text-sm text-muted-foreground">
                {filtered.length} order{filtered.length !== 1 ? "s" : ""} found
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs font-medium text-muted-foreground uppercase tracking-wide" style={{ background: "hsl(var(--muted))" }}>
                    {[
                      { label: "Order No", field: "order_number" },
                      { label: "Party", field: "party" },
                      { label: "Phone", field: "" },
                      { label: "Order Date", field: "order_date" },
                      { label: "Delivery", field: "delivery_date" },
                      { label: "Items", field: "" },
                      { label: "Stage", field: "" },
                      { label: "Status", field: "" },
                      { label: "Actions", field: "" },
                    ].map((col) => (
                      <th
                        key={col.label}
                        className={`px-4 py-3 text-left whitespace-nowrap ${col.field ? "cursor-pointer hover:text-foreground select-none" : ""}`}
                        onClick={() => col.field && handleSort(col.field)}
                      >
                        {col.label}
                        {col.field && <span className="text-muted-foreground/50"><SortIcon field={col.field} /></span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                        {search || statusFilter !== "all" ? "No orders match your filters." : (
                          <span>No orders yet. <Link href="/orders/new" className="underline" style={{ color: "hsl(var(--primary))" }}>Create your first order</Link></span>
                        )}
                      </td>
                    </tr>
                  ) : (
                    paginated.map((order) => {
                      const ss = getStatusStyle(order.status);
                      const allItems = order.order_items || [];
                      const stage = allItems.length > 0
                        ? getCurrentStageLabel(allItems[0]?.item_progress)
                        : "—";
                      return (
                        <tr
                          key={order.id}
                          className="data-table-row border-b last:border-0"
                          style={{ borderColor: "hsl(var(--border))" }}
                        >
                          <td className="px-4 py-3">
                            <Link href={`/orders/${order.id}`} className="font-bold hover:underline" style={{ color: "hsl(var(--primary))" }}>
                              {order.order_number}
                            </Link>
                          </td>
                          <td className="px-4 py-3 font-medium">{order.party?.name || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{order.phone || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(order.order_date)}</td>
                          <td className="px-4 py-3">
                            <span className={order.delivery_date && order.delivery_date <= new Date().toISOString().split("T")[0] && order.status === "active" ? "text-red-600 font-semibold" : "text-muted-foreground"}>
                              {order.delivery_date ? getDeliveryLabel(order.delivery_date) : "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3">{allItems.length}</td>
                          <td className="px-4 py-3 text-muted-foreground">{stage}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize" style={{ background: `${ss.bg}`, color: ss.color }}>
                              {order.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Link href={`/orders/${order.id}`} className="text-xs px-2 py-1 rounded border hover:bg-muted transition-colors" title="View">👁️</Link>
                              <Link href={`/orders/${order.id}/edit`} className="text-xs px-2 py-1 rounded border hover:bg-muted transition-colors" title="Edit">✏️</Link>
                              <button onClick={() => handlePrintSheet(order)} className="text-xs px-2 py-1 rounded border hover:bg-muted transition-colors" title="Print Sheet">🖨️</button>
                              <button onClick={() => handleDelete(order.id, order.order_number)} className="text-xs px-2 py-1 rounded border hover:bg-red-50 text-red-500 transition-colors" title="Delete">🗑️</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: "hsl(var(--border))" }}>
                <span className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40 hover:bg-muted transition-colors">← Prev</button>
                  <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40 hover:bg-muted transition-colors">Next →</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Measurement Detail & Print Modal */}
      {isPrintModalOpen && selectedOrderForPrint && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto print:static print:p-0 print:bg-white">
          <div className="bg-card rounded-2xl shadow-2xl max-w-3xl w-full p-6 space-y-6 relative my-8 print:shadow-none print:p-0 print:m-0 print:w-full print:max-w-none print:bg-white">
            <div className="flex items-center justify-between border-b pb-4 print:hidden" style={{ borderColor: "hsl(var(--border))" }}>
              <div className="flex items-center gap-2">
                <span className="text-xl">📐</span>
                <h2 className="text-xl font-bold" style={{ fontFamily: "Cormorant Garamond, serif" }}>
                  Tailor Job Sheet & Measurement Slip
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2 hover:opacity-90 transition-opacity"
                  style={{ background: "hsl(var(--primary))" }}
                >
                  <span>🖨️</span> Print Sheet
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="px-3 py-2 rounded-lg border text-sm hover:bg-muted font-bold text-muted-foreground"
                >
                  ✕
                </button>
              </div>
            </div>

            <PrintableJobSheet order={selectedOrderForPrint} />
          </div>
        </div>
      )}

      {/* Standalone Printable Area for Direct Printing */}
      <div className="hidden print:block">
        {selectedOrderForPrint && <PrintableJobSheet order={selectedOrderForPrint} />}
      </div>
    </>
  );
}
