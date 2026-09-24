"use client";
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
        <Link
          href="/orders/new"
          id="orders-new-btn"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
          style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
        >
          <span>+</span> New Order
        </Link>
      </div>

      {/* Table */}
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

        {/* Pagination */}
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
    </div>
  );
}
