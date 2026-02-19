import { useState } from "react";
import { cn } from "@/lib/utils";

interface ImageWithFallbackProps {
  src: string | null;
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
}: ImageWithFallbackProps) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [errored, setErrored] = useState(false);

  function handleError() {
    if (fallbackSrc && currentSrc !== fallbackSrc) {
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
      className={cn(imgClassName, className)}
      onError={handleError}
      loading="lazy"
    />
  );
}
