/**
 * "Gallery" tab of a character: the artwork at full size (splash art large on the left, the
 * portrait and mental breakdowns beside it), each with its original file, and the links to
 * the animated versions hosted elsewhere. A click opens a full-screen viewer, with a zoom bar
 * (slider, − / +, mouse wheel, double click; drag to move around a zoomed picture).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, ExternalLink, Maximize2, Sparkles, X, ZoomIn, ZoomOut } from "lucide-react";
import { viaCache } from "@/components/shared/ImageWithFallback";
import { cn } from "@/lib/utils";

export interface GalleryItem {
  label: string;
  src: string;
}

function Figure({ item, big, contain, onOpen }: { item: GalleryItem; big?: boolean; contain?: boolean; onOpen: () => void }) {
  const [size, setSize] = useState<string | null>(null);
  const [natural, setNatural] = useState<number | null>(null);
  useEffect(() => (setSize(null), setNatural(null)), [item.src]);
  // A small picture (the 72 px chibi) is shown at most 3× its size, not stretched to the cell
  const small = natural != null && natural < 200;
  return (
    <figure
      className={`group relative m-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-card/60 ${big ? "md:row-span-2 min-h-72" : "min-h-56"}`}
    >
      <button type="button" onClick={onOpen} className="block h-full w-full cursor-zoom-in" aria-label={item.label}>
        <img
          src={viaCache(item.src) ?? item.src}
          alt={item.label}
          loading="lazy"
          onLoad={(e) => (setSize(`${e.currentTarget.naturalWidth} × ${e.currentTarget.naturalHeight}`), setNatural(e.currentTarget.naturalWidth))}
          className={
            small
              ? "absolute inset-0 m-auto object-contain transition-transform duration-500 group-hover:scale-[1.04]"
              : `absolute inset-0 h-full w-full transition-transform duration-500 group-hover:scale-[1.02] ${contain ? "object-contain p-2" : "object-cover"}`
          }
          style={small ? { width: (natural ?? 72) * 3, height: (natural ?? 72) * 3 } : big ? { objectPosition: "60% center" } : { objectPosition: "center top" }}
        />
      </button>
      <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/85 to-transparent px-4 pb-3 pt-10 text-sm">
        <span className="font-semibold">
          {item.label}
          {size && <span className="ml-2 text-xs font-normal text-white/60">{size}</span>}
        </span>
        <a
          href={item.src}
          target="_blank"
          rel="noreferrer"
          download
          className="pointer-events-auto inline-flex items-center gap-1 text-xs font-medium text-white/80 hover:text-white"
        >
          <Download className="h-3.5 w-3.5" />
          Original file
        </a>
      </figcaption>
    </figure>
  );
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * 100) / 100));

/** Full-screen viewer: blurred backdrop, ← → and a strip of thumbnails, zoom bar, Esc to close. */
function Viewer({ items, index, onIndex, onClose }: { items: GalleryItem[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const n = items.length;
  const item = items[index];
  const go = useCallback((d: number) => onIndex((index + d + n) % n), [index, n, onIndex]);
  const [size, setSize] = useState<string | null>(null);
  const [natural, setNatural] = useState<number | null>(null);
  // Zoom and the offset of the zoomed picture (px); both start over for each picture
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number; moved: boolean; outside: boolean } | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const setZoomTo = useCallback((z: number) => {
    const next = clampZoom(z);
    setZoom(next);
    if (next === 1) setPan({ x: 0, y: 0 });
  }, []);
  useEffect(() => (setSize(null), setNatural(null), setZoom(1), setPan({ x: 0, y: 0 })), [item.src]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "+" || e.key === "=") setZoomTo(zoomRef.current + 0.5);
      else if (e.key === "-") setZoomTo(zoomRef.current - 0.5);
      else if (e.key === "0") setZoomTo(1);
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [go, onClose, setZoomTo]);
  const src = viaCache(item.src) ?? item.src;
  const round = "flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/[0.06] text-white transition hover:bg-white/15";

  return createPortal(
    <div className="fixed inset-0 z-[95] overflow-hidden bg-[#030408]" role="dialog" aria-modal="true" aria-label={item.label}>
      <img src={src} alt="" aria-hidden className="absolute -inset-10 h-[calc(100%+5rem)] w-[calc(100%+5rem)] scale-110 object-cover opacity-30 blur-3xl" />
      <div className="absolute inset-0" onClick={onClose} />

      <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 px-5 py-4 text-white">
        <p className="min-w-0 truncate text-base font-semibold">
          {item.label}
          {size && <span className="ml-2 text-sm font-normal text-white/50">{size}</span>}
        </p>
        <div className="flex shrink-0 gap-2">
          <a href={item.src} target="_blank" rel="noreferrer" download className={round} aria-label="Original file" title="Original file">
            <Download className="h-4 w-4" />
          </a>
          <button type="button" onClick={onClose} className={round} aria-label="Close" title="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* The picture: wheel and double click zoom, drag moves it once zoomed; a plain click beside it closes */}
      <div
        className={cn("absolute inset-x-4 bottom-36 top-20 overflow-hidden sm:inset-x-24", zoom > 1 ? "cursor-grab active:cursor-grabbing" : "")}
        onWheel={(e) => setZoomTo(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15))}
        onDoubleClick={() => setZoomTo(zoom > 1 ? 1 : 2.5)}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, moved: false, outside: e.target === e.currentTarget };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x;
          const dy = e.clientY - d.y;
          if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
          if (zoom > 1 && d.moved) setPan({ x: d.px + dx, y: d.py + dy });
        }}
        onPointerUp={() => {
          const d = drag.current;
          drag.current = null;
          // A click (no drag) outside the picture closes the viewer, as before
          if (d && !d.moved && zoom === 1 && d.outside) onClose();
        }}
      >
        <img
          key={item.src}
          src={src}
          alt={item.label}
          draggable={false}
          onLoad={(e) => (setSize(`${e.currentTarget.naturalWidth} × ${e.currentTarget.naturalHeight}`), setNatural(e.currentTarget.naturalWidth))}
          style={{
            ...(natural != null && natural < 200 ? { width: natural * 4, height: natural * 4 } : {}),
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transition: drag.current ? "none" : "transform 120ms ease-out",
          }}
          className="absolute inset-0 m-auto max-h-full max-w-full select-none object-contain drop-shadow-2xl"
        />
      </div>

      {/* Zoom bar */}
      <div className="absolute inset-x-0 bottom-24 mx-auto flex w-max items-center gap-2 rounded-full border border-white/15 bg-black/50 px-3 py-1.5 text-white backdrop-blur">
        <button type="button" onClick={() => setZoomTo(zoom - 0.5)} disabled={zoom <= MIN_ZOOM} className="rounded-full p-1 hover:bg-white/15 disabled:opacity-40" aria-label="Zoom out" title="Zoom out (−)">
          <ZoomOut className="h-4 w-4" />
        </button>
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoomTo(Number(e.target.value))}
          aria-label="Zoom"
          className="w-32 accent-white sm:w-48"
        />
        <button type="button" onClick={() => setZoomTo(zoom + 0.5)} disabled={zoom >= MAX_ZOOM} className="rounded-full p-1 hover:bg-white/15 disabled:opacity-40" aria-label="Zoom in" title="Zoom in (+)">
          <ZoomIn className="h-4 w-4" />
        </button>
        <span className="w-12 text-center text-xs tabular-nums text-white/80">{`${Math.round(zoom * 100)}%`}</span>
        <button type="button" onClick={() => setZoomTo(1)} disabled={zoom === 1} className="rounded-full p-1 hover:bg-white/15 disabled:opacity-40" aria-label="Fit" title="Fit (0)">
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {n > 1 && (
        <>
          <button type="button" onClick={() => go(-1)} className={cn(round, "absolute left-4 top-1/2 h-12 w-12 -translate-y-1/2")} aria-label="Previous">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button type="button" onClick={() => go(1)} className={cn(round, "absolute right-4 top-1/2 h-12 w-12 -translate-y-1/2")} aria-label="Next">
            <ChevronRight className="h-6 w-6" />
          </button>
          <div className="absolute inset-x-0 bottom-5 mx-auto flex w-max max-w-full gap-2.5 overflow-x-auto px-4 pb-1">
            {items.map((g, i) => (
              <button
                key={g.src}
                type="button"
                onClick={() => onIndex(i)}
                aria-label={g.label}
                title={g.label}
                className={cn(
                  "h-16 w-20 shrink-0 overflow-hidden rounded-lg border bg-white/5 transition",
                  i === index ? "border-white opacity-100" : "border-white/15 opacity-55 hover:opacity-90"
                )}
              >
                <img src={viaCache(g.src) ?? g.src} alt="" className="h-full w-full object-cover object-top" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>,
    document.body
  );
}

export function ArtGallery({
  gallery,
  animated,
  cards,
}: {
  gallery?: GalleryItem[];
  animated?: Array<{ label: string; url: string }>;
  /** Card art, shown under the artwork (one viewer for all) */
  cards?: GalleryItem[];
}) {
  const art = gallery ?? [];
  const cardArt = cards ?? [];
  const items = [...art, ...cardArt];
  const links = animated ?? [];
  const [open, setOpen] = useState<number | null>(null);
  if (!art.length && !links.length && !cardArt.length) return <p className="text-sm text-muted-foreground">No artwork yet.</p>;
  // The splash art (landscape) gets the big cell; the others are portraits
  const [first, ...rest] = art;
  const landscape = first?.label === "Splash art";
  // The first picture (splash art, or a partner's illustration) gets the big cell

  return (
    <div className="space-y-6">
    <div className="grid auto-rows-[18rem] gap-3.5 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
      {first && <Figure item={first} big contain={!landscape} onOpen={() => setOpen(0)} />}
      {rest.map((g, i) => (
        <Figure key={g.label} item={g} contain={/breakdown|portrait/i.test(g.label) && !landscape ? true : /breakdown/i.test(g.label)} onOpen={() => setOpen(i + 1)} />
      ))}
    </div>

    {links.length > 0 && (
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Animated</span>
        {links.map((l) => (
          <a
            key={l.url}
            href={l.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-sm text-primary hover:bg-white/5"
            title="CZN Animation Viewer (fan-made reference site)"
          >
            <Sparkles className="h-4 w-4 opacity-70" />
            {l.label}
            <ExternalLink className="h-3.5 w-3.5 opacity-60" />
          </a>
        ))}
      </div>
    )}

    {cardArt.length > 0 && (
      <section className="space-y-3">
        <h3 className="text-base font-semibold">{`Card art (${cardArt.length})`}</h3>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {cardArt.map((c, i) => (
            <button
              key={c.src}
              type="button"
              onClick={() => setOpen(art.length + i)}
              className="group space-y-1 text-left"
              aria-label={c.label}
            >
              <span className="block aspect-[2/3] overflow-hidden rounded-lg border border-white/[0.08] bg-card/60">
                <img
                  src={viaCache(c.src) ?? c.src}
                  alt=""
                  loading="lazy"
                  className="h-full w-full scale-[1.06] object-cover transition-transform duration-500 group-hover:scale-[1.1]"
                />
              </span>
              <span className="block truncate text-xs text-muted-foreground" title={c.label}>
                {c.label}
              </span>
            </button>
          ))}
        </div>
      </section>
    )}
    {open != null && items[open] && <Viewer items={items} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </div>
  );
}
