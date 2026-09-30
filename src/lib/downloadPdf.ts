"use client";

import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";

export async function downloadJobSheetAsPDF(elementId: string, filename: string = "Tailor-JobSheet.pdf") {
  let element = document.getElementById(elementId);
  
  if (!element) {
    // Fallback search for any printable job sheet element
    element = document.querySelector("[id^='printable-job-sheet']");
  }

  if (!element) {
    toast.error("Could not locate printable sheet element.");
    return;
  }

  const toastId = toast.loading("Generating PDF file...");

  try {
    const canvas = await html2canvas(element as HTMLElement, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;

    while (heightLeft > 0) {
      position = heightLeft - pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    const cleanFilename = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
    pdf.save(cleanFilename);
    toast.success("Downloaded PDF successfully!", { id: toastId });
  } catch (err: any) {
    console.error("PDF Download error:", err);
    toast.error("Could not generate PDF. Please use Print -> Save as PDF.", { id: toastId });
  }
}
