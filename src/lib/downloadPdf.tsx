"use client";

import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";
import { createRoot } from "react-dom/client";
import { PrintableJobSheet } from "@/components/PrintableJobSheet";
import type { Order } from "@/types";

async function convertImageToDataUrl(url: string): Promise<string> {
  if (!url || url.startsWith("data:")) return url;

  try {
    const proxyRes = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`);
    if (proxyRes.ok) {
      const json = await proxyRes.json();
      if (json.dataUrl) return json.dataUrl;
    }
  } catch (err) {
    console.warn("Proxy image load failed, fallback to direct fetch", err);
  }

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

/**
 * Walk every element in the cloned DOM and inline resolved RGB colors
 * so html2canvas never sees lab()/oklch()/oklab() color functions.
 */
function sanitizeColorsForHtml2Canvas(clonedEl: HTMLElement) {
  const allEls = [clonedEl, ...Array.from(clonedEl.querySelectorAll("*"))];
  for (const el of allEls) {
    const htmlEl = el as HTMLElement;
    const computed = window.getComputedStyle(htmlEl);

    // Inline key color properties as resolved rgb() values
    htmlEl.style.color = computed.color;
    htmlEl.style.backgroundColor = computed.backgroundColor;
    htmlEl.style.borderTopColor = computed.borderTopColor;
    htmlEl.style.borderRightColor = computed.borderRightColor;
    htmlEl.style.borderBottomColor = computed.borderBottomColor;
    htmlEl.style.borderLeftColor = computed.borderLeftColor;
    htmlEl.style.outlineColor = computed.outlineColor;
    htmlEl.style.textDecorationColor = computed.textDecorationColor;

    // Also remove any CSS custom properties (--var) that may reference lab()
    const inlineStyle = htmlEl.style;
    const propsToRemove: string[] = [];
    for (let i = 0; i < inlineStyle.length; i++) {
      const prop = inlineStyle[i];
      if (prop.startsWith("--")) {
        propsToRemove.push(prop);
      }
    }
    for (const prop of propsToRemove) {
      inlineStyle.removeProperty(prop);
    }
  }
}

export async function downloadJobSheetAsPDF(
  target: string | Order,
  filename?: string
) {
  const toastId = toast.loading("Generating direct PDF download...");
  let tempContainer: HTMLDivElement | null = null;
  let root: any = null;

  try {
    let elementToCapture: HTMLElement | null = null;

    if (typeof target === "string") {
      elementToCapture = document.getElementById(target);
      if (!elementToCapture) {
        elementToCapture = document.querySelector("[id^='printable-job-sheet']");
      }
    } else if (target && typeof target === "object") {
      elementToCapture = document.getElementById(`printable-job-sheet-${target.id}`);

      if (!elementToCapture) {
        tempContainer = document.createElement("div");
        tempContainer.style.position = "fixed";
        tempContainer.style.left = "-9999px";
        tempContainer.style.top = "0";
        tempContainer.style.width = "800px";
        tempContainer.style.backgroundColor = "#ffffff";
        tempContainer.style.zIndex = "-9999";
        document.body.appendChild(tempContainer);

        root = createRoot(tempContainer);
        root.render(<PrintableJobSheet order={target} showActions={false} />);

        await new Promise((r) => setTimeout(r, 500));
        elementToCapture = (tempContainer.firstElementChild as HTMLElement) || tempContainer;
        if (!filename) {
          filename = `Tailor_JobSheet_${target.order_number || target.id}.pdf`;
        }
      }
    }

    if (!elementToCapture) {
      toast.error("Could not find or create job sheet layout.", { id: toastId });
      return;
    }

    // Convert images to base64 Data URLs
    const imgs = Array.from(elementToCapture.querySelectorAll("img"));
    const originalSrcs = imgs.map((img) => img.src);

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

    const canvas = await html2canvas(elementToCapture, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
      logging: false,
      imageTimeout: 15000,
      onclone: (_clonedDoc: Document, clonedEl: HTMLElement) => {
        // Resolve all lab()/oklch() colors to rgb() before html2canvas parses them
        sanitizeColorsForHtml2Canvas(clonedEl);
      },
    });

    // Restore original image sources on the live DOM
    if (!tempContainer) {
      imgs.forEach((img, i) => {
        if (originalSrcs[i]) {
          img.src = originalSrcs[i];
        }
      });
    }

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

    const outputName = filename || "Tailor-JobSheet.pdf";
    const cleanFilename = outputName.endsWith(".pdf") ? outputName : `${outputName}.pdf`;
    pdf.save(cleanFilename);
    toast.success("PDF downloaded directly!", { id: toastId });
  } catch (err: any) {
    console.error("PDF Download error details:", err);
    toast.error(`Failed to generate PDF: ${err?.message || "Unknown error"}`, { id: toastId });
  } finally {
    if (root) {
      try { root.unmount(); } catch {}
    }
    if (tempContainer && document.body.contains(tempContainer)) {
      try { document.body.removeChild(tempContainer); } catch {}
    }
  }
}
