"use client";

import { useEffect } from "react";

interface ImageItem {
  url: string;
  title?: string;
}

interface ImageLightboxProps {
  images: ImageItem[];
  currentIndex: number;
  onClose: () => void;
  onNavigate?: (index: number) => void;
}

export default function ImageLightbox({
  images,
  currentIndex,
  onClose,
  onNavigate,
}: ImageLightboxProps) {
  const currentImage = images[currentIndex] || images[0];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight" && images.length > 1 && onNavigate) {
        onNavigate((currentIndex + 1) % images.length);
      } else if (e.key === "ArrowLeft" && images.length > 1 && onNavigate) {
        onNavigate((currentIndex - 1 + images.length) % images.length);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    // Prevent body scroll when lightbox is open
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [currentIndex, images, onClose, onNavigate]);

  if (!currentImage || !currentImage.url) return null;

  return (
    <div
      className="fixed inset-0 z-[99999] bg-black/92 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Top Bar / Close Button */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center text-xl font-bold transition-all shadow-lg border border-white/20"
          title="Close (Esc)"
        >
          ✕
        </button>
      </div>

      {/* Prev Navigation Arrow */}
      {images.length > 1 && onNavigate && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate((currentIndex - 1 + images.length) % images.length);
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 text-white text-2xl font-bold flex items-center justify-center transition-all shadow-lg border border-white/20 z-10"
          title="Previous image (Left Arrow)"
        >
          ‹
        </button>
      )}

      {/* Next Navigation Arrow */}
      {images.length > 1 && onNavigate && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate((currentIndex + 1) % images.length);
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 text-white text-2xl font-bold flex items-center justify-center transition-all shadow-lg border border-white/20 z-10"
          title="Next image (Right Arrow)"
        >
          ›
        </button>
      )}

      {/* Main Image Container */}
      <div
        className="relative max-w-[92vw] max-h-[88vh] flex flex-col items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={currentImage.url}
          alt={currentImage.title || "Full Screen Reference"}
          className="max-w-full max-h-[82vh] object-contain rounded-lg shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200"
        />

        {/* Caption Badge */}
        <div className="mt-3 px-4 py-1.5 rounded-full bg-black/70 border border-white/20 text-white text-xs font-semibold tracking-wide flex items-center gap-2">
          <span>📸</span>
          <span>{currentImage.title || "Reference Image"}</span>
          {images.length > 1 && (
            <span className="text-white/60 ml-2 border-l border-white/30 pl-2">
              {currentIndex + 1} / {images.length}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
