"use client";
import { downloadJobSheetAsPDF } from "@/lib/downloadPdf";
import { PrintableJobSheet } from "@/components/PrintableJobSheet";
import {
  parseMeasurements,
  getCleanSlipNumber,
  ITEM_TYPE_LABELS,
  STAGE_LABELS,
  STATUS_LABELS,
  type ItemType,
  type Stage,
  type StageStatus,
  type OrderItem,
} from "@/types";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Order } from "@/types";
import { formatDate, getDeliveryLabel, getCurrentStageLabel, cn } from "@/lib/utils";
import { toast } from "sonner";
import { recordOrderDeletion } from "@/lib/orderLogs";
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

const ITEM_ICONS: Record<string, string> = {
  pant: "👖",
  kurta: "🥻",
  koti: "🧥",
  kurta_koti: "👑",
  blazer: "👔",
  jacket: "🧥",
  indo_western: "✨",
  jodhpuri: "🤴",
};

const STAGES: Stage[] = ["fabric", "work", "stitching", "delivery"];

const STAGE_ICONS: Record<Stage, string> = {
  fabric: "🧵",
  work: "🪡",
  stitching: "✂️",
  delivery: "🚚",
};

export default function OrdersClient({ initialOrders }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlFilter = searchParams.get("filter") || "";
  const urlItem = searchParams.get("item") || "all";

  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [itemTypeFilter, setItemTypeFilter] = useState<string>(urlItem);
  const [updatingStageKey, setUpdatingStageKey] = useState<string | null>(null);
  const [updatingOrderKey, setUpdatingOrderKey] = useState<string | null>(null);

  // Keep orders state synced whenever initialOrders prop updates from server
  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  // Refresh server component data on mount
  useEffect(() => {
    router.refresh();
  }, [router]);

  // Restore saved viewMode preference from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedMode = localStorage.getItem("oms_orders_view_mode");
      if (savedMode === "cards" || savedMode === "table") {
        setViewMode(savedMode);
      }
    }
  }, []);

  const handleViewModeChange = (mode: "cards" | "table") => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("oms_orders_view_mode", mode);
    }
  };

  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState<Order | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<string>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  // Compute item counts for category pills
  const itemCounts = useMemo(() => {
    const counts: Record<string, number> = { all: orders.length };
    Object.keys(ITEM_TYPE_LABELS).forEach((type) => {
      counts[type] = orders.filter((o) =>
        (o.order_items || []).some((i) => i.item_type === type)
      ).length;
    });
    return counts;
  }, [orders]);

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
    if (itemTypeFilter !== "all") {
      result = result.filter((o) =>
        (o.order_items || []).some((i) => i.item_type === itemTypeFilter)
      );
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
      if (sortField === "party") { av = a.party?.name || ""; bv = b.party?.name || ""; }
      else if (sortField === "order_number") { av = a.order_number; bv = b.order_number; }
      else if (sortField === "order_date") { av = a.order_date; bv = b.order_date; }
      else if (sortField === "delivery_date") { av = a.delivery_date || ""; bv = b.delivery_date || ""; }
      else { av = a.created_at; bv = b.created_at; }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  }, [orders, search, statusFilter, itemTypeFilter, sortField, sortDir, urlFilter]);

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
    const orderToDelete = orders.find((o) => o.id === id);
    const supabase = createClient();
    if (orderToDelete) {
      const { data: { user } } = await supabase.auth.getUser();
      recordOrderDeletion(orderToDelete, user?.user_metadata?.full_name || user?.email || "Staff");
    }
    const { error } = await supabase.from("oms_orders").delete().eq("id", id);
    if (error) { toast.error("Failed to delete order"); return; }
    toast.success(`Order ${orderNo} deleted`);
    setOrders((prev) => prev.filter((o) => o.id !== id));
  };

  // 🚀 Direct Stage Update from List View
  const handleStageUpdate = async (
    order: Order,
    item: OrderItem,
    stage: Stage,
    newStatus: StageStatus
  ) => {
    const key = `${stage}_status`;
    const startedKey = `${stage}_started_at`;
    const completedKey = `${stage}_completed_at`;
    const stageKey = `${item.id}-${stage}`;
    setUpdatingStageKey(stageKey);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const now = new Date().toISOString();

      const p = item.item_progress;
      const oldStatus = (p ? p[key as keyof typeof p] : "pending") as StageStatus;

      const updateData: Record<string, string | null> = {
        [key]: newStatus,
        updated_by: user?.id || null,
      };
      if (newStatus === "in_progress" && !item.item_progress?.[startedKey as keyof typeof item.item_progress]) {
        updateData[startedKey] = now;
      }
      if (newStatus === "completed") {
        updateData[completedKey] = now;
      }

      const { error } = await supabase
        .from("item_progress")
        .update(updateData)
        .eq("item_id", item.id);

      if (error) throw error;

      // Log history
      await supabase.from("item_progress_history").insert([{
        item_id: item.id,
        stage,
        old_status: oldStatus,
        new_status: newStatus,
        changed_by: user?.id || null,
      }]);

      toast.success(`${ITEM_TYPE_LABELS[item.item_type]} - ${STAGE_LABELS[stage]}: ${STATUS_LABELS[newStatus]}`);

      // Update local state immediately
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id !== order.id) return o;
          return {
            ...o,
            order_items: (o.order_items || []).map((oi) => {
              if (oi.id !== item.id) return oi;
              return {
                ...oi,
                item_progress: {
                  ...(oi.item_progress || {}),
                  [key]: newStatus,
                  ...(newStatus === "in_progress" ? { [startedKey]: now } : {}),
                  ...(newStatus === "completed" ? { [completedKey]: now } : {}),
                } as any,
              };
            }),
          };
        }) as Order[]
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Stage update failed");
    } finally {
      setUpdatingStageKey(null);
    }
  };

  // 🚀 Direct Order Status Update (Active / Delivered / Cancelled) from List View
  const handleOrderStatusUpdate = async (order: Order, newStatus: string) => {
    if (!newStatus || newStatus === order.status) return;
    setUpdatingOrderKey(order.id);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("oms_orders")
        .update({ status: newStatus })
        .eq("id", order.id);

      if (error) throw error;

      toast.success(`Order ${order.order_number} status: ${newStatus.toUpperCase()}`);

      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: newStatus as any } : o))
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Status update failed");
    } finally {
      setUpdatingOrderKey(null);
    }
  };

  const SortIcon = ({ field }: { field: string }) =>
    sortField === field ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕";

  return (
    <>
      <div className="space-y-4">
        {/* URL Dashboard Widget Filter Alert */}
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

        {/* Item Type / Category Filter Tabs (Pant, Kurta, Koti, Blazer, etc.) */}
        <div className="bg-card border rounded-xl p-2.5 shadow-sm space-y-1.5" style={{ borderColor: "hsl(var(--border))" }}>
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <span>🏷️</span> Filter By Garment Item (આઈટમ પ્રમાણે લિસ્ટ)
            </span>
            {itemTypeFilter !== "all" && (
              <button
                type="button"
                onClick={() => { setItemTypeFilter("all"); setPage(1); }}
                className="text-xs text-primary hover:underline font-semibold"
              >
                Reset to All Items
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            <button
              type="button"
              id="filter-item-all"
              onClick={() => { setItemTypeFilter("all"); setPage(1); }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 border shadow-sm",
                itemTypeFilter === "all"
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background hover:bg-muted text-foreground border-border"
              )}
            >
              <span>✨ All Items (બધા)</span>
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full font-extrabold",
                itemTypeFilter === "all" ? "bg-black/20 text-white" : "bg-muted text-muted-foreground"
              )}>{itemCounts.all || 0}</span>
            </button>
            {Object.entries(ITEM_TYPE_LABELS).map(([typeKey, label]) => {
              const count = itemCounts[typeKey] || 0;
              const isSelected = itemTypeFilter === typeKey;
              return (
                <button
                  key={typeKey}
                  type="button"
                  id={`filter-item-${typeKey}`}
                  onClick={() => { setItemTypeFilter(typeKey); setPage(1); }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 border shadow-sm",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-sm scale-105"
                      : "bg-background hover:bg-muted text-foreground border-border"
                  )}
                >
                  <span>{ITEM_ICONS[typeKey] || "🧵"} {label}</span>
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full font-extrabold",
                    isSelected ? "bg-black/20 text-white" : "bg-muted text-muted-foreground"
                  )}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Toolbar: Search, Status, View Toggle */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-48 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">🔍</span>
            <input
              id="orders-search"
              type="text"
              placeholder="Search by customer name, phone, order no., Vyapar no..."
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

          {/* View Mode Toggle (Cards vs Table) */}
          <div className="flex items-center rounded-lg border bg-card p-1 shadow-sm flex-shrink-0" style={{ borderColor: "hsl(var(--border))" }}>
            <button
              onClick={() => handleViewModeChange("cards")}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                viewMode === "cards" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
              title="Cards View"
            >
              <span>🗂️</span> Cards
            </button>
            <button
              onClick={() => handleViewModeChange("table")}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                viewMode === "table" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
              title="Table View"
            >
              <span>📋</span> Table
            </button>
          </div>
        </div>

        {/* Results Counter */}
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>Showing <strong>{filtered.length}</strong> orders {itemTypeFilter !== "all" ? `(${ITEM_TYPE_LABELS[itemTypeFilter as ItemType] || itemTypeFilter} orders)` : ""}</span>
          <Link href="/orders/new" className="font-semibold text-primary hover:underline">+ Create New Order</Link>
        </div>

        {/* 🗂️ Cards View */}
        {viewMode === "cards" && (
          <div className="space-y-6">
            {paginated.length === 0 ? (
              <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground shadow-sm" style={{ borderColor: "hsl(var(--border))" }}>
                <p className="text-4xl mb-3">🔍</p>
                <p className="font-semibold text-foreground text-base">No orders found</p>
                <p className="text-xs mt-1">Try resetting the garment item or search filter.</p>
                <button
                  onClick={() => { setSearch(""); setStatusFilter("all"); setItemTypeFilter("all"); }}
                  className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {paginated.map((order) => {
                  const ss = getStatusStyle(order.status);
                  const m = parseMeasurements(order.stitching_measurement_number);
                  const slipNo = getCleanSlipNumber(order);
                  const allItems = order.order_items || [];

                  return (
                    <div
                      key={order.id}
                      className="rounded-xl border bg-card shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4"
                      style={{ borderColor: "hsl(var(--border))" }}
                    >
                      <div>
                        {/* Top Header - Customer Full Name + Interactive Status Select */}
                        <div className="flex items-start justify-between gap-2 border-b pb-3 mb-3" style={{ borderColor: "hsl(var(--border))" }}>
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/orders/${order.id}`}
                              className="font-extrabold text-lg sm:text-xl tracking-tight text-foreground hover:text-primary transition-colors flex items-center gap-1.5 leading-snug group"
                              style={{ fontFamily: "Cormorant Garamond, serif" }}
                              title={`View details for ${order.party?.name || "Customer"}`}
                            >
                              <span className="text-base flex-shrink-0">👤</span>
                              <span className="truncate group-hover:underline">
                                {order.party?.name || "Unknown Customer"}
                              </span>
                            </Link>

                            {/* Secondary Order Badges */}
                            <div className="flex items-center gap-2 flex-wrap mt-1.5">
                              <span className="text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                                Order #{order.order_number}
                              </span>
                              {slipNo && (
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                                  Slip #: {slipNo}
                                </span>
                              )}
                              {order.vyapar_order_number && (
                                <span className="text-xs text-muted-foreground">
                                  Vyapar #: {order.vyapar_order_number}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* ⚡ Quick Interactive Order Status Dropdown */}
                          <div className="flex-shrink-0">
                            <select
                              value={order.status}
                              disabled={updatingOrderKey === order.id}
                              onChange={(e) => handleOrderStatusUpdate(order, e.target.value)}
                              className={cn(
                                "text-xs font-bold px-2.5 py-1 rounded-full border outline-none cursor-pointer transition-colors shadow-sm",
                                order.status === "active" && "bg-amber-500/15 text-amber-600 border-amber-400 dark:text-amber-400",
                                order.status === "delivered" && "bg-emerald-500/15 text-emerald-600 border-emerald-400 dark:text-emerald-400",
                                order.status === "cancelled" && "bg-rose-500/15 text-rose-600 border-rose-400 dark:text-rose-400"
                              )}
                            >
                              <option value="active">● Active</option>
                              <option value="delivered">✓ Delivered</option>
                              <option value="cancelled">✕ Cancelled</option>
                            </select>
                          </div>
                        </div>

                        {/* Customer & Order Dates */}
                        <div className="space-y-1.5 text-xs">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <span>📞</span> <span className="font-semibold text-foreground">{order.phone || order.party?.phone || "No Phone"}</span>
                          </p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                            <span>📅 Order: <strong className="text-foreground font-medium">{formatDate(order.order_date)}</strong></span>
                            <span>🚚 Delivery: <strong className={order.delivery_date && order.delivery_date <= new Date().toISOString().split("T")[0] && order.status === "active" ? "text-red-600 font-semibold" : "text-foreground font-medium"}>{order.delivery_date ? getDeliveryLabel(order.delivery_date) : "—"}</strong></span>
                          </div>
                        </div>

                        {/* ⚡ LIVE INTERACTIVE PRODUCTION STAGES (Fabric, Work, Stitching, Delivery) */}
                        <div className="mt-3.5 pt-3 border-t space-y-2.5" style={{ borderColor: "hsl(var(--border))" }}>
                          <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                            <span>⚙️ Production Progress (સ્ટેજ અપડેટ કરો)</span>
                            <span className="text-[10px] text-primary lowercase font-medium">1-tap update</span>
                          </div>

                          {allItems.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">No items recorded</p>
                          ) : (
                            allItems.map((item, itemIdx) => {
                              const p = item.item_progress;
                              return (
                                <div key={item.id || itemIdx} className="bg-muted/40 border rounded-xl p-2.5 space-y-2">
                                  <div className="flex items-center justify-between text-xs font-bold text-foreground">
                                    <span className="flex items-center gap-1">
                                      <span>{ITEM_ICONS[item.item_type] || "🧵"}</span>
                                      <span>{ITEM_TYPE_LABELS[item.item_type]}</span>
                                      <span className="text-[11px] text-muted-foreground font-normal">x{item.quantity || 1}</span>
                                    </span>
                                  </div>

                                  {/* 4 Interactive Stages Stepper */}
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
                                    {STAGES.map((stage) => {
                                      const key = `${stage}_status`;
                                      const currentStatus = (p ? p[key as keyof typeof p] : "pending") as StageStatus;
                                      const stageKey = `${item.id}-${stage}`;
                                      const isUpdating = updatingStageKey === stageKey;

                                      return (
                                        <div key={stage} className="flex flex-col gap-1">
                                          <div className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                                            <span>{STAGE_ICONS[stage]}</span>
                                            <span>{STAGE_LABELS[stage]}</span>
                                          </div>
                                          <select
                                            disabled={isUpdating}
                                            value={currentStatus}
                                            onChange={(e) => handleStageUpdate(order, item, stage, e.target.value as StageStatus)}
                                            className={cn(
                                              "text-[11px] font-bold py-1 px-1.5 rounded-lg border outline-none cursor-pointer transition-all shadow-xs",
                                              currentStatus === "pending" && "bg-background text-muted-foreground border-border hover:border-amber-400",
                                              currentStatus === "in_progress" && "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-400 font-extrabold",
                                              currentStatus === "completed" && "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-400 font-extrabold"
                                            )}
                                          >
                                            <option value="pending">○ Pending</option>
                                            <option value="in_progress">◐ In Progress</option>
                                            <option value="completed">✓ Completed</option>
                                          </select>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* Measurements Summary Chips */}
                        {(m.kurta_length || m.chest || m.shoulder || m.pant_length || m.pant_waist || m.bottom_mori || m.lambai || m.chati) && (
                          <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2 text-xs" style={{ borderColor: "hsl(var(--border))" }}>
                            {/* Upper */}
                            <div className="bg-muted/50 p-2 rounded-lg space-y-0.5">
                              <p className="font-semibold text-primary">👔 Upper (ઉપર)</p>
                              <p className="text-muted-foreground">Len: <span className="font-medium text-foreground">{m.lambai || m.kurta_length || "-"}</span></p>
                              <p className="text-muted-foreground">Chest: <span className="font-medium text-foreground">{m.chati || m.chest || "-"}</span></p>
                            </div>
                            {/* Lower */}
                            <div className="bg-muted/50 p-2 rounded-lg space-y-0.5">
                              <p className="font-semibold text-primary">👖 Lower (નીચે)</p>
                              <p className="text-muted-foreground">Len: <span className="font-medium text-foreground">{m.lambai_bottom || m.pant_length || "-"}</span></p>
                              <p className="text-muted-foreground">Waist: <span className="font-medium text-foreground">{m.kamber || m.pant_waist || m.waist || "-"}</span></p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Card Bottom Actions */}
                      <div className="pt-3 border-t flex items-center justify-between gap-2" style={{ borderColor: "hsl(var(--border))" }}>
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/orders/${order.id}`}
                            className="text-xs px-3 py-1.5 rounded-lg border bg-background hover:bg-muted font-bold text-foreground transition-all flex items-center gap-1"
                          >
                            <span>👁️</span> View
                          </Link>
                          <Link
                            href={`/orders/${order.id}/edit`}
                            className="text-xs px-3 py-1.5 rounded-lg border bg-background hover:bg-muted font-semibold text-foreground transition-all flex items-center gap-1"
                          >
                            <span>✏️</span> Edit
                          </Link>
                          <button
                            type="button"
                            onClick={() => handlePrintSheet(order)}
                            className="text-xs px-3 py-1.5 rounded-lg border bg-background hover:bg-muted font-semibold text-foreground transition-all flex items-center gap-1"
                          >
                            <span>🖨️</span> Print
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDelete(order.id, order.order_number)}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/50 transition-colors"
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
              <div className="flex items-center justify-between pt-2">
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

        {/* 📋 Table View */}
        {viewMode === "table" && (
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden" style={{ borderColor: "hsl(var(--border))" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs font-medium text-muted-foreground uppercase tracking-wide" style={{ background: "hsl(var(--muted))" }}>
                    {[
                      { label: "Customer (Party)", field: "party" },
                      { label: "Phone", field: "" },
                      { label: "Order Date", field: "order_date" },
                      { label: "Delivery", field: "delivery_date" },
                      { label: "Items & Stages (Quick Update)", field: "" },
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
                      <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                        {search || statusFilter !== "all" || itemTypeFilter !== "all" ? "No orders match your filters." : (
                          <span>No orders yet. <Link href="/orders/new" className="underline" style={{ color: "hsl(var(--primary))" }}>Create your first order</Link></span>
                        )}
                      </td>
                    </tr>
                  ) : (
                    paginated.map((order) => {
                      const ss = getStatusStyle(order.status);
                      const slipNo = getCleanSlipNumber(order);
                      const allItems = order.order_items || [];

                      return (
                        <tr
                          key={order.id}
                          className="data-table-row border-b last:border-0 hover:bg-muted/40 transition-colors"
                          style={{ borderColor: "hsl(var(--border))" }}
                        >
                          {/* Customer Full Name Highlighted in Big Size */}
                          <td className="px-4 py-3">
                            <Link
                              href={`/orders/${order.id}`}
                              className="font-extrabold text-base hover:text-primary transition-colors text-foreground block hover:underline"
                              style={{ fontFamily: "Cormorant Garamond, serif" }}
                            >
                              👤 {order.party?.name || "Unknown Party"}
                            </Link>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 flex-wrap">
                              <span className="font-bold text-primary">#{order.order_number}</span>
                              {slipNo && <span className="text-[11px] px-1.5 py-0.2 rounded bg-muted font-medium">Slip: {slipNo}</span>}
                              {order.vyapar_order_number && <span className="text-[11px] text-muted-foreground">Vyapar: {order.vyapar_order_number}</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground font-medium">{order.phone || order.party?.phone || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(order.order_date)}</td>
                          <td className="px-4 py-3">
                            <span className={order.delivery_date && order.delivery_date <= new Date().toISOString().split("T")[0] && order.status === "active" ? "text-red-600 font-semibold" : "text-muted-foreground"}>
                              {order.delivery_date ? getDeliveryLabel(order.delivery_date) : "—"}
                            </span>
                          </td>

                          {/* ⚡ Quick Interactive Stages in Table */}
                          <td className="px-4 py-3 min-w-[280px]">
                            {allItems.length === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <div className="space-y-1.5">
                                {allItems.map((item, iIdx) => {
                                  const p = item.item_progress;
                                  return (
                                    <div key={item.id || iIdx} className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-bold text-foreground">
                                        {ITEM_ICONS[item.item_type] || ""} {ITEM_TYPE_LABELS[item.item_type]}:
                                      </span>
                                      <div className="flex items-center gap-1 flex-wrap">
                                        {STAGES.map((stg) => {
                                          const key = `${stg}_status`;
                                          const stgStatus = (p ? p[key as keyof typeof p] : "pending") as StageStatus;
                                          return (
                                            <select
                                              key={stg}
                                              value={stgStatus}
                                              disabled={updatingStageKey === `${item.id}-${stg}`}
                                              onChange={(e) => handleStageUpdate(order, item, stg, e.target.value as StageStatus)}
                                              className={cn(
                                                "text-[10px] font-bold px-1.5 py-0.5 rounded border outline-none cursor-pointer",
                                                stgStatus === "pending" && "bg-background text-muted-foreground border-border",
                                                stgStatus === "in_progress" && "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-400 font-extrabold",
                                                stgStatus === "completed" && "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-400 font-extrabold"
                                              )}
                                              title={`${STAGE_LABELS[stg]}: ${STATUS_LABELS[stgStatus]}`}
                                            >
                                              <option value="pending">{STAGE_ICONS[stg]} Pend</option>
                                              <option value="in_progress">{STAGE_ICONS[stg]} Prog</option>
                                              <option value="completed">{STAGE_ICONS[stg]} Done ✓</option>
                                            </select>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>

                          {/* ⚡ Quick Interactive Status in Table */}
                          <td className="px-4 py-3">
                            <select
                              value={order.status}
                              disabled={updatingOrderKey === order.id}
                              onChange={(e) => handleOrderStatusUpdate(order, e.target.value)}
                              className={cn(
                                "text-xs font-bold px-2.5 py-1 rounded-full border outline-none cursor-pointer shadow-xs",
                                order.status === "active" && "bg-amber-500/15 text-amber-600 border-amber-400 dark:text-amber-400",
                                order.status === "delivered" && "bg-emerald-500/15 text-emerald-600 border-emerald-400 dark:text-emerald-400",
                                order.status === "cancelled" && "bg-rose-500/15 text-rose-600 border-rose-400 dark:text-rose-400"
                              )}
                            >
                              <option value="active">● Active</option>
                              <option value="delivered">✓ Delivered</option>
                              <option value="cancelled">✕ Cancelled</option>
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <Link href={`/orders/${order.id}`} className="text-xs px-2.5 py-1 rounded border hover:bg-muted font-semibold transition-colors" title="View">👁️</Link>
                              <Link href={`/orders/${order.id}/edit`} className="text-xs px-2.5 py-1 rounded border hover:bg-muted font-semibold transition-colors" title="Edit">✏️</Link>
                              <button onClick={() => handlePrintSheet(order)} className="text-xs px-2.5 py-1 rounded border hover:bg-muted font-semibold transition-colors" title="Print Sheet">🖨️</button>
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
        <div className="fixed inset-0 bg-black/70 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto print:static print:p-0 print:bg-white">
          <div
            className="bg-card rounded-2xl shadow-2xl max-w-3xl w-full p-3 sm:p-5 flex flex-col max-h-[92vh] sm:max-h-[90vh] my-auto relative print:shadow-none print:p-0 print:m-0 print:w-full print:max-w-none print:bg-white"
            style={{ borderColor: "hsl(var(--border))" }}
          >
            {/* Top Modal Header */}
            <div className="flex items-center justify-between border-b pb-3 mb-2 flex-shrink-0 print:hidden" style={{ borderColor: "hsl(var(--border))" }}>
              <div className="flex items-center gap-1.5 overflow-hidden">
                <span className="text-lg sm:text-xl">📐</span>
                <h2 className="text-xs sm:text-lg font-bold text-foreground truncate" style={{ fontFamily: "Cormorant Garamond, serif" }}>
                  Tailor Job Sheet - {selectedOrderForPrint.party?.name || selectedOrderForPrint.order_number}
                </h2>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => downloadJobSheetAsPDF(selectedOrderForPrint, `Tailor_JobSheet_${selectedOrderForPrint.order_number || selectedOrderForPrint.id}`)}
                  className="px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1 transition-opacity shadow-sm"
                >
                  <span>📥</span> Download PDF
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); try { window.print(); } catch(err) {} }} onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); try { window.print(); } catch(err) {} }}
                  className="px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-white flex items-center gap-1 hover:opacity-90 transition-opacity shadow-sm"
                  style={{ background: "hsl(var(--primary))" }}
                >
                  <span>🖨️</span> Print
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="px-2.5 py-1.5 rounded-lg border text-xs sm:text-sm hover:bg-muted font-bold text-muted-foreground transition-colors"
                  style={{ borderColor: "hsl(var(--border))" }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Scrollable Printable Content */}
            <div className="flex-1 overflow-y-auto pr-0.5 print:overflow-visible">
              <PrintableJobSheet order={selectedOrderForPrint} />
            </div>
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
