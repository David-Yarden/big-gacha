import * as React from "react";
import { Slider as SliderPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  thumbIcon,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & {
  /** Image shown inside a larger thumb (e.g. the skill's button icon) */
  thumbIcon?: string | null;
}) {
  const _values = value ?? defaultValue ?? [min];
  // Screen readers announce the thumb: give it a name (callers may pass aria-label)
  const label = props["aria-label"] ?? "Level";

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      {_values.map((_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          aria-label={label}
          className={cn(
            "block rounded-full border bg-background shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            thumbIcon ? "h-7 w-7 cursor-grab border-primary/70 bg-black p-0.5 active:cursor-grabbing" : "h-4 w-4 border-primary/50"
          )}
        >
          {thumbIcon && <img src={thumbIcon} alt="" draggable={false} className="pointer-events-none h-full w-full rounded-full object-contain" />}
        </SliderPrimitive.Thumb>
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
