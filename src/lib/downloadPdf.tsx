"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import type { Order } from "@/types";
import { parseMeasurements, getCleanSlipNumber, ITEM_TYPE_LABELS, getAttachmentCategory } from "@/types";
import { format } from "date-fns";

export async function downloadJobSheetAsPDF(
  target: string | Order,
  filename?: string
) {
  const toastId = toast.loading("Generating PDF...");

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

    const m = parseMeasurements(order.stitching_measurement_number);
    const slipNo = getCleanSlipNumber(order);
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const margin = 10;
    const contentW = pageW - margin * 2;
    let y = margin;

    // Helper functions
    const addText = (text: string, x: number, yy: number, opts?: { size?: number; bold?: boolean; align?: "left" | "center" | "right"; maxW?: number }) => {
      pdf.setFontSize(opts?.size || 10);
      pdf.setFont("helvetica", opts?.bold ? "bold" : "normal");
      if (opts?.maxW) {
        pdf.text(text, x, yy, { maxWidth: opts.maxW, align: opts?.align || "left" });
      } else {
        pdf.text(text, x, yy, { align: opts?.align || "left" });
      }
    };

    const addLine = (x1: number, y1: number, x2: number, y2: number) => {
      pdf.setLineWidth(0.3);
      pdf.setDrawColor(0);
      pdf.line(x1, y1, x2, y2);
    };

    // === 1. HEADER ===
    addText("AAHMAN ETHNIC WEAR", pageW / 2, y + 5, { size: 18, bold: true, align: "center" });
    y += 8;
    addText("Premium Tailor Job Sheet", pageW / 2, y + 4, { size: 10, bold: false, align: "center" });
    y += 8;
    addLine(margin, y, pageW - margin, y);
    y += 4;

    // === 2. ORDER INFO TABLE ===
    const orderDate = order.order_date ? format(new Date(order.order_date), "dd/MM/yyyy") : "N/A";
    const deliveryDate = order.delivery_date ? format(new Date(order.delivery_date), "dd/MM/yyyy") : "N/A";
    const partyName = order.party?.name || "N/A";
    const phone = order.phone || order.party?.phone || "N/A";
    const vyaparNo = order.vyapar_order_number || "N/A";

    const infoData = [
      ["Slip #", slipNo, "Order #", order.order_number || "N/A"],
      ["Customer", partyName, "Phone", phone],
      ["Order Date", orderDate, "Delivery Date", deliveryDate],
      ["Vyapar #", vyaparNo, "Total Items", String(order.order_items?.length || 0)],
    ];

    autoTable(pdf, {
      startY: y,
      body: infoData,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 28, fillColor: [245, 245, 245] },
        1: { cellWidth: contentW / 2 - 28 },
        2: { fontStyle: "bold", cellWidth: 28, fillColor: [245, 245, 245] },
        3: { cellWidth: contentW / 2 - 28 },
      },
      margin: { left: margin, right: margin },
    });

    y = (pdf as any).lastAutoTable.finalY + 4;

    // === 3. UPPER BODY MEASUREMENTS ===
    addText("Upper Body Measurements (Kurta / Koti / Blazer)", margin, y + 3, { size: 10, bold: true });
    y += 5;

    const upperData = [
      ["1) Lambai", m.lambai || "—", "2) Bai", m.bai || "—", "3) Solder", m.solder || "—", "4) Chati", m.chati || "—"],
      ["5) Pet", m.pet || "—", "6) Sheet", m.sheet_upper || "—", "7) Cap", m.cap || "—", "8) Coller", m.coller || "—"],
    ];

    autoTable(pdf, {
      startY: y,
      body: upperData,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2, halign: "center", lineColor: [0, 0, 0], lineWidth: 0.2 },
      columnStyles: {
        0: { fontStyle: "bold", fillColor: [240, 240, 240], cellWidth: contentW / 8 },
        1: { cellWidth: contentW / 8 },
        2: { fontStyle: "bold", fillColor: [240, 240, 240], cellWidth: contentW / 8 },
        3: { cellWidth: contentW / 8 },
        4: { fontStyle: "bold", fillColor: [240, 240, 240], cellWidth: contentW / 8 },
        5: { cellWidth: contentW / 8 },
        6: { fontStyle: "bold", fillColor: [240, 240, 240], cellWidth: contentW / 8 },
        7: { cellWidth: contentW / 8 },
      },
      margin: { left: margin, right: margin },
    });

    y = (pdf as any).lastAutoTable.finalY + 4;

    // === 4. BOTTOM GARMENT MEASUREMENTS ===
    addText("Bottom Garment Measurements (Pant / Pyjama)", margin, y + 3, { size: 10, bold: true });
    y += 5;

    const bottomData = [
      ["1) Lambai", m.lambai_bottom || "—", "2) Kamber", m.kamber || "—", "3) Sheet", m.sheet || "—"],
      ["4) Jang", m.jang || "—", "5) Moli", m.moli || "—", "6) Kistak", m.kistak || "—"],
    ];

    autoTable(pdf, {
      startY: y,
      body: bottomData,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2, halign: "center", lineColor: [0, 0, 0], lineWidth: 0.2 },
      columnStyles: {
        0: { fontStyle: "bold", fillColor: [240, 240, 240], cellWidth: contentW / 6 },
        1: { cellWidth: contentW / 6 },
        2: { fontStyle: "bold", fillColor: [240, 240, 240], cellWidth: contentW / 6 },
        3: { cellWidth: contentW / 6 },
        4: { fontStyle: "bold", fillColor: [240, 240, 240], cellWidth: contentW / 6 },
        5: { cellWidth: contentW / 6 },
      },
      margin: { left: margin, right: margin },
    });

    y = (pdf as any).lastAutoTable.finalY + 4;

    // === 5. ORDERED ITEMS ===
    if (order.order_items && order.order_items.length > 0) {
      addText(`Ordered Items Summary (${order.order_items.length})`, margin, y + 3, { size: 10, bold: true });
      y += 5;

      const itemRows = order.order_items.map((item, idx) => [
        String(idx + 1),
        ITEM_TYPE_LABELS[item.item_type] || item.item_type,
        String(item.quantity),
        item.fabric_party?.name || "—",
        [item.fabric_details, item.special_instructions, item.notes].filter(Boolean).join(" | ") || "—",
      ]);

      autoTable(pdf, {
        startY: y,
        head: [["#", "Item Type", "Qty", "Fabric Party", "Details & Instructions"]],
        body: itemRows,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2 },
        headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 30 },
          2: { cellWidth: 12, halign: "center" },
          3: { cellWidth: 30 },
        },
        margin: { left: margin, right: margin },
      });

      y = (pdf as any).lastAutoTable.finalY + 4;
    }

    // === 6. NOTES ===
    if (order.notes) {
      addText("Fabric & Design Points:", margin, y + 3, { size: 10, bold: true });
      y += 6;
      addText(order.notes, margin + 2, y, { size: 9, maxW: contentW - 4 });
      const lines = pdf.splitTextToSize(order.notes, contentW - 4);
      y += lines.length * 4 + 4;
    }

    // === 7. ATTACHMENTS (as image embeds if possible) ===
    const allAttachments = order.attachments || [];
    const fabricAtts = allAttachments.filter(a => { const c = getAttachmentCategory(a); return c === "fabric" || c === "color" || c === "material"; });
    const refAtts = allAttachments.filter(a => getAttachmentCategory(a) === "reference");

    for (const group of [
      { label: "Fabric & Material Samples", atts: fabricAtts },
      { label: "Design & Style Reference Images", atts: refAtts },
    ]) {
      if (group.atts.length > 0) {
        // Check if we need a new page
        if (y > pdf.internal.pageSize.getHeight() - 40) {
          pdf.addPage();
          y = margin;
        }
        addText(`${group.label} (${group.atts.length})`, margin, y + 3, { size: 10, bold: true });
        y += 6;

        let xPos = margin;
        const imgSize = 35;
        for (const att of group.atts) {
          try {
            // Fetch image via proxy and embed
            const proxyRes = await fetch(`/api/proxy-image?url=${encodeURIComponent(att.file_url)}`);
            if (proxyRes.ok) {
              const json = await proxyRes.json();
              if (json.dataUrl) {
                if (xPos + imgSize > pageW - margin) {
                  xPos = margin;
                  y += imgSize + 6;
                }
                if (y + imgSize > pdf.internal.pageSize.getHeight() - 15) {
                  pdf.addPage();
                  y = margin;
                  xPos = margin;
                }
                pdf.addImage(json.dataUrl, "JPEG", xPos, y, imgSize, imgSize);
                // Add filename label
                pdf.setFontSize(6);
                pdf.text(att.file_name || "Image", xPos + imgSize / 2, y + imgSize + 3, { align: "center", maxWidth: imgSize });
                xPos += imgSize + 4;
              }
            }
          } catch {
            // Skip failed images
          }
        }
        y += imgSize + 8;
      }
    }

    // === 8. SIGNATURES ===
    if (y > pdf.internal.pageSize.getHeight() - 35) {
      pdf.addPage();
      y = margin;
    }
    const sigY = pdf.internal.pageSize.getHeight() - 25;
    addLine(margin, sigY, pageW - margin, sigY);
    addText("Aahman Ethnic Wear OMS", margin, sigY + 5, { size: 8, bold: true });
    addText(`Printed on: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, margin, sigY + 9, { size: 7 });

    // Signature lines
    addLine(pageW - margin - 60, sigY + 5, pageW - margin - 25, sigY + 5);
    addText("Tailor Master Sign", pageW - margin - 55, sigY + 9, { size: 7, bold: true });
    addLine(pageW - margin - 20, sigY + 5, pageW - margin, sigY + 5);
    addText("Customer Sign", pageW - margin - 17, sigY + 9, { size: 7, bold: true });

    // Save
    const outputName = filename || `Tailor_JobSheet_${order.order_number || order.id}`;
    const cleanFilename = outputName.endsWith(".pdf") ? outputName : `${outputName}.pdf`;
    pdf.save(cleanFilename);
    toast.success("PDF downloaded!", { id: toastId });
  } catch (err: any) {
    console.error("PDF Download error:", err);
    toast.error(`Failed to generate PDF: ${err?.message || "Unknown error"}`, { id: toastId });
  }
}
