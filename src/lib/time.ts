import { SCHEDULE } from "./teams";

export function nowParis(): Date {
  const s = new Date().toLocaleString("en-US", { timeZone: SCHEDULE.timezone });
  return new Date(s);
}

export function formatClock(d: Date): string {
  return d.toLocaleTimeString("fr-FR", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    timeZone: SCHEDULE.timezone,
  });
}

export function formatDateLong(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    timeZone: SCHEDULE.timezone,
  });
}

export function formatHM(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleTimeString("fr-FR", {
    hour: "2-digit", minute: "2-digit",
    timeZone: SCHEDULE.timezone,
  });
}

export function formatShort(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    timeZone: SCHEDULE.timezone,
  });
}

/**
 * isLate — vérifie si un pointage est en retard
 * @param kind     "in" | "break" | "out"
 * @param at       moment du pointage
 * @param startTime heure de début du planning ex: "08:00"  (si fourni, remplace la config statique)
 * @param endTime   heure de fin  du planning ex: "16:00"
 */
export function isLate(
  kind: "in" | "break" | "out",
  at: Date,
  startTime?: string,   // "HH:MM" depuis le planning MySQL
  endTime?: string,
  toleranceMinutes?: number  // tolérance en minutes (défaut 5)
): boolean {
  const TOLERANCE = toleranceMinutes ?? 5;
  const paris = nowParis();
  const ref = new Date(paris);

  if (kind === "in") {
    if (startTime) {
      const [h, m] = startTime.split(":").map(Number);
      ref.setHours(h, m + TOLERANCE, 0, 0);
    } else {
      ref.setHours(SCHEDULE.startHour, SCHEDULE.startTolerance, 0, 0);
    }
  } else if (kind === "break") {
    ref.setHours(SCHEDULE.breakHour, SCHEDULE.breakTolerance, 0, 0);
  } else if (kind === "out") {
    if (endTime) {
      const [h, m] = endTime.split(":").map(Number);
      ref.setHours(h, m + TOLERANCE, 0, 0);
    } else {
      ref.setHours(SCHEDULE.endHour, SCHEDULE.endTolerance, 0, 0);
    }
  }

  const atParis = new Date(at.toLocaleString("en-US", { timeZone: SCHEDULE.timezone }));
  // Retard UNIQUEMENT si l'heure est STRICTEMENT après la limite de tolérance
  // Ex : tolérance 5min, début 9h → retard si arrivée > 9h05 (9h05 exact = pas retard)
  return atParis.getTime() > ref.getTime();
}

export function diffHours(a: Date | string, b: Date | string): number {
  const da = typeof a === "string" ? new Date(a) : a;
  const db = typeof b === "string" ? new Date(b) : b;
  return Math.max(0, (db.getTime() - da.getTime()) / 3_600_000);
}

export function fmtDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h${m.toString().padStart(2, "0")}`;
}

export function todayKey(): string {
  const p = nowParis();
  const y = p.getFullYear();
  const mo = (p.getMonth() + 1).toString().padStart(2, "0");
  const d = p.getDate().toString().padStart(2, "0");
  return `${y}-${mo}-${d}`;
}
