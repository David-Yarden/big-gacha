import { useState } from "react";
import { cn } from "@/lib/utils";

interface ImageWithFallbackProps {
  src: string | null;
  alt: string;
  fallbackText?: string;
  className?: string;
  imgClassName?: string;
}

export function ImageWithFallback({
  src,
  alt,
  fallbackText,
  className,
  imgClassName,
}: ImageWithFallbackProps) {
  const [errored, setErrored] = useState(false);

  if (!src || errored) {
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
      src={src}
      alt={alt}
      className={cn(imgClassName, className)}
      onError={() => setErrored(true)}
      loading="lazy"
    />
  );
}
