// =====================================================================
// Configuration équipes & codes d'accès
// Les codes sont définis ici côté client — à déplacer en BDD pour la prod
// =====================================================================
export type TeamId = "it" | "dev" | "ops" | "rh";

export interface Team {
  id: TeamId;
  name: string;
  label: string;
  color: string;
  dot: string;
  memberCode: string;
  adminCode: string;
}

export const TEAMS: Record<TeamId, Team> = {
  it: {
    id: "it",
    name: "IT",
    label: "Équipe Informatique",
    color: "text-[#1A3752]",
    dot: "bg-[#1A3752]",
    memberCode: "IT-2024-MBR",
    adminCode: "ADMIN-IT-2024-PRIV",
  },
  dev: {
    id: "dev",
    name: "Dev",
    label: "Équipe Développement",
    color: "text-sky-600",
    dot: "bg-sky-500",
    memberCode: "DEV-2024-MBR",
    adminCode: "ADMIN-DEV-2024-PRIV",
  },
  ops: {
    id: "ops",
    name: "Ops",
    label: "Équipe Opérations",
    color: "text-amber-600",
    dot: "bg-amber-500",
    memberCode: "OPS-2024-MBR",
    adminCode: "ADMIN-OPS-2024-PRIV",
  },
  rh: {
    id: "rh",
    name: "RH",
    label: "Ressources Humaines",
    color: "text-emerald-600",
    dot: "bg-emerald-500",
    memberCode: "RH-2024-MBR",
    adminCode: "ADMIN-RH-2024-PRIV",
  },
};

export const TEAM_LIST = Object.values(TEAMS);

export function resolveCode(code: string): { team: Team; role: "member" | "admin" } | null {
  const c = code.trim();
  for (const t of TEAM_LIST) {
    if (c === t.memberCode) return { team: t, role: "member" };
    if (c === t.adminCode) return { team: t, role: "admin" };
  }
  return null;
}

export const SCHEDULE = {
  startHour: 9,
  startTolerance: 5,
  breakHour: 13,
  breakTolerance: 5,
  endHour: 17,
  endTolerance: 5,
  timezone: "Europe/Paris",
};
