"use client";

import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";

async function convertImageToDataUrl(url: string): Promise<string> {
  if (!url || url.startsWith("data:")) return url;

  // First try server proxy to bypass CORS restrictions on S3/external images
  try {
    const proxyRes = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`);
    if (proxyRes.ok) {
      const json = await proxyRes.json();
      if (json.dataUrl) return json.dataUrl;
    }
  } catch (err) {
    console.warn("Proxy image load failed, attempting direct fetch fallback", err);
  }

  // Direct CORS fetch fallback
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return url;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

export async function downloadJobSheetAsPDF(elementId: string, filename: string = "Tailor-JobSheet.pdf") {
  let element = document.getElementById(elementId);
  
  if (!element) {
    element = document.querySelector("[id^='printable-job-sheet']");
  }

  if (!element) {
    toast.error("Could not locate printable sheet element.");
    return;
  }

  const toastId = toast.loading("Generating direct PDF download...");

  try {
    const imgs = Array.from(element.querySelectorAll("img"));
    const originalSrcs = imgs.map((img) => img.src);

    // Convert external/S3 images to base64 Data URLs via server proxy
    await Promise.all(
      imgs.map(async (img) => {
        if (img.src && !img.src.startsWith("data:")) {
          const dataUrl = await convertImageToDataUrl(img.src);
          if (dataUrl && dataUrl.startsWith("data:")) {
            img.src = dataUrl;
          }
        }
      })
    );

    const canvas = await html2canvas(element as HTMLElement, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
      logging: false,
      imageTimeout: 15000,
    });

    // Restore original image sources
    imgs.forEach((img, i) => {
      if (originalSrcs[i]) {
        img.src = originalSrcs[i];
      }
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.95);
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

    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;

    while (heightLeft > 0) {
      position = heightLeft - pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    const cleanFilename = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
    pdf.save(cleanFilename);
    toast.success("PDF downloaded directly!", { id: toastId });
  } catch (err: any) {
    console.error("PDF Download error details:", err);
    toast.error("Failed to generate PDF download.", { id: toastId });
  }
}
