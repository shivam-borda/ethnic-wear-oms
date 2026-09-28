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
  title = "Crop & Optimize Image",
}: Props) {
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
    rotationParam = 0
  ): Promise<{ file: File; url: string }> => {
    const image = await createImage(imageSrcParam);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("No 2d context");
    }

    const rotRad = (rotationParam * Math.PI) / 180;

    // Calculate bounding box of rotated image
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

    // Smart resize max dimension to 1600px while keeping high quality
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
          const file = new File([blob], `cropped_${Date.now()}.jpg`, {
            type: "image/jpeg",
          });
          const previewUrl = URL.createObjectURL(blob);
          resolve({ file, url: previewUrl });
        },
        "image/jpeg",
        0.88 // 88% high-definition quality compression
      );
    });
  };

  const handleSave = async () => {
    try {
      setProcessing(true);
      const { file, url } = await getCroppedImg(
        imageSrc,
        croppedAreaPixels,
        rotation
      );
      onCropComplete(file, url);
    } catch (e) {
      console.error(e);
    } finally {
      setProcessing(false);
    }
  };

  const handleSkip = async () => {
    try {
      setProcessing(true);
      const { file, url } = await getCroppedImg(imageSrc, null, rotation);
      onCropComplete(file, url);
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
          <div className="flex items-center gap-2">
            <span className="text-xl">✂️</span>
            <h3
              className="font-bold text-base text-foreground"
              style={{ fontFamily: "Cormorant Garamond, serif" }}
            >
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-lg hover:bg-muted text-muted-foreground font-bold text-base"
          >
            ✕
          </button>
        </div>

        {/* Cropper Container */}
        <div className="relative w-full h-[320px] sm:h-[400px] bg-black">
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
        </div>

        {/* Controls Toolbar */}
        <div
          className="p-4 space-y-3 bg-card border-t"
          style={{ borderColor: "hsl(var(--border))" }}
        >
          {/* Aspect Ratios & Rotate */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-muted-foreground font-medium mr-1">Aspect Ratio:</span>
              {[
                { label: "Free", value: undefined },
                { label: "1:1 Square", value: 1 },
                { label: "4:3 Standard", value: 4 / 3 },
                { label: "16:9 Wide", value: 16 / 9 },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setAspect(item.value)}
                  className={`px-2.5 py-1 rounded-md border transition-colors ${
                    aspect === item.value
                      ? "bg-primary text-white font-bold"
                      : "hover:bg-muted text-muted-foreground"
                  }`}
                  style={{ borderColor: "hsl(var(--border))" }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="px-3 py-1 rounded-md border hover:bg-muted text-xs font-semibold flex items-center gap-1 transition-colors"
              style={{ borderColor: "hsl(var(--border))" }}
            >
              <span>🔄</span> Rotate ({rotation}°)
            </button>
          </div>

          {/* Zoom Slider */}
          <div className="flex items-center gap-3 text-xs">
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

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: "hsl(var(--border))" }}>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-lg border text-xs font-semibold hover:bg-muted transition-colors"
              style={{ borderColor: "hsl(var(--border))" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSkip}
              disabled={processing}
              className="px-4 py-2 rounded-lg border text-xs font-semibold hover:bg-muted transition-colors text-muted-foreground"
              style={{ borderColor: "hsl(var(--border))" }}
            >
              Skip Crop & Compress
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={processing}
              className="px-5 py-2 rounded-lg text-xs font-bold text-white transition-opacity hover:opacity-90 flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              style={{ background: "hsl(var(--primary))" }}
            >
              <span>✂️</span> {processing ? "Compressing..." : "Crop & Save Image"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
