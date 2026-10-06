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

  const handleClose = (e?: React.SyntheticEvent | MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[999999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 select-none animate-in fade-in duration-200 cursor-zoom-out"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose(e);
        }
      }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
    >
      {/* Top-Right Fixed Viewport Close Button (clear of any modal dialog elements underneath) */}
      <button
        type="button"
        onClick={handleClose}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onPointerUp={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onMouseUp={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className="fixed top-5 right-5 sm:top-6 sm:right-6 p-2.5 rounded-full bg-zinc-900/90 text-zinc-100 hover:bg-zinc-800 hover:text-white border border-white/20 shadow-2xl transition-all hover:scale-110 active:scale-95 cursor-pointer z-[1000000] backdrop-blur-md"
        title="Close preview (Esc)"
        aria-label="Close image preview"
      >
        <X className="w-5 h-5" />
      </button>

      <div
        className="relative max-w-[95vw] max-h-[92vh] flex flex-col items-center justify-center cursor-default"
        onClick={(e) => {
          e.stopPropagation();
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
      >
        <img
          src={src}
          alt={alt}
          className="max-h-[85vh] max-w-[92vw] w-auto h-auto rounded-lg object-contain shadow-2xl border border-white/10 select-auto"
          onClick={(e) => {
            e.stopPropagation();
          }}
        />

        {alt && alt !== "screenshot" && alt !== "image" && alt !== "uploaded image" && (
          <div className="mt-2.5 text-xs text-zinc-300 bg-zinc-900/80 px-3.5 py-1 rounded-full border border-white/10 max-w-lg truncate text-center shadow-lg select-text">
            {alt}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
