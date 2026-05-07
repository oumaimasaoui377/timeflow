// =====================================================================
// Store — appels API PHP/MySQL (XAMPP)
// Chaque fonction effectue un fetch() vers /api/*.php
// =====================================================================
import { TeamId, TEAMS } from "./teams";

export type PunchKind = "in" | "break_out" | "break_in" | "out";
export type Location = "onsite" | "remote";
export type PeriodFilter = "week" | "month" | "year";

export interface UserRecord {
  id: string;
  fullName: string;
  email: string;
  teamId: TeamId;
  role: "member" | "admin";
  createdAt: string;
}

export interface PunchRecord {
  id: string;
  userId: string;
  userFullName: string;
  teamId: TeamId;
  kind: PunchKind;
  location: Location;
  at: string;           // ISO string
  validated: boolean;
  late: boolean;
  justification?: string | null;
}

export interface DaySchedule {
  dayOfWeek: number;    // 1=Lun … 7=Dim
  startTime: string;    // "HH:MM"
  endTime: string;
  breakStart?: string;  // "HH:MM" heure début pause (optionnel)
  breakEnd?: string;    // "HH:MM" heure fin pause (optionnel)
  toleranceMinutes?: number; // défaut 5
}

export interface RhComment {
  id: string;
  adminId: string;
  adminName: string;
  teamId: TeamId;
  periodFrom: string;
  periodTo: string;
  comment: string;
  createdAt: string;
}

const BASE = "/api";

// ─── Session (localStorage pour le token/user courant uniquement) ───
const SESSION_KEY = "timeflow.session";

export function getSession(): UserRecord | null {
  try {
    const v = localStorage.getItem(SESSION_KEY);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}
export function setSession(user: UserRecord | null) {
  if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  else localStorage.removeItem(SESSION_KEY);
}

// ─── Helpers ───
function mapUser(r: Record<string, unknown>): UserRecord {
  return {
    id:        String(r.id),
    fullName:  String(r.full_name ?? r.fullName ?? ""),
    email:     String(r.email),
    teamId:    String(r.team_id ?? r.teamId) as TeamId,
    role:      String(r.role) as "member" | "admin",
    createdAt: String(r.created_at ?? r.createdAt ?? ""),
  };
}

function mapPunch(r: Record<string, unknown>): PunchRecord {
  return {
    id:            String(r.id),
    userId:        String(r.user_id ?? r.userId),
    userFullName:  String(r.user_full_name ?? r.userFullName ?? ""),
    teamId:        String(r.team_id ?? r.teamId) as TeamId,
    kind:          String(r.kind) as PunchKind,
    location:      String(r.location) as Location,
    at:            String(r.at_time ?? r.at),
    validated:     r.validated === 1 || r.validated === true || r.validated === "1",
    late:          r.late === 1 || r.late === true || r.late === "1",
    justification: r.justification != null ? String(r.justification) : null,
  };
}

// ─── Auth ───
export async function loginApi(email: string, password: string): Promise<UserRecord> {
  const res = await fetch(`${BASE}/users.php?action=login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Erreur connexion");
  return mapUser(data.user);
}

// ─── Users ───
export async function listUsers(): Promise<UserRecord[]> {
  const res = await fetch(`${BASE}/users.php`);
  const data = await res.json();
  return (data as Record<string, unknown>[]).map(mapUser);
}

export async function createUser(u: {
  fullName: string; email: string; password: string; teamId: TeamId; role?: "member" | "admin";
}): Promise<UserRecord> {
  const res = await fetch(`${BASE}/users.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fullName: u.fullName, email: u.email, password: u.password, teamId: u.teamId, role: u.role ?? "member" }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Erreur création utilisateur");
  // Après l'inscription, on se connecte directement pour récupérer le user complet
  return await loginApi(u.email, u.password);
}

export async function deleteUser(id: string): Promise<void> {
  await fetch(`${BASE}/users.php?id=${id}`, { method: "DELETE" });
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const users = await listUsers();
  return users.find(u => u.email.toLowerCase() === email.toLowerCase()) ?? null;
}

// ─── Punches ───
export async function listPunchesByUserToday(userId: string): Promise<PunchRecord[]> {
  const res = await fetch(`${BASE}/punches.php?user_id=${encodeURIComponent(userId)}&today=1`);
  const data = await res.json();
  return (data as Record<string, unknown>[]).map(mapPunch)
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

export async function listPunchesByUserPeriod(
  userId: string,
  period: PeriodFilter,
  ref: string     // YYYY-MM-DD
): Promise<PunchRecord[]> {
  const res = await fetch(`${BASE}/punches.php?user_id=${encodeURIComponent(userId)}&period=${period}&ref=${ref}`);
  const data = await res.json();
  return (data as Record<string, unknown>[]).map(mapPunch)
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

export async function listPunchesByTeam(teamId: TeamId, from?: string, to?: string): Promise<PunchRecord[]> {
  let url = `${BASE}/punches.php?team_id=${teamId}`;
  if (from) url += `&from=${from}`;
  if (to)   url += `&to=${to}`;
  const res = await fetch(url);
  const data = await res.json();
  return (data as Record<string, unknown>[]).map(mapPunch);
}

export async function addPunch(p: Omit<PunchRecord, "id">): Promise<PunchRecord> {
  const res = await fetch(`${BASE}/punches.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: p.userId, userFullName: p.userFullName, teamId: p.teamId,
      kind: p.kind, location: p.location, at: p.at, late: p.late,
      justification: p.justification ?? null,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Erreur pointage");
  return { ...p, id: data.id };
}

export async function updatePunch(id: string, patch: Partial<PunchRecord>): Promise<void> {
  const body: Record<string, unknown> = {};
  if (patch.validated !== undefined) body.validated = patch.validated;
  if (patch.late !== undefined)      body.late = patch.late;
  if (patch.at !== undefined)        body.at = patch.at;
  if ("justification" in patch)      body.justification = patch.justification ?? null;
  await fetch(`${BASE}/punches.php?id=${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ─── Schedules ───
export async function getSchedule(teamId: TeamId): Promise<DaySchedule[]> {
  const res = await fetch(`${BASE}/schedules.php?team_id=${teamId}`);
  const data = await res.json();
  return (data as Record<string, unknown>[]).map(r => ({
    dayOfWeek: Number(r.day_of_week),
    startTime: String(r.start_time).slice(0, 5),
    endTime:   String(r.end_time).slice(0, 5),
    toleranceMinutes: 5,
  }));
}

export async function saveSchedule(teamId: TeamId, adminId: string, days: DaySchedule[]): Promise<void> {
  await fetch(`${BASE}/schedules.php`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teamId, adminId, days }),
  });
}

// ─── Planning individuel membre ───
export async function getMemberSchedule(userId: string): Promise<DaySchedule[]> {
  try {
    const res = await fetch(`${BASE}/member_schedules.php?user_id=${encodeURIComponent(userId)}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map(r => ({
      dayOfWeek:         Number(r.day_of_week),
      startTime:         String(r.start_time).slice(0, 5),
      endTime:           String(r.end_time).slice(0, 5),
      breakStart:        r.break_start ? String(r.break_start).slice(0, 5) : undefined,
      breakEnd:          r.break_end   ? String(r.break_end).slice(0, 5)   : undefined,
      toleranceMinutes:  Number(r.tolerance_minutes ?? 5),
    }));
  } catch { return []; }
}

export async function saveMemberSchedule(userId: string, days: DaySchedule[]): Promise<void> {
  await fetch(`${BASE}/member_schedules.php`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      days: days.map(d => ({
        dayOfWeek:         d.dayOfWeek,
        startTime:         d.startTime,
        endTime:           d.endTime,
        breakStart:        d.breakStart || null,
        breakEnd:          d.breakEnd   || null,
        toleranceMinutes:  d.toleranceMinutes ?? 5,
      })),
    }),
  });
}

export async function deleteMemberSchedule(userId: string): Promise<void> {
  await fetch(`${BASE}/member_schedules.php?user_id=${encodeURIComponent(userId)}`, { method: "DELETE" });
}

// ─── RH Comments ───
export async function listRhComments(teamId: TeamId, from?: string, to?: string): Promise<RhComment[]> {
  let url = `${BASE}/rh_comments.php?team_id=${teamId}`;
  if (from) url += `&from=${from}`;
  if (to)   url += `&to=${to}`;
  const res = await fetch(url);
  const data = await res.json();
  return (data as Record<string, unknown>[]).map(r => ({
    id:         String(r.id),
    adminId:    String(r.admin_id),
    adminName:  String(r.admin_name ?? ""),
    teamId:     String(r.team_id) as TeamId,
    periodFrom: String(r.period_from),
    periodTo:   String(r.period_to),
    comment:    String(r.comment),
    createdAt:  String(r.created_at),
  }));
}

export async function createRhComment(c: {
  adminId: string; teamId: TeamId; periodFrom: string; periodTo: string; comment: string;
}): Promise<string> {
  const res = await fetch(`${BASE}/rh_comments.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(c),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Erreur commentaire");
  return data.id;
}

export async function deleteRhComment(id: string): Promise<void> {
  await fetch(`${BASE}/rh_comments.php?id=${id}`, { method: "DELETE" });
}

export function teamLabel(t: TeamId) { return TEAMS[t].name; }
