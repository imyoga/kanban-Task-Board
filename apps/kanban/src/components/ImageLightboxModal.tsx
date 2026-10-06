import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export interface ImageLightboxModalProps {
  isOpen: boolean;
  src: string;
  alt?: string;
  onClose: () => void;
}

export default function ImageLightboxModal({
  isOpen,
  src,
  alt = "Image preview",
  onClose,
}: ImageLightboxModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, onClose]);

  if (!isOpen || !src || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[999999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 select-none animate-in fade-in duration-200 cursor-zoom-out"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
    >
      <div
        className="relative max-w-[95vw] max-h-[92vh] flex flex-col items-center justify-center cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={alt}
          className="max-h-[85vh] max-w-[92vw] w-auto h-auto rounded-lg object-contain shadow-2xl border border-white/10 select-auto"
        />

        {/* Floating Top-Right Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-3.5 -right-3.5 p-2 rounded-full bg-zinc-900/95 text-zinc-100 hover:bg-zinc-800 hover:text-white border border-white/20 shadow-2xl transition-transform hover:scale-110 active:scale-95 cursor-pointer z-10"
          title="Close (Esc)"
        >
          <X className="w-5 h-5" />
        </button>

        {alt && alt !== "screenshot" && alt !== "image" && alt !== "uploaded image" && (
          <div className="mt-2.5 text-xs text-zinc-300 bg-zinc-900/80 px-3.5 py-1 rounded-full border border-white/10 max-w-lg truncate text-center shadow-lg">
            {alt}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
