"use client";
import { BulletPointsList } from "@/components/ui/BulletPoints";
import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import type { Order, GarmentMeasurements } from "@/types";
import { parseMeasurements, ITEM_TYPE_LABELS } from "@/types";

interface Props {
  initialOrders: Order[];
}

export default function MeasurementsClient({ initialOrders }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Filter orders that have stitching_measurement_number / measurements
  const ordersWithMeasurements = initialOrders.filter((order) => {
    if (!order.stitching_measurement_number) return false;
    const m = parseMeasurements(order.stitching_measurement_number);
    // Check if contains slip or any measurement
    return !!(m.slip_number || m.kurta_length || m.chest || m.pant_length || order.stitching_measurement_number);
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

  return (
    <div className="space-y-6">
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
          onChange={(e) => setSearchTerm(e.target.value)}
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
          {filteredOrders.map((order) => {
            const m = parseMeasurements(order.stitching_measurement_number);
            const slipNo = m.slip_number || order.stitching_measurement_number || "N/A";
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
                      <p className="font-semibold text-primary">👔 Upper</p>
                      <p className="text-muted-foreground">Len: <span className="font-medium text-foreground">{m.kurta_length || "-"}</span></p>
                      <p className="text-muted-foreground">Chest: <span className="font-medium text-foreground">{m.chest || "-"}</span></p>
                      <p className="text-muted-foreground">Shoulder: <span className="font-medium text-foreground">{m.shoulder || "-"}</span></p>
                    </div>
                    {/* Lower */}
                    <div className="bg-muted/50 p-2 rounded-lg space-y-0.5">
                      <p className="font-semibold text-primary">👖 Lower</p>
                      <p className="text-muted-foreground">Len: <span className="font-medium text-foreground">{m.pant_length || "-"}</span></p>
                      <p className="text-muted-foreground">Waist: <span className="font-medium text-foreground">{m.pant_waist || "-"}</span></p>
                      <p className="text-muted-foreground">Mori: <span className="font-medium text-foreground">{m.bottom_mori || "-"}</span></p>
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

      {/* Measurement Detail & Print Modal */}
      {isPrintModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-6 relative my-8 print:shadow-none print:p-0 print:m-0 print:w-full print:max-w-none">

            {/* Modal Top Actions (Hidden in Print) */}
            <div className="flex items-center justify-between border-b pb-4 print:hidden" style={{ borderColor: "hsl(var(--border))" }}>
              <div className="flex items-center gap-2">
                <span className="text-xl">📐</span>
                <h2 className="text-xl font-bold" style={{ fontFamily: "Cormorant Garamond, serif" }}>
                  Measurement Sheet
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2 hover:opacity-90"
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

            {/* Printable Content Area */}
            <div id="printable-measurement-sheet" className="space-y-6">
              {/* Header Slip Branding */}
              <div className="flex items-start justify-between border-b pb-4" style={{ borderColor: "hsl(var(--border))" }}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white p-1 border shadow-sm flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo.png" alt="Aahman" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold" style={{ fontFamily: "Cormorant Garamond, serif" }}>
                      Aahman Ethnic Wear
                    </h1>
                    <p className="text-xs text-muted-foreground">Tailor Stitching & Measurement Slip</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-primary">
                    Slip No: {selectedMeasurements.slip_number || selectedOrder.stitching_measurement_number || "N/A"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Order #: {selectedOrder.order_number}</div>
                  <div className="text-xs text-muted-foreground">
                    Date: {selectedOrder.order_date ? format(new Date(selectedOrder.order_date), "dd/MM/yyyy") : ""}
                  </div>
                </div>
              </div>

              {/* Customer Details Box */}
              <div className="bg-muted/40 rounded-xl p-4 grid grid-cols-2 gap-3 text-xs border" style={{ borderColor: "hsl(var(--border))" }}>
                <div>
                  <span className="text-muted-foreground uppercase font-medium">Customer Name:</span>
                  <p className="font-bold text-sm text-foreground">{selectedOrder.party?.name || "N/A"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground uppercase font-medium">Phone Number:</span>
                  <p className="font-bold text-sm text-foreground">{selectedOrder.phone || selectedOrder.party?.phone || "N/A"}</p>
                </div>
                {selectedOrder.delivery_date && (
                  <div>
                    <span className="text-muted-foreground uppercase font-medium">Delivery Date:</span>
                    <p className="font-semibold text-orange-600">
                      {format(new Date(selectedOrder.delivery_date), "dd MMM yyyy")}
                    </p>
                  </div>
                )}
                {selectedOrder.vyapar_order_number && (
                  <div>
                    <span className="text-muted-foreground uppercase font-medium">Vyapar No:</span>
                    <p className="font-semibold">{selectedOrder.vyapar_order_number}</p>
                  </div>
                )}
              </div>

              {/* Upper Body Measurement Grid */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5 border-b pb-1">
                  <span>👔</span> Upper Body Garment (Kurta / Koti / Blazer / Sherwani)
                </h3>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <MeasurementCell label="Length (લંબાઈ)" value={selectedMeasurements.kurta_length} />
                  <MeasurementCell label="Chest (છાતી)" value={selectedMeasurements.chest} />
                  <MeasurementCell label="Waist (કમર)" value={selectedMeasurements.waist} />
                  <MeasurementCell label="Hips (સીટ)" value={selectedMeasurements.hips} />
                  <MeasurementCell label="Shoulder (શોલ્ડર)" value={selectedMeasurements.shoulder} />
                  <MeasurementCell label="Sleeve (બાઈ)" value={selectedMeasurements.sleeve_length} />
                  <MeasurementCell label="Sleeve Opening (બાઈ મોરી)" value={selectedMeasurements.sleeve_opening} />
                  <MeasurementCell label="Collar (કોલર)" value={selectedMeasurements.collar_neck} />
                  <MeasurementCell label="Biceps (મુંઢો)" value={selectedMeasurements.biceps} />
                </div>
              </div>

              {/* Lower Body Measurement Grid */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5 border-b pb-1">
                  <span>👖</span> Lower Body Garment (Pant / Pyjama)
                </h3>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <MeasurementCell label="Pant Length (લંબાઈ)" value={selectedMeasurements.pant_length} />
                  <MeasurementCell label="Pant Waist (કમર)" value={selectedMeasurements.pant_waist} />
                  <MeasurementCell label="Seat / Hips (સીટ)" value={selectedMeasurements.pant_hips} />
                  <MeasurementCell label="Thigh (ઝાંગ)" value={selectedMeasurements.thigh} />
                  <MeasurementCell label="Knee (ઘૂંટણ)" value={selectedMeasurements.knee} />
                  <MeasurementCell label="Ganlo (ગંદલો)" value={selectedMeasurements.ganlo} />
                  <MeasurementCell label="Galo (ગાળો)" value={selectedMeasurements.galo} />
                  <MeasurementCell label="Bottom Mori (મોરી)" value={selectedMeasurements.bottom_mori} />
                </div>
              </div>



              {/* Reference Images & Attachments */}
              {selectedOrder.attachments && selectedOrder.attachments.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-primary uppercase tracking-wider border-b pb-1 flex items-center gap-1.5">
                    <span>📸</span> Reference Images ({selectedOrder.attachments.length})
                  </h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-xs">
                    {selectedOrder.attachments.map((att) => (
                      <div key={att.id} className="border rounded-lg p-1.5 bg-card text-center space-y-1" style={{ borderColor: "hsl(var(--border))" }}>
                        <div className="w-full h-20 rounded bg-black/5 overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={att.file_url} alt={att.file_name || "Ref"} className="w-full h-full object-cover" />
                        </div>
                        <p className="text-[10px] font-medium truncate text-foreground">{att.file_name || "Reference"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Design & Fabric Notes */}
              {selectedOrder.notes && (
                <div className="space-y-1.5 border-t pt-2" style={{ borderColor: "hsl(var(--border))" }}>
                  <h3 className="text-xs font-bold text-primary uppercase tracking-wider border-b pb-1 flex items-center gap-1.5">
                    <span>📋</span> Fabric & Design Points (મટીરીયલ અને ડિઝાઈન પોઈન્ટ્સ)
                  </h3>
                  <div className="bg-muted/40 p-3 rounded-lg border" style={{ borderColor: "hsl(var(--border))" }}>
                    <BulletPointsList text={selectedOrder.notes} />
                  </div>
                </div>
              )}

              {/* Ordered Items Summary Table */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider border-b pb-1">
                  Order Items Summary
                </h3>
                <div className="border rounded-lg overflow-hidden text-xs" style={{ borderColor: "hsl(var(--border))" }}>
                  <table className="w-full text-left">
                    <thead className="bg-muted font-semibold text-muted-foreground border-b" style={{ borderColor: "hsl(var(--border))" }}>
                      <tr>
                        <th className="p-2">Item Type</th>
                        <th className="p-2">Qty</th>
                        <th className="p-2">Fabric Details</th>
                        <th className="p-2">Special Instructions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: "hsl(var(--border))" }}>
                      {(selectedOrder.order_items || []).map((item, idx) => (
                        <tr key={idx}>
                          <td className="p-2 font-medium">{ITEM_TYPE_LABELS[item.item_type]}</td>
                          <td className="p-2">{item.quantity}</td>
                          <td className="p-2">{item.fabric_details || "-"}</td>
                          <td className="p-2">{item.special_instructions || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Print Footer */}
              <div className="pt-4 border-t flex justify-between items-end text-xs text-muted-foreground" style={{ borderColor: "hsl(var(--border))" }}>
                <div>
                  <p>Aahman Ethnic Wear OMS</p>
                  <p className="text-[10px]">Printed on {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
                </div>
                <div className="text-right font-medium">
                  Tailor Master Signature: ___________________
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

function MeasurementCell({ label, value }: { label: string; value?: string }) {
  return (
    <div className="border rounded-lg p-2 bg-card text-center space-y-0.5" style={{ borderColor: "hsl(var(--border))" }}>
      <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
      <p className="font-bold text-sm text-foreground">{value && value.trim() ? value : "—"}</p>
    </div>
  );
}
