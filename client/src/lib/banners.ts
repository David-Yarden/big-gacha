/**
 * Banner helpers shared by the Banners page and the per-unit "Banners" sections.
 */
import type { Banner, BannerHistory, BannerUnit } from "./api";
import { gameUi } from "./gameUi";
import { weaponIconUrl, wuwaWeaponIconUrl, lightConePreviewUrl } from "./images";
import { LANG, LOCALE } from "./i18n";

const FR = LANG === "fr";

const fmt = new Intl.DateTimeFormat(LOCALE, { month: "short", day: "numeric", year: "numeric" });
const fmtShort = new Intl.DateTimeFormat(LOCALE, { month: "short", day: "numeric" });

export function formatDate(iso?: string): string {
  return iso ? fmt.format(new Date(iso)) : "";
}

/** "Sep 22 – Oct 13, 2026"; "From Jul 24, 2026" when the end is not announced */
export function dateRange(b: Banner): string {
  const s = b.start ? new Date(b.start) : null;
  const e = b.end ? new Date(b.end) : null;
  if (!s) return "";
  if (!e) return FR ? `Depuis le ${fmt.format(s)}` : `From ${fmt.format(s)}`;
  return s.getFullYear() === e.getFullYear() ? `${fmtShort.format(s)} – ${fmt.format(e)}` : `${fmt.format(s)} – ${fmt.format(e)}`;
}

export type BannerStatus = "live" | "upcoming" | "past";

export function statusOf(b: Banner, now: number): BannerStatus {
  const s = b.start ? Date.parse(b.start) : 0;
  const e = b.end ? Date.parse(b.end) : Infinity;
  if (s > now) return "upcoming";
  if (e > now) return "live";
  return "past";
}

/** "11 days" / "5 h" until a date */
export function timeUntil(iso: string | undefined, now: number): string {
  if (!iso) return "";
  const ms = Date.parse(iso) - now;
  const d = Math.floor(ms / 86_400_000);
  if (d >= 1) return FR ? `${d} jour${d > 1 ? "s" : ""}` : `${d} day${d > 1 ? "s" : ""}`;
  const h = Math.max(1, Math.floor(ms / 3_600_000));
  return `${h} h`;
}

/** "3 months" / "12 days" since a date */
export function timeSince(iso: string, now: number): string {
  const days = Math.floor((now - Date.parse(iso)) / 86_400_000);
  if (days < 1) return FR ? "aujourd'hui" : "today";
  if (days < 60) return FR ? `${days} jour${days > 1 ? "s" : ""}` : `${days} day${days > 1 ? "s" : ""}`;
  const months = Math.round(days / 30.44);
  if (months < 24) return FR ? `${months} mois` : `${months} months`;
  const years = (days / 365.25).toFixed(1);
  return FR ? `${years.replace(".", ",")} ans` : `${years} years`;
}

/** Status badge text: "Live · 11 days left", "Live · no end date announced", "In 2 days" */
export function statusText(b: Banner, now: number): string | null {
  const status = statusOf(b, now);
  if (FR) {
    if (status === "live") return b.end ? `En cours · encore ${timeUntil(b.end, now)}` : "En cours · pas de date de fin annoncée";
    if (status === "upcoming") return `Dans ${timeUntil(b.start, now)}`;
    return null;
  }
  if (status === "live") return b.end ? `Live · ${timeUntil(b.end, now)} left` : "Live · no end date announced";
  if (status === "upcoming") return `In ${timeUntil(b.start, now)}`;
  return null;
}

/** Icon of a featured character / weapon, from the site's own images */
export function unitIcon(game: string, unit: BannerUnit, units: BannerHistory["units"]): string | null {
  const images = units[`${unit.kind}:${unit.name}`]?.images;
  if (!images) return null;
  if (unit.kind === "character") return gameUi(game).portrait(images);
  if (game === "hsr") return lightConePreviewUrl(images);
  if (game === "wuwa") return wuwaWeaponIconUrl(images);
  return weaponIconUrl(images);
}

/** Page of a featured unit (null when the site does not have it) */
export function unitLink(game: string, unit: BannerUnit, known: boolean): string | null {
  if (!known) return null;
  const path = unit.kind === "character" ? "characters" : game === "hsr" ? "lightcones" : "weapons";
  return `/${game}/${path}/${encodeURIComponent(unit.name)}`;
}

