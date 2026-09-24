"use client";
import { PrintableJobSheet } from "@/components/PrintableJobSheet";
import { BulletPointsList } from "@/components/ui/BulletPoints";
import { useState, useMemo } from "react";
import Link from "next/link";
import { format } from "date-fns";
import type { Order, GarmentMeasurements } from "@/types";
import { parseMeasurements, getCleanSlipNumber, ITEM_TYPE_LABELS } from "@/types";

interface Props {
  initialOrders: Order[];
}

export default function MeasurementsClient({ initialOrders }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
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
      m.pant_waist
    );
  });

  const filteredOrders = ordersWithMeasurements.filter((order) => {
    const q = searchTerm.toLowerCase();
    const partyName = order.party?.name?.toLowerCase() || "";
    const phone = order.phone || order.party?.phone || "";
    const orderNo = order.order_number?.toLowerCase() || "";
    const rawMeasurement = order.stitching_measurement_number?.toLowerCase() || "";
    const m = parseMeasurements(order.stitching_measurement_number);
    const slipNo = m.slip_number?.toLowerCase() || "";

    return (
      partyName.includes(q) ||
      phone.includes(q) ||
      orderNo.includes(q) ||
      rawMeasurement.includes(q) ||
      slipNo.includes(q)
    );
  });

  const openDetails = (order: Order, printMode: boolean = false) => {
    setSelectedOrder(order);
    setIsPrintModalOpen(true);
    if (printMode) {
      setTimeout(() => {
        window.print();
      }, 300);
    }
  };

  const selectedMeasurements: GarmentMeasurements = selectedOrder?.stitching_measurement_number
    ? parseMeasurements(selectedOrder.stitching_measurement_number)
    : {};

  const totalPages = Math.ceil(filteredOrders.length / PAGE_SIZE) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredOrders.slice(start, start + PAGE_SIZE);
  }, [filteredOrders, page]);

  return (
    <>
      <div className="space-y-6 print:hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-bold text-foreground flex items-center gap-2"
            style={{ fontFamily: "Cormorant Garamond, serif" }}
          >
            <span>📏</span> Customer Measurements (માપણી લિસ્ટ)
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            View, inspect & print tailor measurement sheets for all orders
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/orders/new"
            className="px-4 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90 flex items-center gap-2 shadow-sm"
            style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
          >
            <span>➕</span> New Order with Measurement
          </Link>
        </div>
      </div>



      {/* Search Bar */}
      <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center gap-3">
        <span className="text-muted-foreground">🔍</span>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
          placeholder="Search by Customer Name, Phone, Slip #, Order #..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm("")}
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded bg-muted"
          >
            Clear
          </button>
        )}
      </div>



  {/* Measurements Table / Cards */}
      {filteredOrders.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground space-y-3">
          <p className="text-4xl">📏</p>
          <p className="text-base font-medium">No measurement records found</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Create an order with measurement details to view and print measurement slips here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedOrders.map((order) => {
            const m = parseMeasurements(order.stitching_measurement_number);
            const slipNo = getCleanSlipNumber(order);
            const itemsSummary = (order.order_items || [])
              .map((i) => ITEM_TYPE_LABELS[i.item_type])
              .join(", ");

            return (
              <div
                key={order.id}
                className="rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col justify-between space-y-4"
                style={{ borderColor: "hsl(var(--border))" }}
              >
                <div>
                  {/* Top Header */}
                  <div className="flex items-start justify-between gap-2 border-b pb-3 mb-3" style={{ borderColor: "hsl(var(--border))" }}>
                    <div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                        Slip #: {slipNo}
                      </span>
                      <p className="text-xs text-muted-foreground mt-1.5">Order #{order.order_number}</p>
                    </div>
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      {order.order_date ? format(new Date(order.order_date), "dd MMM yyyy") : ""}
                    </span>
                  </div>

                  {/* Customer Info */}
                  <div className="space-y-1">
                    <h3 className="font-bold text-base text-foreground" style={{ fontFamily: "Cormorant Garamond, serif" }}>
                      👤 {order.party?.name || "Unknown Party"}
                    </h3>
                    <p className="text-xs text-muted-foreground">📞 {order.phone || order.party?.phone || "No Phone"}</p>
                    {itemsSummary && (
                      <p className="text-xs text-muted-foreground mt-1">
                        👗 <span className="font-medium text-foreground">{itemsSummary}</span>
                      </p>
                    )}
                  </div>

                  {/* Measurements Summary Chips */}
                  <div className="mt-4 pt-3 border-t grid grid-cols-2 gap-2 text-xs" style={{ borderColor: "hsl(var(--border))" }}>
                    {/* Upper */}
                    <div className="bg-muted/50 p-2 rounded-lg space-y-0.5">
                      <p className="font-semibold text-primary">👔 Upper (ઉપર)</p>
                      <p className="text-muted-foreground">Len (લંબાઈ): <span className="font-medium text-foreground">{m.kurta_length || "-"}</span></p>
                      <p className="text-muted-foreground">Chest (છાતી): <span className="font-medium text-foreground">{m.chest || "-"}</span></p>
                      <p className="text-muted-foreground">Shoulder (શોલ્ડર): <span className="font-medium text-foreground">{m.shoulder || "-"}</span></p>
                    </div>
                    {/* Lower */}
                    <div className="bg-muted/50 p-2 rounded-lg space-y-0.5">
                      <p className="font-semibold text-primary">👖 Lower (નીચે)</p>
                      <p className="text-muted-foreground">Len (લંબાઈ): <span className="font-medium text-foreground">{m.pant_length || "-"}</span></p>
                      <p className="text-muted-foreground">Waist (કમર): <span className="font-medium text-foreground">{m.pant_waist || "-"}</span></p>
                      <p className="text-muted-foreground">Mori (મોરી): <span className="font-medium text-foreground">{m.bottom_mori || "-"}</span></p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: "hsl(var(--border))" }}>
                  <button
                    onClick={() => openDetails(order, false)}
                    className="flex-1 py-2 px-3 rounded-lg border text-xs font-semibold hover:bg-muted transition-colors text-center"
                    style={{ borderColor: "hsl(var(--border))" }}
                  >
                    👁️ Details
                  </button>
                  <button
                    onClick={() => openDetails(order, true)}
                    className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90 text-center flex items-center justify-center gap-1"
                    style={{ background: "hsl(var(--primary))" }}
                  >
                    <span>🖨️</span> Print Sheet
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

      {/* Measurement Detail & Print Modal */}
      {isPrintModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto print:static print:p-0 print:bg-white">
          <div className="bg-card rounded-2xl shadow-2xl max-w-3xl w-full p-6 space-y-6 relative my-8 print:shadow-none print:p-0 print:m-0 print:w-full print:max-w-none print:bg-white">
            {/* Modal Top Actions (Hidden in Print) */}
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

            {/* Printable Job Sheet Content */}
            <PrintableJobSheet order={selectedOrder} />
          </div>
        </div>
      )}
    </div>

    {/* Standalone Printable Area for Direct Printing */}
    <div className="hidden print:block">
      {selectedOrder && <PrintableJobSheet order={selectedOrder} />}
    </div>
    </>
  );
}