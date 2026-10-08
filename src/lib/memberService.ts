import type { Member } from "./types";

export function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function getMembershipStatus(endDate?: string | null): "ACTIVE" | "EXPIRED" {
  if (!endDate) return "EXPIRED";

  const [year, month, day] = endDate.split("-").map(Number);
  if (!year || !month || !day) return "EXPIRED";

  const end = new Date(Date.UTC(year, month - 1, day));
  if (
    end.getUTCFullYear() !== year ||
    end.getUTCMonth() !== month - 1 ||
    end.getUTCDate() !== day
  ) {
    return "EXPIRED";
  }

  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return end.getTime() >= today ? "ACTIVE" : "EXPIRED";
}

export function getNextMemberCode(existingMembers: Member[]): string {
  const highest = existingMembers.reduce((max, member) => {
    const match = member.member_code.match(/(\d+)/);
    if (!match) return max;
    return Math.max(max, Number(match[1]));
  }, 0);

  return `GYM${String(highest + 1).padStart(4, "0")}`;
}

export function getDashboardStats(members: Member[]) {
  const total = members.length;
  const active = members.filter((member) => getMembershipStatus(member.end_date) === "ACTIVE").length;
  const expired = total - active;
  const expiringSoon = members.filter((member) => {
    if (!member.end_date) return false;
    const now = new Date();
    const [year, month, day] = member.end_date.split("-").map(Number);
    if (!year || !month || !day) return false;
    const end = Date.UTC(year, month - 1, day);
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round((end - today) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  }).length;

  return { total, active, expired, expiringSoon };
}
