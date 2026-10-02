"use client";

import { useState } from "react";
import ImageLightbox from "@/components/ui/ImageLightbox";
import { BulletPointsList } from "@/components/ui/BulletPoints";
import { format } from "date-fns";
import type { Order } from "@/types";
import { parseMeasurements, getCleanSlipNumber, ITEM_TYPE_LABELS, getAttachmentCategory } from "@/types";
import { downloadJobSheetAsPDF } from "@/lib/downloadPdf";

const ITEM_TYPE_LABELS_GU: Record<string, string> = {
  kurta: "કુર્તા (Kurta)",
  koti: "કોટી (Koti)",
  kurta_koti: "કુર્તા + કોટી (Kurta + Koti)",
  pant: "પેન્ટ / પાયજામા (Pant)",
  blazer: "બ્લેઝર (Blazer)",
  jacket: "જેકેટ (Jacket)",
  indo_western: "ઈન્ડો વેસ્ટર્ન (Indo Western)",
  jodhpuri: "જોધપુરી (Jodhpuri)",
};

const STATUS_LABELS_GU: Record<string, string> = {
  active: "● Active (ચાલુ)",
  delivered: "✓ Delivered (ડીલીવર)",
  cancelled: "✕ Cancelled (કેન્સલ)",
};

export function PrintableJobSheet({ order, showActions = false }: { order: Order; showActions?: boolean }) {
  const fabricAttachments = (order.attachments || []).filter((a) => {
    const c = getAttachmentCategory(a);
    return c === "fabric" || c === "color" || c === "material";
  });
  const referenceAttachments = (order.attachments || []).filter((a) => {
    const c = getAttachmentCategory(a);
    return c === "reference";
  });
  const allAttachments = [...fabricAttachments, ...referenceAttachments];
  const m = parseMeasurements(order.stitching_measurement_number);
  const slipNo = getCleanSlipNumber(order);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <div id={`printable-job-sheet-${order.id}`} className="w-full max-w-[800px] mx-auto p-2 sm:p-6 bg-white text-black space-y-3 font-sans text-xs">
      {showActions && (
        <div className="flex items-center justify-end gap-2 pb-2 border-b border-gray-200 print:hidden">
          <button
            type="button"
            onClick={() => downloadJobSheetAsPDF(order, `Tailor_JobSheet_${order.order_number || order.id}`)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm transition-all"
          >
            <span>📥</span> Download PDF
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-black hover:bg-gray-800 text-white flex items-center gap-1.5 shadow-sm transition-all"
          >
            <span>🖨️</span> Print Sheet
          </button>
        </div>
      )}

      {/* 1. Shop Header */}
      <div className="border-b-2 border-black pb-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
        <div>
          <h1
            className="text-xl sm:text-3xl font-extrabold uppercase tracking-tight text-black"
            style={{ fontFamily: "Cormorant Garamond, serif" }}
          >
            Aahman Ethnic Wear
          </h1>
          <p className="text-[10px] sm:text-xs font-bold text-gray-700 tracking-wide mt-0.5">
            PREMIUM MEN'S ETHNIC WEAR & BESPOKE TAILORING (મેન્સ એથનિક વિયર)
          </p>
          <p className="text-[9px] text-gray-600 mt-0.5">
            29, 1st Floor, Archana Eco Industry, Simada Check Post, Surat • 📞 +91 70484 75024
          </p>
        </div>
        <div className="flex flex-row sm:flex-col items-center sm:items-end gap-1.5">
          <div className="bg-gray-100 border border-black px-3 py-1 text-center rounded-sm">
            <p className="text-[9px] sm:text-[10px] font-bold text-gray-700 uppercase">
              Measurement Slip # (માપ કાપલી નં)
            </p>
            <p className="text-sm sm:text-lg font-black text-blue-950 tracking-wider">
              {slipNo || order.order_number}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Order & Customer Info Header with Gujarati Labels */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border border-black p-2 rounded-sm bg-gray-50/70">
        <div>
          <p className="text-[9px] sm:text-[10px] font-bold text-gray-700 uppercase">Order # (ઓર્ડર નંબર)</p>
          <p className="font-extrabold text-xs sm:text-sm">{order.order_number}</p>
        </div>
        <div>
          <p className="text-[9px] sm:text-[10px] font-bold text-gray-700 uppercase">Vyapar # (વેપાર ઓર્ડર નં)</p>
          <p className="font-extrabold text-xs sm:text-sm">{order.vyapar_order_number || "—"}</p>
        </div>
        <div>
          <p className="text-[9px] sm:text-[10px] font-bold text-gray-700 uppercase">Customer (પાર્ટી નામ)</p>
          <p className="font-extrabold text-xs sm:text-sm truncate">{order.party?.name || "—"}</p>
        </div>
        <div>
          <p className="text-[9px] sm:text-[10px] font-bold text-gray-700 uppercase">Phone (મોબાઈલ નંબર)</p>
          <p className="font-extrabold text-xs sm:text-sm">{order.phone || order.party?.phone || "—"}</p>
        </div>
        <div>
          <p className="text-[9px] sm:text-[10px] font-bold text-gray-700 uppercase">Order Date (ઓર્ડર તારીખ)</p>
          <p className="font-semibold text-xs">{order.order_date ? format(new Date(order.order_date), "dd/MM/yyyy") : "—"}</p>
        </div>
        <div>
          <p className="text-[9px] sm:text-[10px] font-bold text-gray-700 uppercase">Delivery (ડિલિવરી તારીખ)</p>
          <p className="font-bold text-red-700 text-xs">{order.delivery_date ? format(new Date(order.delivery_date), "dd/MM/yyyy") : "—"}</p>
        </div>
        <div>
          <p className="text-[9px] sm:text-[10px] font-bold text-gray-700 uppercase">Status (ઓર્ડર સ્ટેટસ)</p>
          <p className="font-bold uppercase text-[10px] sm:text-[11px]">{STATUS_LABELS_GU[order.status] || order.status}</p>
        </div>
        <div>
          <p className="text-[9px] sm:text-[10px] font-bold text-gray-700 uppercase">Total Items (કુલ નંગ)</p>
          <p className="font-bold text-xs sm:text-sm">{order.order_items?.length || 0} Items (નંગ)</p>
        </div>
      </div>

      {/* 3. Measurements Section (Upper & Bottom Garment with Gujarati Labels) */}
      <div className="space-y-2.5">
        {/* Upper Body Garment Table */}
        <div className="border border-black rounded-sm overflow-hidden">
          <div className="bg-gray-100 border-b border-black px-2.5 py-1 font-bold text-[11px] uppercase flex flex-wrap items-center justify-between gap-1">
            <span>👔 Upper Body Measurements (અપર બોડી માપ - Kurta / Koti / Blazer)</span>
            <span className="text-[9px] font-bold text-gray-700">ઉપરના કપડાં</span>
          </div>
          <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
            <tbody>
              <tr className="border-b border-black">
                <td className="p-1 bg-gray-50 border-r border-black text-center text-[9px] font-bold text-gray-700 uppercase align-middle">1) Lambai<br/>(લંબાઈ)</td>
                <td className="p-2 bg-white border-r-2 border-black text-center text-sm font-black text-black align-middle">{m.lambai || m.kurta_length || "—"}</td>
                <td className="p-1 bg-gray-50 border-r border-black text-center text-[9px] font-bold text-gray-700 uppercase align-middle">2) Bai<br/>(બાઈ)</td>
                <td className="p-2 bg-white border-r-2 border-black text-center text-sm font-black text-black align-middle">{m.bai || m.sleeve_length || "—"}</td>
                <td className="p-1 bg-gray-50 border-r border-black text-center text-[9px] font-bold text-gray-700 uppercase align-middle">3) Solder<br/>(સોલ્ડર)</td>
                <td className="p-2 bg-white border-r-2 border-black text-center text-sm font-black text-black align-middle">{m.solder || m.shoulder || "—"}</td>
                <td className="p-1 bg-gray-50 border-r border-black text-center text-[9px] font-bold text-gray-700 uppercase align-middle">4) Chati<br/>(છાતી)</td>
                <td className="p-2 bg-white text-center text-sm font-black text-black align-middle">{m.chati || m.chest || "—"}</td>
              </tr>
              <tr>
                <td className="p-1 bg-gray-50 border-r border-black text-center text-[9px] font-bold text-gray-700 uppercase align-middle">5) Pet<br/>(પેટ)</td>
                <td className="p-2 bg-white border-r-2 border-black text-center text-sm font-black text-black align-middle">{m.pet || m.stomach || "—"}</td>
                <td className="p-1 bg-gray-50 border-r border-black text-center text-[9px] font-bold text-gray-700 uppercase align-middle">6) Sheet<br/>(સીટ)</td>
                <td className="p-2 bg-white border-r-2 border-black text-center text-sm font-black text-black align-middle">{m.sheet_upper || m.hips || "—"}</td>
                <td className="p-1 bg-gray-50 border-r border-black text-center text-[9px] font-bold text-gray-700 uppercase align-middle">7) Cuff<br/>(કફ)</td>
                <td className="p-2 bg-white border-r-2 border-black text-center text-sm font-black text-black align-middle">{m.cap || "—"}</td>
                <td className="p-1 bg-gray-50 border-r border-black text-center text-[9px] font-bold text-gray-700 uppercase align-middle">8) Coller<br/>(કોલર)</td>
                <td className="p-2 bg-white text-center text-sm font-black text-black align-middle">{m.coller || "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Bottom Garment Table */}
        <div className="border border-black rounded-sm overflow-hidden">
          <div className="bg-gray-100 border-b border-black px-2.5 py-1 font-bold text-[11px] uppercase flex flex-wrap items-center justify-between gap-1">
            <span>👖 Bottom Garment Measurements (બોટમ માપ - Pant / Pyjama)</span>
            <span className="text-[9px] font-bold text-gray-700">નીચેના કપડાં</span>
          </div>
          <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
            <tbody>
              <tr className="border-b border-black">
                <td className="p-1 bg-gray-50 border-r border-black text-center text-[9px] font-bold text-gray-700 uppercase align-middle">1) Lambai<br/>(લંબાઈ)</td>
                <td className="p-2 bg-white border-r-2 border-black text-center text-sm font-black text-black align-middle">{m.lambai_bottom || m.pant_length || "—"}</td>
                <td className="p-1 bg-gray-50 border-r border-black text-center text-[9px] font-bold text-gray-700 uppercase align-middle">2) Kamber<br/>(કમર)</td>
                <td className="p-2 bg-white border-r-2 border-black text-center text-sm font-black text-black align-middle">{m.kamber || m.pant_waist || m.waist || "—"}</td>
                <td className="p-1 bg-gray-50 border-r border-black text-center text-[9px] font-bold text-gray-700 uppercase align-middle">3) Sheet<br/>(સીટ)</td>
                <td className="p-2 bg-white text-center text-sm font-black text-black align-middle">{m.sheet || m.hips || "—"}</td>
              </tr>
              <tr>
                <td className="p-1 bg-gray-50 border-r border-black text-center text-[9px] font-bold text-gray-700 uppercase align-middle">4) Jang<br/>(ઝાંગ)</td>
                <td className="p-2 bg-white border-r-2 border-black text-center text-sm font-black text-black align-middle">{m.jang || "—"}</td>
                <td className="p-1 bg-gray-50 border-r border-black text-center text-[9px] font-bold text-gray-700 uppercase align-middle">5) Moli<br/>(મોરી)</td>
                <td className="p-2 bg-white border-r-2 border-black text-center text-sm font-black text-black align-middle">{m.moli || m.bottom_mori || "—"}</td>
                <td className="p-1 bg-gray-50 border-r border-black text-center text-[9px] font-bold text-gray-700 uppercase align-middle">6) Kistak<br/>(કિસ્તક)</td>
                <td className="p-2 bg-white text-center text-sm font-black text-black align-middle">{m.kistak || "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Ordered Items Summary */}
      {order.order_items && order.order_items.length > 0 && (
        <div className="border border-black rounded-sm overflow-hidden">
          <div className="bg-gray-100 border-b border-black px-2.5 py-1 font-bold text-[11px] uppercase text-black">
            👗 Ordered Items Summary (ઓર્ડર કરેલ આઈટમ વિગત - {order.order_items.length} નંગ)
          </div>
          <table className="w-full text-left text-xs border-collapse min-w-[450px]">
            <thead>
              <tr className="bg-gray-50 border-b border-black text-[10px] font-bold text-gray-800 uppercase">
                <th className="p-1 border-r border-black w-8 text-center">#</th>
                <th className="p-1 border-r border-black">Item Type (આઈટમ)</th>
                <th className="p-1 border-r border-black w-10 text-center">Qty (નંગ)</th>
                <th className="p-1 border-r border-black">Fabric Party (ફેબ્રિક પાર્ટી)</th>
                <th className="p-1">Fabric Details & Special Instructions (કાપડ અને ખાસ સૂચના)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {order.order_items.map((item, idx) => (
                <tr key={item.id || idx} className="align-top">
                  <td className="p-1 border-r border-black text-center font-bold">{idx + 1}</td>
                  <td className="p-1 border-r border-black font-bold text-black">
                    {ITEM_TYPE_LABELS_GU[item.item_type] || ITEM_TYPE_LABELS[item.item_type] || item.item_type}
                  </td>
                  <td className="p-1 border-r border-black text-center font-bold">{item.quantity || 1}</td>
                  <td className="p-1 border-r border-black font-medium">{item.fabric_party?.name || "—"}</td>
                  <td className="p-1 space-y-0.5">
                    {item.fabric_details && (
                      <div><span className="font-semibold text-gray-700">Fabric (કાપડ): </span>{item.fabric_details}</div>
                    )}
                    {item.special_instructions && (
                      <div><span className="font-semibold text-gray-700">Instructions (સૂચના): </span>{item.special_instructions}</div>
                    )}
                    {item.notes && (
                      <div><span className="font-semibold text-gray-700">Notes (નોંધ): </span>{item.notes}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. Fabric & Design Notes / Points */}
      {order.notes && (
        <div className="border border-black rounded-sm p-2 bg-gray-50/50 space-y-1">
          <div className="font-bold text-[11px] uppercase border-b border-gray-300 pb-1 text-black">
            📋 Fabric & Design Points (મટીરીયલ અને ડિઝાઈન પોઈન્ટ્સ / ખાસ સૂચના)
          </div>
          <div className="text-xs pt-0.5 pl-1.5">
            <BulletPointsList text={order.notes} />
          </div>
        </div>
      )}

      {/* 6A. Fabric & Material Samples Grid */}
      {fabricAttachments.length > 0 && (
        <div className="border border-black rounded-sm p-2 space-y-1">
          <div className="font-bold text-[11px] uppercase border-b border-gray-300 pb-1">
            🧶 Fabric & Material Samples (કાપડના સેમ્પલ ફોટા - {fabricAttachments.length})
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {fabricAttachments.map((att, idx) => {
              const globalIdx = allAttachments.findIndex((a) => a === att);
              return (
                <div
                  key={att.id || idx}
                  onClick={() => setLightboxIndex(globalIdx !== -1 ? globalIdx : idx)}
                  className="border border-gray-400 p-1 text-center bg-white cursor-pointer hover:border-black hover:shadow-sm transition-all"
                  title="Click to view full screen"
                >
                  <div className="w-full h-16 sm:h-20 bg-gray-100 flex items-center justify-center overflow-hidden relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={att.file_url} alt={att.file_name || "Fabric Sample"} className="w-full h-full object-contain" />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold">
                      🔍 Full Screen
                    </div>
                  </div>
                  <p className="text-[9px] font-semibold truncate mt-0.5">{att.file_name || "Fabric Sample"}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6B. Design & Style Reference Images Grid */}
      {referenceAttachments.length > 0 && (
        <div className="border border-black rounded-sm p-2 space-y-1">
          <div className="font-bold text-[11px] uppercase border-b border-gray-300 pb-1">
            📸 Design & Style Reference Images (ડિઝાઈન રેફરન્સ ફોટા - {referenceAttachments.length})
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {referenceAttachments.map((att, idx) => {
              const globalIdx = allAttachments.findIndex((a) => a === att);
              return (
                <div
                  key={att.id || idx}
                  onClick={() => setLightboxIndex(globalIdx !== -1 ? globalIdx : idx)}
                  className="border border-gray-400 p-1 text-center bg-white cursor-pointer hover:border-black hover:shadow-sm transition-all"
                  title="Click to view full screen"
                >
                  <div className="w-full h-16 sm:h-20 bg-gray-100 flex items-center justify-center overflow-hidden relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={att.file_url} alt={att.file_name || "Ref"} className="w-full h-full object-contain" />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold">
                      🔍 Full Screen
                    </div>
                  </div>
                  <p className="text-[9px] font-semibold truncate mt-0.5">{att.file_name || "Design Ref"}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full Screen Image Lightbox */}
      {lightboxIndex !== null && (
        <ImageLightbox
          images={allAttachments.map((att) => ({
            url: att.file_url,
            title: att.file_name || "Attachment Image",
          }))}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={(idx) => setLightboxIndex(idx)}
        />
      )}

      {/* 7. Signatures & Footer Verification with Gujarati Labels */}
      <div className="pt-3 border-t-2 border-black flex flex-col sm:flex-row items-center sm:items-end justify-between gap-3 text-xs font-semibold">
        <div>
          <p className="font-bold">Aahman Ethnic Wear OMS</p>
          <p className="text-[9px] sm:text-[10px] text-gray-600 font-normal">
            Printed on: {format(new Date(), "dd/MM/yyyy HH:mm")}
          </p>
        </div>
        <div className="flex gap-4 sm:gap-8 text-center w-full sm:w-auto justify-between sm:justify-end">
          <div>
            <div className="w-24 sm:w-36 border-b border-black mb-1"></div>
            <p className="text-[9px] sm:text-[10px] text-gray-700 uppercase font-bold">Tailor Master Sign (ટેલર માસ્ટર સહી)</p>
          </div>
          <div>
            <div className="w-24 sm:w-36 border-b border-black mb-1"></div>
            <p className="text-[9px] sm:text-[10px] text-gray-700 uppercase font-bold">Customer Sign (ગ્રાહક સહી)</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrintCell({ label, value }: { label: string; value?: string }) {
  return (
    <div className="p-1 sm:p-1.5 bg-white text-center flex flex-col items-center justify-center min-h-[52px]">
      <div className="text-[9px] sm:text-[10px] font-bold text-gray-700 uppercase leading-tight text-center">{label}</div>
      <div className="text-xs sm:text-sm font-black text-black mt-0.5 text-center">
        {value && value.trim() ? value : "—"}
      </div>
    </div>
  );
}
