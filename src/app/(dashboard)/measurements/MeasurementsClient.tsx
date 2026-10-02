"use client";
import { downloadJobSheetAsPDF, downloadMultipleJobSheetsPDF } from "@/lib/downloadPdf";
import { PrintableJobSheet } from "@/components/PrintableJobSheet";
import { BulletPointsList } from "@/components/ui/BulletPoints";
import { useState, useMemo } from "react";
import Link from "next/link";
import { format } from "date-fns";
import type { Order, GarmentMeasurements, ItemType } from "@/types";
import { parseMeasurements, getCleanSlipNumber, ITEM_TYPE_LABELS } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  initialOrders: Order[];
}

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

export default function MeasurementsClient({ initialOrders }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [itemTypeFilter, setItemTypeFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isBatchPrintModalOpen, setIsBatchPrintModalOpen] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  // Filter orders that have stitching_measurement_number / measurements
  const ordersWithMeasurements = initialOrders.filter((order) => {
    if (!order.stitching_measurement_number) return false;
    const m = parseMeasurements(order.stitching_measurement_number);
    return !!(
      (m.slip_number && m.slip_number.trim() !== "" && !m.slip_number.trim().startsWith("{")) ||
      m.kurta_length ||
      m.chest ||
      m.pant_length ||
      m.waist ||
      m.hips ||
      m.shoulder ||
      m.sleeve_length ||
      m.pant_waist ||
      m.lambai ||
      m.lambai_bottom
    );
  });

  // Compute item counts for measurement slips
  const itemCounts = useMemo(() => {
    const counts: Record<string, number> = { all: ordersWithMeasurements.length };
    Object.keys(ITEM_TYPE_LABELS).forEach((type) => {
      counts[type] = ordersWithMeasurements.filter((o) =>
        (o.order_items || []).some((i) => i.item_type === type)
      ).length;
    });
    return counts;
  }, [ordersWithMeasurements]);

  const filteredOrders = useMemo(() => {
    return ordersWithMeasurements.filter((order) => {
      const q = searchTerm.toLowerCase();
      const partyName = order.party?.name?.toLowerCase() || "";
      const phone = order.phone?.toLowerCase() || order.party?.phone?.toLowerCase() || "";
      const orderNo = order.order_number?.toLowerCase() || "";
      const vyaparNo = order.vyapar_order_number?.toLowerCase() || "";
      const m = parseMeasurements(order.stitching_measurement_number);
      const slipNo = (m.slip_number || "").toLowerCase();

      const matchesSearch =
        partyName.includes(q) ||
        phone.includes(q) ||
        orderNo.includes(q) ||
        vyaparNo.includes(q) ||
        slipNo.includes(q);

      if (!matchesSearch) return false;

      if (itemTypeFilter !== "all") {
        return (order.order_items || []).some((i) => i.item_type === itemTypeFilter);
      }

      return true;
    });
  }, [ordersWithMeasurements, searchTerm, itemTypeFilter]);

  const totalPages = Math.ceil(filteredOrders.length / PAGE_SIZE);
  const paginatedOrders = filteredOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Selected order objects
  const selectedOrders = useMemo(() => {
    return initialOrders.filter((o) => selectedOrderIds.includes(o.id));
  }, [initialOrders, selectedOrderIds]);

  // Checkbox helpers
  const toggleSelectOrder = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const isAllPaginatedSelected = paginatedOrders.length > 0 && paginatedOrders.every((o) => selectedOrderIds.includes(o.id));

  const toggleSelectAllPaginated = () => {
    if (isAllPaginatedSelected) {
      const paginatedIds = paginatedOrders.map((o) => o.id);
      setSelectedOrderIds((prev) => prev.filter((id) => !paginatedIds.includes(id)));
    } else {
      const paginatedIds = paginatedOrders.map((o) => o.id);
      setSelectedOrderIds((prev) => Array.from(new Set([...prev, ...paginatedIds])));
    }
  };

  const selectAllFiltered = () => {
    const allFilteredIds = filteredOrders.map((o) => o.id);
    setSelectedOrderIds(allFilteredIds);
    toast.success(`Selected all ${allFilteredIds.length} filtered measurement slips!`);
  };

  const clearSelection = () => {
    setSelectedOrderIds([]);
  };

  const openDetails = (order: Order) => {
    setSelectedOrder(order);
    setIsPrintModalOpen(true);
  };

  // Batch PDF download
  const handleBatchPdfDownload = async () => {
    if (selectedOrders.length === 0) {
      toast.error("Please select at least 1 measurement slip.");
      return;
    }
    await downloadMultipleJobSheetsPDF(selectedOrders);
  };

  const handleBatchPrint = () => {
    if (selectedOrders.length === 0) {
      toast.error("Please select at least 1 measurement slip.");
      return;
    }
    setIsBatchPrintModalOpen(true);
  };

  return (
    <>
      <div className={cn("space-y-4 max-w-7xl mx-auto transition-all", selectedOrderIds.length > 0 ? "pb-44 sm:pb-36" : "pb-24")}>
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "Cormorant Garamond, serif" }}>
              Customer Measurements & Job Slips
            </h1>
            <p className="text-xs text-muted-foreground">
              Select multiple slips to download as a combined page-wise PDF or print batch.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/orders/new"
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
              style={{ background: "hsl(var(--primary))" }}
            >
              + New Order
            </Link>
          </div>
        </div>

        {/* Item Type / Garment Filter Tabs */}
        <div className="bg-card border rounded-xl p-2.5 shadow-sm space-y-1.5" style={{ borderColor: "hsl(var(--border))" }}>
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <span>🏷️</span> Filter Measurements By Garment (આઈટમ પ્રમાણે માપ લિસ્ટ)
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
              id="m-filter-all"
              onClick={() => { setItemTypeFilter("all"); setPage(1); }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 border shadow-sm",
                itemTypeFilter === "all"
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background hover:bg-muted text-foreground border-border"
              )}
            >
              <span>✨ All Garments (બધા માપ)</span>
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
                  id={`m-filter-${typeKey}`}
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

        {/* Search Bar & Multi-select Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">🔍</span>
            <input
              type="text"
              placeholder="Search by customer name, phone, slip no, order no..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border bg-card text-sm outline-none focus:ring-2"
              style={{ borderColor: "hsl(var(--border))" }}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSelectAllPaginated}
              className={cn(
                "px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all shadow-sm",
                isAllPaginatedSelected
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card hover:bg-muted text-foreground border-border"
              )}
            >
              <input
                type="checkbox"
                checked={isAllPaginatedSelected}
                onChange={() => {}}
                className="w-4 h-4 rounded cursor-pointer accent-primary pointer-events-none"
              />
              <span>{isAllPaginatedSelected ? "Deselect Page" : "Select Page"}</span>
            </button>

            {filteredOrders.length > paginatedOrders.length && (
              <button
                type="button"
                onClick={selectAllFiltered}
                className="px-3 py-2.5 rounded-xl border bg-card hover:bg-muted text-foreground border-border text-xs font-semibold shadow-sm"
                title="Select all results across all pages"
              >
                Select All ({filteredOrders.length})
              </button>
            )}
          </div>
        </div>

        {/* Measurements Grid */}
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 rounded-xl border bg-card text-muted-foreground p-8" style={{ borderColor: "hsl(var(--border))" }}>
            <p className="text-4xl mb-2">📐</p>
            <p className="font-semibold text-base text-foreground">No measurements found</p>
            <p className="text-xs mt-1">Try resetting the garment filter or search keyword.</p>
            <button
              onClick={() => { setSearchTerm(""); setItemTypeFilter("all"); }}
              className="mt-3 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedOrders.map((order) => {
              const isSelected = selectedOrderIds.includes(order.id);
              const m = parseMeasurements(order.stitching_measurement_number);
              const slipNo = getCleanSlipNumber(order);
              const itemsSummary = (order.order_items || [])
                .map((i) => `${ITEM_ICONS[i.item_type] || ""} ${ITEM_TYPE_LABELS[i.item_type]}`)
                .join(", ");

              return (
                <div
                  key={order.id}
                  onClick={() => toggleSelectOrder(order.id)}
                  className={cn(
                    "rounded-xl border bg-card shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4 cursor-pointer relative",
                    isSelected && "ring-2 ring-primary border-primary bg-primary/5 shadow-md"
                  )}
                  style={{ borderColor: isSelected ? "hsl(var(--primary))" : "hsl(var(--border))" }}
                >
                  <div>
                    {/* Top Header - Checkbox & Customer Full Name Highlighted Big */}
                    <div className="flex items-start justify-between gap-2 border-b pb-3 mb-3" style={{ borderColor: "hsl(var(--border))" }}>
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        {/* Checkbox */}
                        <div
                          onClick={(e) => toggleSelectOrder(order.id, e)}
                          className="pt-0.5 flex-shrink-0"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="w-5 h-5 rounded cursor-pointer accent-primary"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/orders/${order.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-extrabold text-lg sm:text-xl tracking-tight text-foreground hover:text-primary transition-colors flex items-center gap-1.5 leading-snug group"
                            style={{ fontFamily: "Cormorant Garamond, serif" }}
                          >
                            <span className="text-base flex-shrink-0">👤</span>
                            <span className="truncate group-hover:underline">
                              {order.party?.name || "Unknown Party"}
                            </span>
                          </Link>
                          <div className="flex items-center gap-2 flex-wrap mt-1.5">
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                              Order #{order.order_number}
                            </span>
                            {slipNo && (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                                Slip #: {slipNo}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground flex-shrink-0">
                        {order.order_date ? format(new Date(order.order_date), "dd MMM yyyy") : ""}
                      </span>
                    </div>

                    {/* Customer & Items Summary */}
                    <div className="space-y-1 text-xs">
                      <p className="text-muted-foreground">📞 <span className="text-foreground font-semibold">{order.phone || order.party?.phone || "No Phone"}</span></p>
                      {itemsSummary && (
                        <p className="text-muted-foreground mt-1">
                          👗 <span className="font-semibold text-foreground bg-muted/60 px-1.5 py-0.5 rounded">{itemsSummary}</span>
                        </p>
                      )}
                    </div>

                    {/* Measurements Summary Chips */}
                    <div className="mt-4 pt-3 border-t grid grid-cols-2 gap-2 text-xs" style={{ borderColor: "hsl(var(--border))" }}>
                      {/* Upper */}
                      <div className="bg-muted/50 p-2 rounded-lg space-y-0.5">
                        <p className="font-semibold text-primary">👔 Upper (અપર)</p>
                        <p className="text-muted-foreground">Lambai (લંબાઈ): <span className="font-medium text-foreground">{m.lambai || m.kurta_length || "-"}</span></p>
                        <p className="text-muted-foreground">Chati (છાતી): <span className="font-medium text-foreground">{m.chati || m.chest || "-"}</span></p>
                        <p className="text-muted-foreground">Pet (પેટ): <span className="font-medium text-foreground">{m.pet || m.stomach || "-"}</span></p>
                      </div>
                      {/* Bottom */}
                      <div className="bg-muted/50 p-2 rounded-lg space-y-0.5">
                        <p className="font-semibold text-primary">👖 Bottom (બોટમ)</p>
                        <p className="text-muted-foreground">Lambai (લંબાઈ): <span className="font-medium text-foreground">{m.lambai_bottom || m.pant_length || "-"}</span></p>
                        <p className="text-muted-foreground">Kamber (કમર): <span className="font-medium text-foreground">{m.kamber || m.pant_waist || "-"}</span></p>
                        <p className="text-muted-foreground">Moli (મોરી): <span className="font-medium text-foreground">{m.moli || m.bottom_mori || "-"}</span></p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: "hsl(var(--border))" }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); openDetails(order); }}
                      className="flex-1 py-2 px-3 rounded-lg border text-xs font-semibold hover:bg-muted transition-colors text-center"
                      style={{ borderColor: "hsl(var(--border))" }}
                    >
                      👁️ Details
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadJobSheetAsPDF(order, `Tailor_JobSheet_${order.order_number || order.id}`); }}
                      className="py-2 px-3 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-opacity text-center flex items-center justify-center gap-1 shadow-sm"
                    >
                      <span>📥</span> PDF
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openDetails(order); }}
                      className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90 text-center flex items-center justify-center gap-1 shadow-sm"
                      style={{ background: "hsl(var(--primary))" }}
                    >
                      <span>🖨️</span> Print
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 rounded-xl border bg-card shadow-sm text-xs" style={{ borderColor: "hsl(var(--border))" }}>
            <span className="text-muted-foreground">
              Page {page} of {totalPages} ({filteredOrders.length} slips)
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

      {/* 🌟 Sticky Floating Batch Action Bar (When 1 or more slips are selected) */}
      {selectedOrderIds.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-40 sm:w-max max-w-[96vw] bg-card/95 backdrop-blur-md border-2 border-primary/50 shadow-2xl rounded-2xl p-3 sm:px-5 sm:py-3 flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-6 animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-3 shrink-0 w-full md:w-auto">
            <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground font-black text-sm flex items-center justify-center shadow-sm shrink-0">
              {selectedOrderIds.length}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground leading-tight whitespace-nowrap">
                {selectedOrderIds.length} Measurement Slip{selectedOrderIds.length !== 1 ? "s" : ""} Selected
              </p>
              <p className="text-[11px] text-muted-foreground whitespace-nowrap">
                Download combined multi-page PDF or print all
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end shrink-0">
            <button
              type="button"
              onClick={handleBatchPdfDownload}
              className="flex-1 md:flex-none px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-all whitespace-nowrap"
            >
              <span>📥</span> Download Combined PDF ({selectedOrderIds.length})
            </button>
            <button
              type="button"
              onClick={handleBatchPrint}
              className="px-3.5 py-2 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-all hover:opacity-90 active:scale-95 whitespace-nowrap"
              style={{ background: "hsl(var(--primary))" }}
            >
              <span>🖨️</span> Batch Print
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="p-2 rounded-xl border hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-bold transition-colors shrink-0"
              title="Clear selection"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Single Measurement Detail & Print Modal */}
      {isPrintModalOpen && selectedOrder && (
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
                  Tailor Job Sheet - {selectedOrder.party?.name || selectedOrder.order_number}
                </h2>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => downloadJobSheetAsPDF(selectedOrder, `Tailor_JobSheet_${selectedOrder.order_number || selectedOrder.id}`)}
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
              <PrintableJobSheet order={selectedOrder} />
            </div>
          </div>
        </div>
      )}

      {/* 🌟 Batch Multiple Slips Print Modal */}
      {isBatchPrintModalOpen && selectedOrders.length > 0 && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto print:static print:p-0 print:bg-white">
          <div
            className="bg-card rounded-2xl shadow-2xl max-w-4xl w-full p-3 sm:p-5 flex flex-col max-h-[92vh] sm:max-h-[90vh] my-auto relative print:shadow-none print:p-0 print:m-0 print:w-full print:max-w-none print:bg-white"
            style={{ borderColor: "hsl(var(--border))" }}
          >
            {/* Top Modal Header */}
            <div className="flex items-center justify-between border-b pb-3 mb-2 flex-shrink-0 print:hidden" style={{ borderColor: "hsl(var(--border))" }}>
              <div className="flex items-center gap-1.5 overflow-hidden">
                <span className="text-lg sm:text-xl">📑</span>
                <h2 className="text-xs sm:text-lg font-bold text-foreground truncate" style={{ fontFamily: "Cormorant Garamond, serif" }}>
                  Batch Printing {selectedOrders.length} Tailor Job Sheets (Page-Wise)
                </h2>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleBatchPdfDownload}
                  className="px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1 transition-opacity shadow-sm"
                >
                  <span>📥</span> Download 1 Combined PDF
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); try { window.print(); } catch(err) {} }} onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); try { window.print(); } catch(err) {} }}
                  className="px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-white flex items-center gap-1 hover:opacity-90 transition-opacity shadow-sm"
                  style={{ background: "hsl(var(--primary))" }}
                >
                  <span>🖨️</span> Print All Slips
                </button>
                <button
                  type="button"
                  onClick={() => setIsBatchPrintModalOpen(false)}
                  className="px-2.5 py-1.5 rounded-lg border text-xs sm:text-sm hover:bg-muted font-bold text-muted-foreground transition-colors"
                  style={{ borderColor: "hsl(var(--border))" }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Scrollable Printable Content - Each order on a separate page in print */}
            <div className="flex-1 overflow-y-auto pr-0.5 print:overflow-visible space-y-8 print:space-y-0">
              {selectedOrders.map((ord, idx) => (
                <div key={ord.id} className={cn("border rounded-xl p-2 bg-white print:border-0 print:p-0", idx < selectedOrders.length - 1 && "break-after-page print:break-after-page")}>
                  <div className="text-xs font-bold text-muted-foreground px-4 py-1 border-b mb-2 print:hidden flex items-center justify-between">
                    <span>Slip #{idx + 1} of {selectedOrders.length}: {ord.party?.name || ord.order_number}</span>
                    <span className="text-[10px] bg-muted px-2 py-0.5 rounded">Page {idx + 1}</span>
                  </div>
                  <PrintableJobSheet order={ord} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Standalone Printable Area for Direct Printing */}
      <div className="hidden print:block">
        {selectedOrder && <PrintableJobSheet order={selectedOrder} />}
      </div>
    </>
  );
}
