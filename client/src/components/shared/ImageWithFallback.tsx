import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// Game CDNs served through the API's local image cache (src/routes/img.js)
const CACHED_HOSTS = [
  "githubusercontent.com", "encore.moe", "yatta.moe", "enka.network", "jmp.blue",
  "hoyolab.com", "mihoyo.com", "hoyoverse.com", "wikia.nocookie.net", "nanoka.cc", "gachabase.net",
];

export function viaCache(src: string | null): string | null {
  if (!src || !src.startsWith("https://")) return src;
  try {
    const host = new URL(src).hostname;
    if (!CACHED_HOSTS.some((d) => host === d || host.endsWith(`.${d}`))) return src;
  } catch {
    return src;
  }
  return `/api/img?u=${encodeURIComponent(src)}`;
}

interface ImageWithFallbackProps {
  src: string | null;
  /** Serve through the local image cache (default). Off for large art. */
  cache?: boolean;
  alt: string;
  fallbackSrc?: string | null;
  fallbackText?: string;
  className?: string;
  imgClassName?: string;
}

export function ImageWithFallback({
  src,
  alt,
  fallbackSrc,
  fallbackText,
  className,
  imgClassName,
  cache = true,
}: ImageWithFallbackProps) {
  const first = cache ? viaCache(src) : src;
  const [currentSrc, setCurrentSrc] = useState(first);
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // A reused component (list re-render, element switch) must follow its new src
  useEffect(() => {
    setCurrentSrc(cache ? viaCache(src) : src);
    setErrored(false);
    setLoaded(false);
  }, [src, cache]);

  function handleError() {
    // The cache could not serve it: try the CDN directly before the fallback
    if (src && currentSrc !== src && currentSrc?.startsWith("/api/img")) {
      setCurrentSrc(src);
    } else if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
    } else {
      setErrored(true);
    }
  }

  if (!currentSrc || errored) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted/30",
          className
        )}
      >
        <span className="text-3xl font-bold text-foreground/20">
          {fallbackText ?? alt.charAt(0)}
        </span>
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={cn(
        "transition-opacity duration-300",
        loaded ? "opacity-100" : "opacity-0",
        imgClassName,
        className
      )}
      onLoad={() => setLoaded(true)}
      onError={handleError}
      loading="lazy"
      decoding="async"
    />
  );
}
