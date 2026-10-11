/**
 * A Chaos Zero Nightmare card drawn like in the game (reference: in-game screenshots of
 * hands, the Epiphany choice and Divine Epiphany screens):
 * - the card art fills the card, inside a thin dark frame with small rounded corners;
 * - top left: the cost (thin white numeral, blue glow, short underline), the name next to it
 *   in the rarity colour and the type below (the game's square type icon + label);
 * - an epiphany card has a strip of sparkles along its left edge in the owner's attribute
 *   colour and the golden epiphany sight under its cost; a divine epiphany adds an iridescent
 *   frame and its line at the end of the text, after the god's sigil;
 * - a sparkle divider in the middle, the text centred below: keywords "[ Retain ]" in orange,
 *   numbers in cyan (green when an epiphany changed them).
 * Every size is a share of the card's width (container units): the card looks the same at
 * any size.
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ImageWithFallback, viaCache } from "@/components/shared/ImageWithFallback";
import { cn } from "@/lib/utils";

export interface CznCardData {
  name: string;
  cost?: number;
  type?: string;
  desc?: string;
  rarity?: string;
  image?: string;
}

// Name colour of each rarity, as in the game
const NAME_COLOR: Record<string, string> = {
  Normal: "#ffffff",
  Common: "#ffffff",
  Rare: "#7fd2ff",
  Legendary: "#ffc54d",
  Mythic: "#ff7d9c",
  Unique: "#ff7d9c",
};

// Attribute colours (epiphany strip)
export const ATTRIBUTE_COLOR: Record<string, string> = {
  Passion: "#ef4b72",
  Justice: "#3f8cff",
  Order: "#3cc47c",
  Instinct: "#f59a2c",
  Void: "#a05cff",
};

// The game's card type icons (hub-czn-updated, MIT)
const TYPE_ICON_BASE = "https://raw.githubusercontent.com/steve1316/hub-czn-updated/master/src/pages/deck-builder/data/neutral-cards/types";
const TYPE_ICON: Record<string, string> = {
  Attack: `${TYPE_ICON_BASE}/attack.webp`,
  Skill: `${TYPE_ICON_BASE}/skill.webp`,
  Upgrade: `${TYPE_ICON_BASE}/upgrade.webp`,
};

const KEYWORD = "#f4a93d"; // "[ Retain ]"
const NUMBER = "#5ccfff";
const NUMBER_CHANGED = "#8fe35c";
const OUTLINE = "[text-shadow:0_0_0.6cqw_#000,0_0.3cqw_0.8cqw_rgba(0,0,0,0.95),0_0_2cqw_rgba(0,0,0,0.6)]";

/** Game text → coloured runs: "**Retain**" keywords, [[#hex|text]] colours, numbers.
 *  Keywords that open the text get their own centred line, as in the game. */
function renderText(text: string, numberColor: string): ReactNode[] {
  const out: ReactNode[] = [];
  let k = 0;
  const lead = text.match(/^\s*((?:\*\*[^*]+\*\*\s*)+)/);
  if (lead) {
    const words = [...lead[1].matchAll(/\*\*([^*]+)\*\*/g)].map((m) => m[1]);
    out.push(
      <span key={k++} className="block" style={{ color: KEYWORD }}>
        {words.map((w) => `[ ${w} ]`).join(" ")}
      </span>
    );
    text = text.slice(lead[0].length);
  }
  const numbers = (s: string) => {
    for (const part of s.split(/(\d+(?:\.\d+)?)/)) {
      if (!part) continue;
      out.push(/^\d/.test(part) ? <span key={k++} style={{ color: numberColor }}>{part}</span> : part);
    }
  };
  for (const seg of text.split(/(\*\*[^*]+\*\*|\[\[#[0-9A-Fa-f]{6}\|[^\]]+\]\])/)) {
    if (!seg) continue;
    const kw = seg.match(/^\*\*([^*]+)\*\*$/);
    const col = seg.match(/^\[\[(#[0-9A-Fa-f]{6})\|([^\]]+)\]\]$/);
    if (kw) out.push(<span key={k++} style={{ color: KEYWORD }}>{`[ ${kw[1]} ]`}</span>);
    else if (col) out.push(<span key={k++} style={{ color: col[1] }}>{col[2]}</span>);
    else numbers(seg);
  }
  return out;
}

// Colour of each god's sigil (divine epiphanies)
export const GOD_COLOR: Record<string, string> = {
  Nihilum: "#a07bff",
  Sekred: "#4fd8c8",
  Vytor: "#7fd65a",
  Caligo: "#ff5a78",
  Kyrken: "#f2c14e",
  Diallos: "#5b93ff",
};

// The gods' sigils (CZN wiki, "<God> faction icon"); none is published for Caligo
const GOD_ICON: Record<string, string> = {
  Kyrken: "https://static.wikitide.net/cznwiki/3/3f/Kyrken_faction_icon.png",
  Diallos: "https://static.wikitide.net/cznwiki/1/18/Diallos_faction_icon.png",
  Sekred: "https://static.wikitide.net/cznwiki/3/39/Sekred_faction_icon.png",
  Vytor: "https://static.wikitide.net/cznwiki/2/25/Vytor_faction_icon.png",
  Nihilum: "https://static.wikitide.net/cznwiki/9/92/Nihilum_faction_icon.png",
};

/** A god's sigil: the game's emblem glowing in the god's colour (a drawn star when unknown). */
export function GodSigil({ god, className }: { god?: string; className?: string }) {
  const c = GOD_COLOR[god ?? ""] ?? "#ffd66b";
  const icon = GOD_ICON[god ?? ""];
  if (icon) {
    return (
      <img
        src={viaCache(icon) ?? icon}
        alt={god}
        className={className}
        style={{ filter: `drop-shadow(0 0 1.5px ${c}) drop-shadow(0 0 3px ${c})`, objectFit: "contain" }}
      />
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="10.5" fill="none" stroke={c} strokeWidth="1.4" opacity="0.8" />
      <path d="M12 2.5 L14 10 L21.5 12 L14 14 L12 21.5 L10 14 L2.5 12 L10 10 Z" fill={c} />
      <circle cx="12" cy="12" r="2" fill="#fff" />
    </svg>
  );
}

/** The "· · ✦ · ·" divider above the text. */
function Divider() {
  return (
    <svg viewBox="0 0 100 10" className="mx-auto block h-[3.4cqw] w-[44cqw]" aria-hidden>
      <defs>
        <linearGradient id="czn-div" x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="4" y="4.6" width="92" height="0.8" fill="url(#czn-div)" />
      {[14, 24, 34, 66, 76, 86].map((x) => (
        <circle key={x} cx={x} cy="5" r={x === 34 || x === 66 ? 1.2 : 0.8} fill="#fff" opacity={x === 14 || x === 86 ? 0.5 : 0.85} />
      ))}
      <path d="M50 0 L51.4 3.6 L55 5 L51.4 6.4 L50 10 L48.6 6.4 L45 5 L48.6 3.6 Z" fill="#fff" />
      <path d="M42 2.6 L42.6 4.4 L44.4 5 L42.6 5.6 L42 7.4 L41.4 5.6 L39.6 5 L41.4 4.4 Z" fill="#fff" opacity="0.8" />
      <path d="M58 2.6 L58.6 4.4 L60.4 5 L58.6 5.6 L58 7.4 L57.4 5.6 L55.6 5 L57.4 4.4 Z" fill="#fff" opacity="0.8" />
    </svg>
  );
}

/** Golden sight shown under the cost of an epiphany card. */
function EpiphanySight() {
  return (
    <svg viewBox="0 0 24 24" className="h-[9cqw] w-[9cqw] drop-shadow-[0_0_1cqw_rgba(255,200,90,0.8)]" aria-hidden>
      <circle cx="12" cy="12" r="6.2" fill="none" stroke="#ffd36e" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="2.2" fill="#fff4cf" />
      {[
        [12, 1, 12, 6.5],
        [12, 17.5, 12, 23],
        [1, 12, 6.5, 12],
        [17.5, 12, 23, 12],
      ].map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#ffd36e" strokeWidth="1.6" strokeLinecap="round" />
      ))}
    </svg>
  );
}

/** Strip of sparkles along the left edge of an epiphany card. */
function EpiphanyStrip({ color }: { color: string }) {
  return (
    <div
      className="absolute inset-y-0 left-0 w-[4.5cqw]"
      style={{ background: `linear-gradient(90deg, ${color} 0%, ${color}cc 55%, ${color}00 100%)`, boxShadow: `0 0 3cqw ${color}aa` }}
      aria-hidden
    >
      <svg viewBox="0 0 10 100" preserveAspectRatio="none" className="h-full w-full">
        {[12, 26, 40, 54, 68, 82].map((y) => (
          <path key={y} d={`M4 ${y - 2.2} L4.8 ${y - 0.5} L6.6 ${y} L4.8 ${y + 0.5} L4 ${y + 2.2} L3.2 ${y + 0.5} L1.4 ${y} L3.2 ${y - 0.5} Z`} fill="#fff" opacity="0.85" />
        ))}
      </svg>
    </div>
  );
}

export function CardFace({
  card,
  attribute,
  epiphany = false,
  divine,
  extra,
  className,
  onClick,
}: {
  card: CznCardData;
  /** Owner's attribute: colour of the epiphany strip */
  attribute?: string;
  /** An epiphany variant: strip + sight, changed numbers in green */
  epiphany?: boolean;
  /** A divine epiphany added to the card */
  divine?: { text: string; god?: string };
  /** Other effects added to the card (common epiphany), one line each */
  extra?: string[];
  className?: string;
  onClick?: () => void;
}) {
  const cost = card.cost == null ? "–" : card.cost < 0 ? "X" : String(card.cost);
  const nameColor = NAME_COLOR[card.rarity ?? ""] ?? NAME_COLOR.Normal;
  const stripColor = ATTRIBUTE_COLOR[attribute ?? ""] ?? "#e94b8f";
  const numberColor = epiphany ? NUMBER_CHANGED : NUMBER;

  // Long texts get smaller until they fit, like in the game
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => setScale(1), [card.desc, divine?.text, extra?.join("|")]);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    // Content may overflow upwards (bottom-anchored): add the children's heights up
    const used = [...el.children].reduce((sum, c) => sum + (c as HTMLElement).offsetHeight, 0) + 4;
    if (used > el.clientHeight && scale > 0.45) setScale((s) => Math.round((s - 0.06) * 100) / 100);
  }, [scale, card.desc, divine?.text, extra]);

  return (
    // A div even when clickable: a <button> would centre the card's content vertically
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onClick()) : undefined}
      className={cn(
        // Own sizes in % / px: container units on the container itself would follow the page width
        "@container relative block aspect-[2/3] w-full select-none overflow-hidden rounded-[4%/2.7%] bg-[#10131b] text-left font-medium",
        divine ? "p-[2px]" : "border border-[#2a3142]",
        onClick && "cursor-pointer transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        className
      )}
      style={
        divine
          ? { background: "conic-gradient(from 210deg, #ffd56b, #ff7ad9, #8f7bff, #5fd8ff, #7dffb0, #ffd56b)" }
          : undefined
      }
    >
      <div className="relative h-full w-full overflow-hidden rounded-[3.4%/2.3%]">
        {card.image ? (
          // The card pictures carry their own rounded edge: zoomed in slightly to hide it
          <ImageWithFallback src={card.image} alt="" className="absolute inset-0 h-full w-full" imgClassName="h-full w-full scale-[1.08] object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#2a3550] to-[#0b0e16]" />
        )}
        {/* The game darkens the top a little and the lower half a lot */}
        <div className="absolute inset-x-0 top-0 h-[26%] bg-gradient-to-b from-black/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-black/90 via-black/65 via-60% to-transparent" />
        {epiphany && <EpiphanyStrip color={stripColor} />}

        {/* Cost, name, type */}
        <div className={cn("relative flex items-start gap-[2.5cqw] pl-[6cqw] pr-[3cqw] pt-[3cqw]", OUTLINE)}>
          <div className="flex shrink-0 flex-col items-center">
            <span className="text-[21cqw] font-light leading-[0.95] text-white [text-shadow:0_0_2cqw_#59b8ff,0_0_0.6cqw_#2a7dff]">{cost}</span>
            <span className="mt-[0.6cqw] block h-[0.9cqw] w-[12cqw] rounded-full bg-[#bfe6ff] shadow-[0_0_1.5cqw_#59b8ff]" />
            {divine ? (
              <span className="mt-[2cqw]">
                <GodSigil god={divine.god} className="h-[10cqw] w-[10cqw]" />
              </span>
            ) : (
              epiphany && (
                <span className="mt-[2cqw]">
                  <EpiphanySight />
                </span>
              )
            )}
          </div>
          <div className="min-w-0 flex-1 pt-[1.4cqw]">
            <p className="truncate text-[8.4cqw] font-medium leading-tight tracking-[-0.01em]" style={{ color: nameColor }} title={card.name}>
              {card.name}
            </p>
            {card.type && (
              <p className="mt-[0.8cqw] flex items-center gap-[1.6cqw] text-[7cqw] leading-none text-white">
                {TYPE_ICON[card.type] && <img src={viaCache(TYPE_ICON[card.type]) ?? ""} alt="" className="h-[7.2cqw] w-[7.2cqw] rounded-[0.8cqw]" />}
                {card.type}
              </p>
            )}
          </div>
        </div>

        {/* Text anchored to the bottom, the divider right above it (as in the game) */}
        <div ref={box} className={cn("absolute inset-x-[4.5cqw] bottom-[6cqw] top-[36%] flex flex-col justify-end overflow-hidden", OUTLINE)}>
          <Divider />
          <div className="mt-[2.4cqw] whitespace-pre-line text-center leading-[1.3] text-white [text-wrap:balance]" style={{ fontSize: `${7.4 * scale}cqw` }}>
            {card.desc ? renderText(card.desc, numberColor) : <span className="italic text-white/60">No text yet.</span>}
            {extra?.map((line, i) => (
              <span key={i} className="mt-[0.6cqw] block">
                {renderText(line, numberColor)}
              </span>
            ))}
            {divine && (
              <span className="mt-[1cqw] block font-semibold">
                <GodSigil god={divine.god} className="mr-[1cqw] inline-block h-[6.4cqw] w-[6.4cqw] align-[-1.2cqw]" />
                {renderText(divine.text, "#ffd66b")}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
