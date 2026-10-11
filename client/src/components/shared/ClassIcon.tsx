/**
 * A class / specialty icon. The CZN class icons are a small glyph inside a wide transparent
 * margin: they are trimmed so the glyph fills the requested size.
 */
import { TrimmedImage } from "@/components/shared/TrimmedImage";
import { viaCache } from "@/components/shared/ImageWithFallback";

export function ClassIcon({ src, size, className }: { src: string; size: number; className?: string }) {
  if (/_class_icon/.test(src)) {
    return (
      <span className={`inline-flex shrink-0 items-center justify-center ${className ?? ""}`} style={{ width: size, height: size }}>
        <TrimmedImage src={src} alt="" maxWidth={size} maxHeight={size} />
      </span>
    );
  }
  return <img src={viaCache(src) ?? src} alt="" className={`shrink-0 ${className ?? ""}`} style={{ width: size, height: size }} />;
}
