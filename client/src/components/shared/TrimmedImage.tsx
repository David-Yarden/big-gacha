/**
 * An image with its transparent margins cut away, so a frame can fit the visible
 * part exactly (e.g. Genshin wish art: a thin weapon inside a 512×1024 canvas).
 * Falls back to the plain image when the pixels cannot be read.
 */
import { useEffect, useRef, useState } from "react";
import { viaCache } from "@/components/shared/ImageWithFallback";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function opaqueBounds(img: HTMLImageElement): Box | null {
  const { naturalWidth: W, naturalHeight: H } = img;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, W, H).data; // throws on a cross-origin image
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] > 12) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export function TrimmedImage({
  src,
  fallbackSrc,
  alt,
  maxWidth,
  maxHeight,
}: {
  src: string;
  fallbackSrc?: string | null;
  alt: string;
  maxWidth: number;
  maxHeight: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<{ box: Box; img: HTMLImageElement } | "plain" | "failed" | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      try {
        const box = opaqueBounds(img);
        setState(box ? { box, img } : "plain");
      } catch {
        setState("plain");
      }
    };
    img.onerror = () => !cancelled && setState("failed");
    img.src = viaCache(src) ?? src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  // Draw the visible part at a size that fits the limits, keeping its proportions
  const box = state && typeof state === "object" ? state.box : null;
  const scale = box ? Math.min(maxWidth / box.w, maxHeight / box.h) : 1;
  const w = box ? Math.round(box.w * scale) : maxWidth;
  const h = box ? Math.round(box.h * scale) : maxHeight;

  useEffect(() => {
    if (!state || typeof state !== "object" || !canvasRef.current) return;
    const dpr = window.devicePixelRatio || 1;
    const c = canvasRef.current;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(state.img, state.box.x, state.box.y, state.box.w, state.box.h, 0, 0, c.width, c.height);
  }, [state, w, h]);

  if (state === "plain" || state === "failed") {
    const s = state === "failed" && fallbackSrc ? fallbackSrc : src;
    return <img src={viaCache(s) ?? s} alt={alt} style={{ maxWidth, maxHeight }} className="object-contain" />;
  }
  if (!state) return <div style={{ width: maxWidth / 2, height: maxHeight }} className="animate-pulse rounded-lg bg-muted/30" />;
  return <canvas ref={canvasRef} role="img" aria-label={alt} style={{ width: w, height: h }} />;
}
