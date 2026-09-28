"use client";

import { useState } from "react";
import ImageLightbox from "@/components/ui/ImageLightbox";
import { BulletPointsList } from "@/components/ui/BulletPoints";
import { format } from "date-fns";
import type { Order } from "@/types";
import { parseMeasurements, getCleanSlipNumber, ITEM_TYPE_LABELS, getAttachmentCategory } from "@/types";

export function PrintableJobSheet({ order }: { order: Order }) {
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
    <div className="w-full max-w-[800px] mx-auto p-2 sm:p-6 bg-white text-black space-y-3 font-sans text-xs">
      {/* 1. Shop Header */}
      <div className="border-b-2 border-black pb-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
        <div>
          <h1
            className="text-xl sm:text-3xl font-extrabold uppercase tracking-tight text-black"
            style={{ fontFamily: "Cormorant Garamond, serif" }}
          >
            Aahman Ethnic Wear
          </h1>
          <p className="text-[10px] sm:text-[11px] font-semibold text-gray-700">
            Tailor Job Sheet & Customer Measurement Slip
          </p>
        </div>
        <div className="text-center sm:text-right border-t sm:border-t-0 pt-1.5 sm:pt-0 w-full sm:w-auto border-black">
          <div className="inline-block border-2 border-black px-2.5 py-0.5 sm:py-1 rounded bg-gray-50">
            <p className="text-[9px] sm:text-[10px] font-bold text-gray-600 uppercase">Measurement Slip #</p>
            <p className="text-sm sm:text-lg font-black text-blue-950 tracking-wider">
              {slipNo || order.order_number}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Order & Customer Info Header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border border-black p-2 rounded-sm bg-gray-50/70">
        <div>
          <p className="text-[9px] sm:text-[10px] font-bold text-gray-600 uppercase">Order Number</p>
          <p className="font-extrabold text-xs sm:text-sm">{order.order_number}</p>
        </div>
        <div>
          <p className="text-[9px] sm:text-[10px] font-bold text-gray-600 uppercase">Vyapar Order #</p>
          <p className="font-extrabold text-xs sm:text-sm">{order.vyapar_order_number || "—"}</p>
        </div>
        <div>
          <p className="text-[9px] sm:text-[10px] font-bold text-gray-600 uppercase">Customer / Party Name</p>
          <p className="font-extrabold text-xs sm:text-sm truncate">{order.party?.name || "—"}</p>
        </div>
        <div>
          <p className="text-[9px] sm:text-[10px] font-bold text-gray-600 uppercase">Phone Number</p>
          <p className="font-extrabold text-xs sm:text-sm">{order.phone || order.party?.phone || "—"}</p>
        </div>
        <div>
          <p className="text-[9px] sm:text-[10px] font-bold text-gray-600 uppercase">Order Date</p>
          <p className="font-semibold text-xs">{order.order_date ? format(new Date(order.order_date), "dd/MM/yyyy") : "—"}</p>
        </div>
        <div>
          <p className="text-[9px] sm:text-[10px] font-bold text-gray-600 uppercase">Delivery Date</p>
          <p className="font-bold text-red-700 text-xs">{order.delivery_date ? format(new Date(order.delivery_date), "dd/MM/yyyy") : "—"}</p>
        </div>
        <div>
          <p className="text-[9px] sm:text-[10px] font-bold text-gray-600 uppercase">Order Status</p>
          <p className="font-bold uppercase text-[10px] sm:text-[11px]">{order.status}</p>
        </div>
        <div>
          <p className="text-[9px] sm:text-[10px] font-bold text-gray-600 uppercase">Total Items</p>
          <p className="font-bold text-xs sm:text-sm">{order.order_items?.length || 0} Items</p>
        </div>
      </div>

      {/* 3. Measurements Section (Upper & Bottom Garment) */}
      <div className="space-y-2.5">
        {/* Upper Body Garment Table */}
        <div className="border border-black rounded-sm overflow-hidden">
          <div className="bg-gray-100 border-b border-black px-2.5 py-1 font-bold text-[11px] uppercase flex flex-wrap items-center justify-between gap-1">
            <span>👔 Upper Body Measurements (અપર બોડી - Kurta / Koti / Blazer)</span>
            <span className="text-[9px] font-normal text-gray-600">Upper Body</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-0 divide-x divide-y divide-black text-center text-xs">
            <PrintCell label="1) Lambai (લંબાઈ)" value={m.lambai} />
            <PrintCell label="2) Bai (બાઈ)" value={m.bai} />
            <PrintCell label="3) Solder (સોલ્ડર)" value={m.solder} />
            <PrintCell label="4) Chati (છાતી)" value={m.chati} />
            <PrintCell label="5) Cap (કેપ)" value={m.cap} />
            <PrintCell label="6) Coller (કોલર)" value={m.coller} />
          </div>
        </div>

        {/* Bottom Garment Table */}
        <div className="border border-black rounded-sm overflow-hidden">
          <div className="bg-gray-100 border-b border-black px-2.5 py-1 font-bold text-[11px] uppercase flex flex-wrap items-center justify-between gap-1">
            <span>👖 Bottom Garment Measurements (બોટમ - Pant / Pyjama)</span>
            <span className="text-[9px] font-normal text-gray-600">Bottom</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-0 divide-x divide-y divide-black text-center text-xs">
            <PrintCell label="1) Lambai (લંબાઈ)" value={m.lambai_bottom} />
            <PrintCell label="2) Kamber (કમર)" value={m.kamber} />
            <PrintCell label="3) Sheet (સીટ)" value={m.sheet} />
            <PrintCell label="4) Jang (ઝાંગ)" value={m.jang} />
            <PrintCell label="5) Moli (મોરી)" value={m.moli} />
            <PrintCell label="6) Kistak (કિસ્તક)" value={m.kistak} />
          </div>
        </div>
      </div>

      {/* 4. Ordered Items Table */}
      {order.order_items && order.order_items.length > 0 && (
        <div className="border border-black rounded-sm overflow-x-auto">
          <div className="bg-gray-100 border-b border-black px-2.5 py-1 font-bold text-[11px] uppercase min-w-[450px]">
            👗 Ordered Items Summary ({order.order_items.length})
          </div>
          <table className="w-full text-left text-xs border-collapse min-w-[450px]">
            <thead>
              <tr className="bg-gray-50 border-b border-black text-[10px] font-bold text-gray-800 uppercase">
                <th className="p-1 border-r border-black w-8 text-center">#</th>
                <th className="p-1 border-r border-black">Item Type</th>
                <th className="p-1 border-r border-black w-10 text-center">Qty</th>
                <th className="p-1 border-r border-black">Fabric Party</th>
                <th className="p-1">Fabric Details & Special Instructions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {order.order_items.map((item, idx) => (
                <tr key={item.id || idx} className="align-top">
                  <td className="p-1 border-r border-black text-center font-bold">{idx + 1}</td>
                  <td className="p-1 border-r border-black font-bold text-black">
                    {ITEM_TYPE_LABELS[item.item_type]}
                  </td>
                  <td className="p-1 border-r border-black text-center font-bold">{item.quantity}</td>
                  <td className="p-1 border-r border-black font-medium">{item.fabric_party?.name || "—"}</td>
                  <td className="p-1 space-y-0.5">
                    {item.fabric_details && (
                      <div><span className="font-semibold text-gray-700">Fabric: </span>{item.fabric_details}</div>
                    )}
                    {item.special_instructions && (
                      <div><span className="font-semibold text-gray-700">Instructions: </span>{item.special_instructions}</div>
                    )}
                    {item.notes && (
                      <div><span className="font-semibold text-gray-700">Notes: </span>{item.notes}</div>
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
            📋 Fabric & Design Points (મટીરીયલ અને ડિઝાઈન પોઈન્ટ્સ)
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
            🧶 Fabric & Material Samples ({fabricAttachments.length})
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
            📸 Design & Style Reference Images ({referenceAttachments.length})
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

      {/* 7. Signatures & Footer Verification */}
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
            <p className="text-[9px] sm:text-[10px] text-gray-700 uppercase font-bold">Tailor Master Sign</p>
          </div>
          <div>
            <div className="w-24 sm:w-36 border-b border-black mb-1"></div>
            <p className="text-[9px] sm:text-[10px] text-gray-700 uppercase font-bold">Customer Sign</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrintCell({ label, value }: { label: string; value?: string }) {
  return (
    <div className="p-1 sm:p-1.5 bg-white">
      <div className="text-[9px] sm:text-[10px] font-bold text-gray-600 uppercase">{label}</div>
      <div className="text-xs sm:text-sm font-black text-black mt-0.5">
        {value && value.trim() ? value : "—"}
      </div>
    </div>
  );
}
