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
 * Inline ALL computed styles on every element and remove stylesheets
 * so html2canvas never encounters lab()/oklch() from Tailwind v4.
 */
function fullyInlineStyles(clonedDoc: Document, clonedEl: HTMLElement) {
  // 1. Remove all stylesheets and style tags from cloned document
  const styleSheets = clonedDoc.querySelectorAll('style, link[rel="stylesheet"]');
  styleSheets.forEach((s) => s.remove());

  // 2. Inline computed styles on every element
  const STYLE_PROPS = [
    "color", "backgroundColor", "borderTopColor", "borderRightColor",
    "borderBottomColor", "borderLeftColor", "outlineColor",
    "textDecorationColor", "boxShadow",
    "font", "fontSize", "fontWeight", "fontFamily", "fontStyle",
    "lineHeight", "letterSpacing", "textAlign", "textTransform",
    "display", "position", "top", "right", "bottom", "left",
    "width", "height", "minWidth", "minHeight", "maxWidth", "maxHeight",
    "margin", "marginTop", "marginRight", "marginBottom", "marginLeft",
    "padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "borderWidth", "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
    "borderStyle", "borderTopStyle", "borderRightStyle", "borderBottomStyle", "borderLeftStyle",
    "borderRadius", "borderTopLeftRadius", "borderTopRightRadius",
    "borderBottomLeftRadius", "borderBottomRightRadius",
    "overflow", "overflowX", "overflowY", "opacity",
    "flexDirection", "flexWrap", "justifyContent", "alignItems", "alignSelf",
    "flex", "flexGrow", "flexShrink", "flexBasis",
    "gap", "rowGap", "columnGap",
    "gridTemplateColumns", "gridTemplateRows", "gridColumn", "gridRow",
    "textOverflow", "whiteSpace", "wordBreak", "wordWrap",
    "verticalAlign", "tableLayout", "borderCollapse", "borderSpacing",
    "visibility", "zIndex", "cursor",
    "backgroundImage", "backgroundSize", "backgroundPosition", "backgroundRepeat",
  ] as const;

  const allEls = [clonedEl, ...Array.from(clonedEl.querySelectorAll("*"))];
  
  // We need to read computed styles from the ORIGINAL document elements
  // But since onclone gives us the cloned doc BEFORE stylesheets are removed,
  // we should read computed styles first, then remove stylesheets
  // However the cloned doc styles may differ. So let's take a different approach:
  // Read from original, apply to clone.
  
  // Actually in onclone, styles are still applied in the clone at this point.
  // So let's read computed from clone elements, store them, remove sheets, then apply.
  
  const computedMap = new Map<HTMLElement, Record<string, string>>();
  
  for (const el of allEls) {
    const htmlEl = el as HTMLElement;
    const computed = clonedDoc.defaultView?.getComputedStyle(htmlEl) || window.getComputedStyle(htmlEl);
    const styles: Record<string, string> = {};
    for (const prop of STYLE_PROPS) {
      try {
        styles[prop] = computed[prop as any] || "";
      } catch {
        // skip
      }
    }
    computedMap.set(htmlEl, styles);
  }
  
  // Now remove stylesheets (already done above, but they were removed before computing - fix order)
  // Actually we removed them at the top. Let's restructure:
  // We need to compute BEFORE removing. Let me fix this.
}

function sanitizeClonedDocument(clonedDoc: Document, clonedEl: HTMLElement) {
  const STYLE_PROPS = [
    "color", "backgroundColor", "borderTopColor", "borderRightColor",
    "borderBottomColor", "borderLeftColor", "outlineColor",
    "textDecorationColor",
    "font", "fontSize", "fontWeight", "fontFamily", "fontStyle",
    "lineHeight", "letterSpacing", "textAlign", "textTransform",
    "display", "position", "top", "right", "bottom", "left",
    "width", "height", "minWidth", "minHeight", "maxWidth", "maxHeight",
    "margin", "marginTop", "marginRight", "marginBottom", "marginLeft",
    "padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "borderWidth", "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
    "borderStyle", "borderTopStyle", "borderRightStyle", "borderBottomStyle", "borderLeftStyle",
    "borderRadius", "borderTopLeftRadius", "borderTopRightRadius",
    "borderBottomLeftRadius", "borderBottomRightRadius",
    "overflow", "overflowX", "overflowY", "opacity",
    "flexDirection", "flexWrap", "justifyContent", "alignItems", "alignSelf",
    "flex", "flexGrow", "flexShrink", "flexBasis",
    "gap", "rowGap", "columnGap",
    "gridTemplateColumns", "gridTemplateRows", "gridColumn", "gridRow",
    "textOverflow", "whiteSpace", "wordBreak",
    "verticalAlign", "tableLayout", "borderCollapse", "borderSpacing",
    "visibility", "zIndex",
    "backgroundSize", "backgroundPosition", "backgroundRepeat",
  ];

  const allEls = [clonedEl, ...Array.from(clonedEl.querySelectorAll("*"))];
  const win = clonedDoc.defaultView || window;

  // Step 1: Read all computed styles while stylesheets are still active
  const styleData: Array<{ el: HTMLElement; styles: Record<string, string> }> = [];

  for (const el of allEls) {
    const htmlEl = el as HTMLElement;
    const computed = win.getComputedStyle(htmlEl);
    const styles: Record<string, string> = {};
    for (const prop of STYLE_PROPS) {
      try {
        styles[prop] = (computed as any)[prop] || "";
      } catch {
        // skip
      }
    }
    styleData.push({ el: htmlEl, styles });
  }

  // Step 2: Remove ALL stylesheets and style tags from cloned doc
  const sheets = clonedDoc.querySelectorAll('style, link[rel="stylesheet"]');
  sheets.forEach((s) => s.remove());

  // Step 3: Apply the saved computed styles as inline styles
  for (const { el, styles } of styleData) {
    for (const [prop, value] of Object.entries(styles)) {
      if (value) {
        try {
          (el.style as any)[prop] = value;
        } catch {
          // skip
        }
      }
    }
    // Remove any CSS custom properties
    const propsToRemove: string[] = [];
    for (let i = 0; i < el.style.length; i++) {
      const p = el.style[i];
      if (p.startsWith("--")) propsToRemove.push(p);
    }
    for (const p of propsToRemove) {
      el.style.removeProperty(p);
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
      onclone: (clonedDoc: Document, clonedEl: HTMLElement) => {
        // Fully inline computed RGB styles and strip all stylesheets
        // This prevents html2canvas from ever seeing lab()/oklch() colors
        sanitizeClonedDocument(clonedDoc, clonedEl);
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
