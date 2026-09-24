import { format } from "date-fns";
import type { Order } from "@/types";
import { parseMeasurements, ITEM_TYPE_LABELS } from "@/types";
import { BulletPointsList } from "@/components/ui/BulletPoints";

interface PrintableJobSheetProps {
  order: Order;
}

export function PrintableJobSheet({ order }: PrintableJobSheetProps) {
  const m = parseMeasurements(order.stitching_measurement_number);

  return (
    <div className="p-4 bg-white text-black text-xs font-sans space-y-4 printable-job-sheet">
      {/* 1. Header Slip & Branding */}
      <div className="flex items-center justify-between border-b-2 border-black pb-3">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 border border-black rounded p-1 flex items-center justify-center bg-gray-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Aahman" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-xl font-bold uppercase tracking-wider text-black font-serif">
              AAHMAN ETHNIC
            </h1>
          </div>
        </div>
        <div className="text-right border-l-2 border-black pl-4">
          <div className="text-base font-extrabold text-black">
            SLIP NO: {m.slip_number || order.order_number}
          </div>
          <div className="text-xs font-bold text-gray-800">ORDER NO: {order.order_number}</div>
          {order.vyapar_order_number && (
            <div className="text-xs font-semibold text-gray-700">Vyapar No: {order.vyapar_order_number}</div>
          )}
          <div className="text-[10px] text-gray-600 mt-0.5">
            Date: {order.order_date ? format(new Date(order.order_date), "dd/MM/yyyy") : format(new Date(order.created_at), "dd/MM/yyyy")}
          </div>
        </div>
      </div>

      {/* 2. Customer & Order Specification Box */}
      <div className="border border-black bg-gray-50 p-3 grid grid-cols-3 gap-3 rounded-sm">
        <div>
          <span className="text-[10px] uppercase font-bold text-gray-600 block">Customer / Party Name:</span>
          <p className="text-sm font-extrabold text-black">{order.party?.name || "N/A"}</p>
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-gray-600 block">Phone Number:</span>
          <p className="text-xs font-bold text-black">{order.phone || order.party?.phone || "N/A"}</p>
        </div>
        <div className="bg-white border border-black p-1.5 rounded text-center">
          <span className="text-[10px] uppercase font-bold text-red-600 block">Delivery Date (ડિલિવરી તારીખ):</span>
          <p className="text-sm font-black text-red-700">
            {order.delivery_date ? format(new Date(order.delivery_date), "dd MMM yyyy (EEEE)") : "NOT SET"}
          </p>
        </div>
      </div>

      {/* 3. Garment Measurements Grid (Dual English + Gujarati Labels) */}
      <div className="space-y-3">
        {/* Upper Body Garment Table */}
        <div className="border border-black rounded-sm overflow-hidden">
          <div className="bg-gray-100 border-b border-black px-3 py-1 font-bold text-xs uppercase flex items-center justify-between">
            <span>👔 Upper Body Garment Measurements (ઉપરના કપડાનું માપ)</span>
            <span className="text-[10px] font-normal text-gray-600">Kurta / Koti / Sherwani / Blazer / Shirt</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-0 divide-x divide-y divide-black text-center text-xs">
            <PrintCell label="Length (લંબાઈ)" value={m.kurta_length} />
            <PrintCell label="Chest (છાતી)" value={m.chest} />
            <PrintCell label="Waist (કમર)" value={m.waist} />
            <PrintCell label="Seat / Hips (સીટ)" value={m.hips} />
            <PrintCell label="Shoulder (શોલ્ડર)" value={m.shoulder} />
            <PrintCell label="Sleeve (બાઈ)" value={m.sleeve_length} />
            <PrintCell label="Sleeve Mori (બાઈ મોરી)" value={m.sleeve_opening} />
            <PrintCell label="Collar (કોલર)" value={m.collar_neck} />
            <PrintCell label="Biceps (મુંઢો)" value={m.biceps} />
          </div>
        </div>

        {/* Lower Body Garment Table */}
        <div className="border border-black rounded-sm overflow-hidden">
          <div className="bg-gray-100 border-b border-black px-3 py-1 font-bold text-xs uppercase flex items-center justify-between">
            <span>👖 Lower Body Garment Measurements (નીચેના કપડાનું માપ)</span>
            <span className="text-[10px] font-normal text-gray-600">Pant / Pyjama / Salwar / Chididar</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-0 divide-x divide-y divide-black text-center text-xs">
            <PrintCell label="Pant Length (લંબાઈ)" value={m.pant_length} />
            <PrintCell label="Pant Waist (કમર)" value={m.pant_waist} />
            <PrintCell label="Seat / Hips (સીટ)" value={m.pant_hips} />
            <PrintCell label="Thigh (ઝાંગ)" value={m.thigh} />
            <PrintCell label="Knee (ઘૂંટણ)" value={m.knee} />
            <PrintCell label="Galo (ગાળો)" value={m.galo} />
            <PrintCell label="Bottom Mori (મોરી)" value={m.bottom_mori} />
          </div>
        </div>
      </div>

      {/* 4. Ordered Items Table */}
      {order.order_items && order.order_items.length > 0 && (
        <div className="border border-black rounded-sm overflow-hidden">
          <div className="bg-gray-100 border-b border-black px-3 py-1 font-bold text-xs uppercase">
            👗 Ordered Items Summary ({order.order_items.length})
          </div>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-black text-[11px] font-bold text-gray-800 uppercase">
                <th className="p-1.5 border-r border-black w-8 text-center">#</th>
                <th className="p-1.5 border-r border-black">Item Type</th>
                <th className="p-1.5 border-r border-black w-12 text-center">Qty</th>
                <th className="p-1.5 border-r border-black">Fabric Party</th>
                <th className="p-1.5">Fabric Details & Special Instructions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {order.order_items.map((item, idx) => (
                <tr key={item.id || idx} className="align-top">
                  <td className="p-1.5 border-r border-black text-center font-bold">{idx + 1}</td>
                  <td className="p-1.5 border-r border-black font-bold text-black">
                    {ITEM_TYPE_LABELS[item.item_type]}
                  </td>
                  <td className="p-1.5 border-r border-black text-center font-bold">{item.quantity}</td>
                  <td className="p-1.5 border-r border-black font-medium">{item.fabric_party?.name || "—"}</td>
                  <td className="p-1.5 space-y-1">
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
          <div className="font-bold text-xs uppercase border-b border-gray-300 pb-1 text-black">
            📋 Fabric & Design Points (મટીરીયલ અને ડિઝાઈન પોઈન્ટ્સ)
          </div>
          <div className="text-xs pt-1 pl-2">
            <BulletPointsList text={order.notes} />
          </div>
        </div>
      )}

      {/* 6. Reference Images Grid */}
      {order.attachments && order.attachments.length > 0 && (
        <div className="border border-black rounded-sm p-2 space-y-1">
          <div className="font-bold text-xs uppercase border-b border-gray-300 pb-1">
            📸 Reference Images ({order.attachments.length})
          </div>
          <div className="grid grid-cols-4 gap-2 pt-1">
            {order.attachments.map((att) => (
              <div key={att.id} className="border border-gray-400 p-1 text-center bg-white">
                <div className="w-full h-20 bg-gray-100 flex items-center justify-center overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={att.file_url} alt={att.file_name || "Ref"} className="w-full h-full object-contain" />
                </div>
                <p className="text-[9px] font-semibold truncate mt-0.5">{att.file_name || "Reference"}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. Signatures & Footer Verification */}
      <div className="pt-4 border-t-2 border-black flex items-end justify-between text-xs font-semibold">
        <div>
          <p className="font-bold">Aahman Ethnic Wear OMS</p>
          <p className="text-[10px] text-gray-600 font-normal">
            Printed on: {format(new Date(), "dd/MM/yyyy HH:mm")}
          </p>
        </div>
        <div className="flex gap-8 text-center">
          <div>
            <div className="w-36 border-b border-black mb-1"></div>
            <p className="text-[10px] text-gray-700 uppercase font-bold">Tailor Master Sign</p>
          </div>
          <div>
            <div className="w-36 border-b border-black mb-1"></div>
            <p className="text-[10px] text-gray-700 uppercase font-bold">Customer Sign</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrintCell({ label, value }: { label: string; value?: string }) {
  return (
    <div className="p-1.5 bg-white">
      <div className="text-[10px] font-bold text-gray-600 uppercase">{label}</div>
      <div className="text-sm font-black text-black mt-0.5">
        {value && value.trim() ? value : "—"}
      </div>
    </div>
  );
}
