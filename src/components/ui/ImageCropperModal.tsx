"use client";

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";

interface Props {
  imageSrc: string;
  onCropComplete: (file: File, previewUrl: string) => void;
  onCancel: () => void;
  title?: string;
}

export default function ImageCropperModal({
  imageSrc,
  onCropComplete,
  onCancel,
  title = "Select Image Option",
}: Props) {
  const [mode, setMode] = useState<"original" | "crop">("crop");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState<number | undefined>(undefined); // undefined = free
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  const onCropChange = useCallback((newCrop: { x: number; y: number }) => {
    setCrop(newCrop);
  }, []);

  const onZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
  }, []);

  const onCropCompleteHandler = useCallback(
    (_croppedArea: Area, croppedAreaPixelsParam: Area) => {
      setCroppedAreaPixels(croppedAreaPixelsParam);
    },
    []
  );

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener("load", () => resolve(image));
      image.addEventListener("error", (error) => reject(error));
      image.setAttribute("crossOrigin", "anonymous");
      image.src = url;
    });

  const getCroppedImg = async (
    imageSrcParam: string,
    pixelCrop: Area | null,
    rotationDeg = 0
  ): Promise<{ file: File; url: string }> => {
    const image = await createImage(imageSrcParam);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("No 2d context");
    }

    const rotRad = (rotationDeg * Math.PI) / 180;

    const bBoxWidth =
      Math.abs(Math.cos(rotRad) * image.width) +
      Math.abs(Math.sin(rotRad) * image.height);
    const bBoxHeight =
      Math.abs(Math.sin(rotRad) * image.width) +
      Math.abs(Math.cos(rotRad) * image.height);

    canvas.width = bBoxWidth;
    canvas.height = bBoxHeight;

    ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
    ctx.rotate(rotRad);
    ctx.translate(-image.width / 2, -image.height / 2);

    ctx.drawImage(image, 0, 0);

    const croppedCanvas = document.createElement("canvas");
    const croppedCtx = croppedCanvas.getContext("2d");

    if (!croppedCtx) {
      throw new Error("No 2d context for crop");
    }

    const cropX = pixelCrop ? pixelCrop.x : 0;
    const cropY = pixelCrop ? pixelCrop.y : 0;
    const cropW = pixelCrop ? pixelCrop.width : image.width;
    const cropH = pixelCrop ? pixelCrop.height : image.height;

    const MAX_DIM = 1600;
    let targetW = cropW;
    let targetH = cropH;

    if (cropW > MAX_DIM || cropH > MAX_DIM) {
      if (cropW > cropH) {
        targetW = MAX_DIM;
        targetH = Math.round((cropH * MAX_DIM) / cropW);
      } else {
        targetH = MAX_DIM;
        targetW = Math.round((cropW * MAX_DIM) / cropH);
      }
    }

    croppedCanvas.width = targetW;
    croppedCanvas.height = targetH;

    croppedCtx.imageSmoothingEnabled = true;
    croppedCtx.imageSmoothingQuality = "high";

    croppedCtx.drawImage(
      canvas,
      cropX,
      cropY,
      cropW,
      cropH,
      0,
      0,
      targetW,
      targetH
    );

    return new Promise((resolve, reject) => {
      croppedCanvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Canvas is empty"));
            return;
          }
          const file = new File([blob], `image_${Date.now()}.jpg`, {
            type: "image/jpeg",
          });
          const previewUrl = URL.createObjectURL(blob);
          resolve({ file, url: previewUrl });
        },
        "image/jpeg",
        0.88
      );
    });
  };

  const handleSave = async () => {
    try {
      setProcessing(true);
      if (mode === "original") {
        const { file, url } = await getCroppedImg(imageSrc, null, 0);
        onCropComplete(file, url);
      } else {
        const { file, url } = await getCroppedImg(
          imageSrc,
          croppedAreaPixels,
          rotation
        );
        onCropComplete(file, url);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-2 sm:p-4">
      <div
        className="bg-card rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[92vh] border overflow-hidden"
        style={{ borderColor: "hsl(var(--border))" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b bg-muted/40"
          style={{ borderColor: "hsl(var(--border))" }}
        >
          <h3
            className="font-bold text-base text-foreground flex items-center gap-2"
            style={{ fontFamily: "Cormorant Garamond, serif" }}
          >
            <span>🖼️</span> {title}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-lg hover:bg-muted text-muted-foreground font-bold text-base"
          >
            ✕
          </button>
        </div>

        {/* Mode Selector Tabs (Original vs Crop) */}
        <div
          className="p-3 bg-muted/20 border-b flex items-center justify-center gap-3"
          style={{ borderColor: "hsl(var(--border))" }}
        >
          <button
            type="button"
            onClick={() => setMode("original")}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
              mode === "original"
                ? "bg-primary text-white shadow-md border-primary scale-105"
                : "bg-card text-muted-foreground hover:bg-muted"
            }`}
            style={{ borderColor: mode === "original" ? "hsl(var(--primary))" : "hsl(var(--border))" }}
          >
            <span>🖼️</span> Original (ઓરિજિનલ)
          </button>
          <button
            type="button"
            onClick={() => setMode("crop")}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
              mode === "crop"
                ? "bg-primary text-white shadow-md border-primary scale-105"
                : "bg-card text-muted-foreground hover:bg-muted"
            }`}
            style={{ borderColor: mode === "crop" ? "hsl(var(--primary))" : "hsl(var(--border))" }}
          >
            <span>✂️</span> Crop (ક્રોપ)
          </button>
        </div>

        {/* Image Display / Cropper Area */}
        <div className="relative w-full h-[300px] sm:h-[360px] bg-black flex items-center justify-center overflow-hidden">
          {mode === "original" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageSrc}
              alt="Original preview"
              className="max-w-full max-h-full object-contain p-2"
            />
          ) : (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              onCropChange={onCropChange}
              onZoomChange={onZoomChange}
              onCropComplete={onCropCompleteHandler}
            />
          )}
        </div>

        {/* Controls Toolbar (Only shown when mode === 'crop') */}
        {mode === "crop" && (
          <div
            className="p-4 space-y-3 bg-card border-t animate-in fade-in-50"
            style={{ borderColor: "hsl(var(--border))" }}
          >
            {/* Crop Type Selection */}
            <div className="space-y-1.5 text-xs">
              <label className="block font-bold text-foreground">
                Select Crop Type (ક્રોપ સાઈઝ પસંદ કરો):
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { label: "Free Crop", value: undefined },
                  { label: "1:1 Square (ચોરસ)", value: 1 },
                  { label: "4:3 Standard", value: 4 / 3 },
                  { label: "16:9 Wide", value: 16 / 9 },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setAspect(item.value)}
                    className={`px-3 py-1.5 rounded-lg border text-xs transition-all ${
                      aspect === item.value
                        ? "bg-primary text-white font-bold shadow-sm"
                        : "bg-card text-muted-foreground hover:bg-muted"
                    }`}
                    style={{ borderColor: "hsl(var(--border))" }}
                  >
                    {item.label}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="px-3 py-1.5 rounded-lg border hover:bg-muted text-xs font-semibold flex items-center gap-1 transition-colors ml-auto"
                  style={{ borderColor: "hsl(var(--border))" }}
                >
                  <span>🔄</span> Rotate ({rotation}°)
                </button>
              </div>
            </div>

            {/* Zoom Slider */}
            <div className="flex items-center gap-3 text-xs pt-1">
              <span className="text-muted-foreground font-medium">Zoom:</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
              />
              <span className="text-muted-foreground font-mono">{zoom.toFixed(1)}x</span>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div
          className="p-4 bg-muted/20 border-t flex items-center justify-end gap-2"
          style={{ borderColor: "hsl(var(--border))" }}
        >
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border text-xs font-semibold hover:bg-muted transition-colors"
            style={{ borderColor: "hsl(var(--border))" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={processing}
            className="px-6 py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 flex items-center gap-2 shadow-md disabled:opacity-50"
            style={{ background: "hsl(var(--primary))" }}
          >
            <span>{mode === "original" ? "🖼️" : "✂️"}</span>
            {processing
              ? "Saving..."
              : mode === "original"
              ? "Use Original Image"
              : "Crop & Save Image"}
          </button>
        </div>
      </div>
    </div>
  );
}
