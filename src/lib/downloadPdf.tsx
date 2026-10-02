"use client";

import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { toast } from "sonner";
import type { Order } from "@/types";
import { parseMeasurements, getCleanSlipNumber, ITEM_TYPE_LABELS, getAttachmentCategory } from "@/types";
import { format } from "date-fns";

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

/* helper: builds one label+value pair as two <td> elements */
function measPair(label: string, val: string | undefined, isLast: boolean): string {
  const v = val && String(val).trim() ? val : "—";
  return `
    <td style="padding: 6px 4px; background: #f3f4f6; font-size: 9px; font-weight: 800; color: #374151; text-transform: uppercase; text-align: center; vertical-align: middle; border-right: 1px solid #000; line-height: 1.3;">
      ${label}
    </td>
    <td style="padding: 8px 4px; background: #ffffff; font-size: 15px; font-weight: 900; color: #000000; text-align: center; vertical-align: middle; line-height: 1; ${isLast ? "" : "border-right: 1.5px solid #000;"}">
      ${v}
    </td>
  `;
}

/**
 * Generates an HTML string for the Job Sheet with complete Gujarati labels
 */
function createJobSheetHtml(order: Order): string {
  const m = parseMeasurements(order.stitching_measurement_number);
  const slipNo = getCleanSlipNumber(order);
  const orderDate = order.order_date ? format(new Date(order.order_date), "dd/MM/yyyy") : "—";
  const deliveryDate = order.delivery_date ? format(new Date(order.delivery_date), "dd/MM/yyyy") : "—";
  const partyName = order.party?.name || "—";
  const phone = order.phone || order.party?.phone || "—";
  const vyaparNo = order.vyapar_order_number || "—";
  const statusGu = STATUS_LABELS_GU[order.status] || order.status;

  const fabricAttachments = (order.attachments || []).filter((a) => {
    const c = getAttachmentCategory(a);
    return c === "fabric" || c === "color" || c === "material";
  });
  const referenceAttachments = (order.attachments || []).filter((a) => {
    const c = getAttachmentCategory(a);
    return c === "reference";
  });

  let orderedItemsHtml = "";
  if (order.order_items && order.order_items.length > 0) {
    const rows = order.order_items
      .map((item, idx) => {
        const itemType = ITEM_TYPE_LABELS_GU[item.item_type] || ITEM_TYPE_LABELS[item.item_type] || item.item_type;
        const details = [
          item.fabric_details ? ("<div><strong>Fabric (કાપડ):</strong> " + item.fabric_details + "</div>") : "",
          item.special_instructions ? ("<div><strong>Instructions (સૂચના):</strong> " + item.special_instructions + "</div>") : "",
          item.notes ? ("<div><strong>Notes (નોંધ):</strong> " + item.notes + "</div>") : "",
        ]
          .filter(Boolean)
          .join("");

        return `
          <tr style="border-top: 1px solid #000; vertical-align: middle;">
            <td style="padding: 6px 4px; border-right: 1px solid #000; text-align: center; font-weight: bold; vertical-align: middle;">${idx + 1}</td>
            <td style="padding: 6px 8px; border-right: 1px solid #000; font-weight: bold; vertical-align: middle;">${itemType}</td>
            <td style="padding: 6px 4px; border-right: 1px solid #000; text-align: center; font-weight: bold; vertical-align: middle;">${item.quantity || 1}</td>
            <td style="padding: 6px 8px; border-right: 1px solid #000; vertical-align: middle;">${item.fabric_party?.name || "—"}</td>
            <td style="padding: 6px 8px; font-size: 11px; vertical-align: middle;">${details || "—"}</td>
          </tr>
        `;
      })
      .join("");

    orderedItemsHtml = `
      <div style="border: 1.5px solid #000; border-radius: 2px; overflow: hidden; margin-top: 10px;">
        <div style="background: #e5e7eb; border-bottom: 1.5px solid #000; padding: 4px 8px; font-weight: 900; font-size: 11px; text-transform: uppercase;">
          👗 Ordered Items Summary (ઓર્ડર કરેલ આઈટમ વિગત - ${order.order_items.length} નંગ)
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left;">
          <thead>
            <tr style="background: #f9fafb; font-size: 10px; font-weight: bold; text-transform: uppercase;">
              <th style="padding: 5px 4px; border-right: 1px solid #000; width: 32px; text-align: center;">#</th>
              <th style="padding: 5px 8px; border-right: 1px solid #000; width: 140px;">Item Type (આઈટમ)</th>
              <th style="padding: 5px 4px; border-right: 1px solid #000; width: 45px; text-align: center;">Qty (નંગ)</th>
              <th style="padding: 5px 8px; border-right: 1px solid #000; width: 130px;">Fabric Party (ફેબ્રિક પાર્ટી)</th>
              <th style="padding: 5px 8px;">Fabric Details & Instructions (કાપડ અને ખાસ સૂચના)</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  let notesHtml = "";
  if (order.notes) {
    notesHtml = `
      <div style="border: 1.5px solid #000; border-radius: 2px; padding: 6px 8px; background: #fafafa; margin-top: 10px;">
        <div style="font-weight: bold; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #ddd; padding-bottom: 3px; margin-bottom: 4px;">
          📋 Fabric & Design Points (મટીરીયલ અને ડિઝાઈન પોઈન્ટ્સ / ખાસ સૂચના)
        </div>
        <div style="font-size: 11px; line-height: 1.5; white-space: pre-wrap;">${order.notes}</div>
      </div>
    `;
  }

  let attachmentsHtml = "";
  if (fabricAttachments.length > 0 || referenceAttachments.length > 0) {
    const allAtts = [...fabricAttachments, ...referenceAttachments];
    const imgCards = allAtts
      .map(
        (att) => `
        <div style="border: 1px solid #999; padding: 3px; text-align: center; background: #fff; width: 110px;">
          <div style="width: 100%; height: 75px; background: #f3f4f6; display: flex; align-items: center; justify-content: center; overflow: hidden;">
            <img src="${att.file_url}" style="width: 100%; height: 100%; object-fit: contain;" />
          </div>
          <p style="font-size: 8px; font-weight: bold; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${att.file_name || "Attachment"}</p>
        </div>
      `
      )
      .join("");

    attachmentsHtml = `
      <div style="border: 1.5px solid #000; border-radius: 2px; padding: 6px 8px; margin-top: 10px;">
        <div style="font-weight: bold; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #ddd; padding-bottom: 3px; margin-bottom: 6px;">
          📸 Fabric Samples & Design References (સેમ્પલ અને રેફરન્સ ફોટા)
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          ${imgCards}
        </div>
      </div>
    `;
  }

  return `
    <div style="width: 800px; min-height: 1120px; padding: 24px; background: #ffffff; color: #000000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <!-- Header -->
        <div style="border-bottom: 2px solid #000; padding-bottom: 8px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h1 style="font-size: 26px; font-weight: 900; text-transform: uppercase; margin: 0; letter-spacing: -0.5px; font-family: 'Cormorant Garamond', Georgia, serif;">
              Aahman Ethnic Wear
            </h1>
            <p style="font-size: 11px; font-weight: bold; color: #374151; margin: 2px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px;">
              PREMIUM MEN'S ETHNIC WEAR & BESPOKE TAILORING (મેન્સ એથનિક વિયર)
            </p>
            <p style="font-size: 9px; color: #4b5563; margin: 2px 0 0 0;">
              29, 1st Floor, Archana Eco Industry, Simada Check Post, Surat • 📞 +91 70484 75024
            </p>
          </div>
          <div style="text-align: right;">
            <div style="background: #f3f4f6; border: 1.5px solid #000; padding: 4px 12px; border-radius: 2px; text-align: center;">
              <div style="font-size: 9px; font-weight: bold; text-transform: uppercase; color: #4b5563;">
                Measurement Slip # (માપ કાપલી નં)
              </div>
              <div style="font-size: 15px; font-weight: 900; color: #172554; letter-spacing: 0.5px; margin-top: 1px;">
                ${slipNo || order.order_number}
              </div>
            </div>
          </div>
        </div>

        <!-- Order Info -->
        <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000; margin-top: 10px; font-size: 11px;">
          <tr>
            <td style="padding: 6px 8px; border-right: 1px solid #000; border-bottom: 1px solid #000; width: 15%; background: #f3f4f6; font-weight: bold;">Slip # (સ્લિપ નં)</td>
            <td style="padding: 6px 8px; border-right: 1px solid #000; border-bottom: 1px solid #000; width: 35%; font-weight: bold;">${slipNo || order.order_number}</td>
            <td style="padding: 6px 8px; border-right: 1px solid #000; border-bottom: 1px solid #000; width: 15%; background: #f3f4f6; font-weight: bold;">Order # (ઓર્ડર નં)</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #000; width: 35%; font-weight: bold;">${order.order_number}</td>
          </tr>
          <tr>
            <td style="padding: 6px 8px; border-right: 1px solid #000; border-bottom: 1px solid #000; background: #f3f4f6; font-weight: bold;">Customer (ગ્રાહક)</td>
            <td style="padding: 6px 8px; border-right: 1px solid #000; border-bottom: 1px solid #000; font-weight: bold; font-size: 13px;">${partyName}</td>
            <td style="padding: 6px 8px; border-right: 1px solid #000; border-bottom: 1px solid #000; background: #f3f4f6; font-weight: bold;">Phone (ફોન)</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #000; font-weight: bold;">${phone}</td>
          </tr>
          <tr>
            <td style="padding: 6px 8px; border-right: 1px solid #000; border-bottom: 1px solid #000; background: #f3f4f6; font-weight: bold;">Order Date (ઓર્ડર)</td>
            <td style="padding: 6px 8px; border-right: 1px solid #000; border-bottom: 1px solid #000;">${orderDate}</td>
            <td style="padding: 6px 8px; border-right: 1px solid #000; border-bottom: 1px solid #000; background: #f3f4f6; font-weight: bold;">Delivery (ડિલિવરી)</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #000; font-weight: bold; color: #b91c1c;">${deliveryDate}</td>
          </tr>
          <tr>
            <td style="padding: 6px 8px; border-right: 1px solid #000; background: #f3f4f6; font-weight: bold;">Vyapar # (વેપાર નં)</td>
            <td style="padding: 6px 8px; border-right: 1px solid #000; font-weight: bold;">${vyaparNo}</td>
            <td style="padding: 6px 8px; border-right: 1px solid #000; background: #f3f4f6; font-weight: bold;">Total Items (કુલ)</td>
            <td style="padding: 6px 8px; font-weight: bold;">${order.order_items?.length || 0} Items • ${statusGu}</td>
          </tr>
        </table>

        <!-- Upper Body Measurements -->
        <div style="border: 1.5px solid #000; border-radius: 2px; overflow: hidden; margin-top: 10px;">
          <div style="background: #e5e7eb; border-bottom: 1.5px solid #000; padding: 4px 8px; font-weight: 900; font-size: 11px; text-transform: uppercase; display: flex; justify-content: space-between; align-items: center;">
            <span>👔 Upper Body Measurements (અપર બોડી માપ - Kurta / Koti / Blazer)</span>
            <span style="font-size: 10px; font-weight: bold; color: #1f2937;">ઉપરના કપડાં</span>
          </div>
          <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
            <tr style="border-bottom: 1px solid #000;">
              ${measPair("1) Lambai<br>(લંબાઈ)", m.lambai || m.kurta_length, false)}
              ${measPair("2) Bai<br>(બાઈ)", m.bai || m.sleeve_length, false)}
              ${measPair("3) Solder<br>(સોલ્ડર)", m.solder || m.shoulder, false)}
              ${measPair("4) Chati<br>(છાતી)", m.chati || m.chest, true)}
            </tr>
            <tr>
              ${measPair("5) Pet<br>(પેટ)", m.pet || m.stomach, false)}
              ${measPair("6) Sheet<br>(સીટ)", m.sheet_upper || m.hips, false)}
              ${measPair("7) Cuff<br>(કફ)", m.cap, false)}
              ${measPair("8) Coller<br>(કોલર)", m.coller, true)}
            </tr>
          </table>
        </div>

        <!-- Bottom Garment Measurements -->
        <div style="border: 1.5px solid #000; border-radius: 2px; overflow: hidden; margin-top: 10px;">
          <div style="background: #e5e7eb; border-bottom: 1.5px solid #000; padding: 4px 8px; font-weight: 900; font-size: 11px; text-transform: uppercase; display: flex; justify-content: space-between; align-items: center;">
            <span>👖 Bottom Garment Measurements (બોટમ માપ - Pant / Pyjama)</span>
            <span style="font-size: 10px; font-weight: bold; color: #1f2937;">નીચેના કપડાં</span>
          </div>
          <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
            <tr style="border-bottom: 1px solid #000;">
              ${measPair("1) Lambai<br>(લંબાઈ)", m.lambai_bottom || m.pant_length, false)}
              ${measPair("2) Kamber<br>(કમર)", m.kamber || m.pant_waist || m.waist, false)}
              ${measPair("3) Sheet<br>(સીટ)", m.sheet || m.hips, true)}
            </tr>
            <tr>
              ${measPair("4) Jang<br>(ઝાંગ)", m.jang, false)}
              ${measPair("5) Moli<br>(મોરી)", m.moli || m.bottom_mori, false)}
              ${measPair("6) Kistak<br>(કિસ્તક)", m.kistak, true)}
            </tr>
          </table>
        </div>

        ${orderedItemsHtml}
        ${notesHtml}
        ${attachmentsHtml}
      </div>

      <!-- Footer -->
      <div style="border-top: 2px solid #000; padding-top: 8px; margin-top: 16px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 11px;">
        <div>
          <div style="font-weight: bold;">Aahman Ethnic Wear OMS</div>
          <div style="font-size: 9px; color: #4b5563; margin-top: 2px;">Printed on: ${format(new Date(), "dd/MM/yyyy HH:mm")}</div>
        </div>
        <div style="display: flex; gap: 24px; text-align: center;">
          <div>
            <div style="width: 140px; border-bottom: 1px solid #000; margin-bottom: 4px;"></div>
            <div style="font-size: 9px; font-weight: bold; color: #374151; text-transform: uppercase;">Tailor Master Sign (ટેલર માસ્ટર સહી)</div>
          </div>
          <div>
            <div style="width: 140px; border-bottom: 1px solid #000; margin-bottom: 4px;"></div>
            <div style="font-size: 9px; font-weight: bold; color: #374151; text-transform: uppercase;">Customer Sign (ગ્રાહક સહી)</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Captures order HTML as canvas via html2canvas
 */
async function captureOrderCanvas(order: Order): Promise<HTMLCanvasElement> {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.zIndex = "-1000";
  container.style.background = "#ffffff";
  container.innerHTML = createJobSheetHtml(order);
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container.firstElementChild as HTMLElement, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });
    document.body.removeChild(container);
    return canvas;
  } catch (err) {
    document.body.removeChild(container);
    throw err;
  }
}

/**
 * Downloads a single order job sheet as PDF
 */
export async function downloadJobSheetAsPDF(
  target: string | Order,
  filename?: string
) {
  const toastId = toast.loading("Generating PDF with Gujarati labels...");

  try {
    let order: Order | null = null;
    if (typeof target === "string") {
      toast.error("Please pass an order object for PDF download.", { id: toastId });
      return;
    } else {
      order = target;
    }

    if (!order) {
      toast.error("No order data found.", { id: toastId });
      return;
    }

    const canvas = await captureOrderCanvas(order);
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height * pageW) / canvas.width;

    const imgData = canvas.toDataURL("image/png");
    pdf.addImage(imgData, "PNG", 0, 0, pageW, Math.min(imgH, pageH));

    const outputName = filename || `Tailor_JobSheet_${order.order_number || order.id}`;
    const cleanFilename = outputName.endsWith(".pdf") ? outputName : `${outputName}.pdf`;
    pdf.save(cleanFilename);
    toast.success("PDF with Gujarati labels downloaded!", { id: toastId });
  } catch (err: any) {
    console.error("PDF Download error:", err);
    toast.error(`Failed to generate PDF: ${err?.message || "Unknown error"}`, { id: toastId });
  }
}

/**
 * Downloads multiple orders as a single multi-page PDF
 */
export async function downloadMultipleJobSheetsPDF(
  orders: Order[],
  filename?: string
) {
  if (!orders || orders.length === 0) {
    toast.error("No measurement slips selected.");
    return;
  }

  const toastId = toast.loading(`Generating multi-page PDF for ${orders.length} slips...`);

  try {
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      if (i > 0) {
        pdf.addPage();
      }

      const canvas = await captureOrderCanvas(order);
      const imgH = (canvas.height * pageW) / canvas.width;
      const imgData = canvas.toDataURL("image/png");
      pdf.addImage(imgData, "PNG", 0, 0, pageW, Math.min(imgH, pageH));
    }

    const defaultFilename = `Batch_JobSheets_${orders.length}_Slips_${format(new Date(), "dd-MMM-yyyy")}.pdf`;
    const cleanFilename = (filename || defaultFilename).endsWith(".pdf")
      ? (filename || defaultFilename)
      : `${filename || defaultFilename}.pdf`;

    pdf.save(cleanFilename);
    toast.success(`Downloaded ${orders.length} measurement slips in 1 PDF!`, { id: toastId });
  } catch (err: any) {
    console.error("Batch PDF Download error:", err);
    toast.error(`Failed to generate batch PDF: ${err?.message || "Unknown error"}`, { id: toastId });
  }
}
