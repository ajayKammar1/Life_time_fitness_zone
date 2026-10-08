import * as FileSystem from "expo-file-system/legacy";

import { db } from "./database";
import type { Member } from "./types";

export function createMember(payload: Omit<Member, "id" | "created_at" | "updated_at">): Member {
  const now = new Date().toISOString();

  db.runSync(
    `INSERT INTO members (
      member_code,
      name,
      phone,
      email,
      gender,
      date_of_birth,
      height_cm,
      weight_kg,
      blood_group,
      address,
      membership_plan,
      start_date,
      end_date,
      amount,
      emergency_contact,
      image_path,
      notes,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.member_code,
      payload.name,
      payload.phone,
      payload.email ?? null,
      payload.gender ?? null,
      payload.date_of_birth ?? null,
      payload.height_cm ?? null,
      payload.weight_kg ?? null,
      payload.blood_group ?? null,
      payload.address ?? null,
      payload.membership_plan,
      payload.start_date,
      payload.end_date,
      payload.amount ?? 0,
      payload.emergency_contact ?? null,
      payload.image_path ?? null,
      payload.notes ?? null,
      now,
      now,
    ],
  );

  const member = db.getFirstSync<Member>("SELECT * FROM members ORDER BY id DESC LIMIT 1");
  return member ?? ({ ...payload, id: 0, created_at: now, updated_at: now } as Member);
}

export function getMembers(): Member[] {
  return db.getAllSync<Member>("SELECT * FROM members ORDER BY created_at DESC");
}

export function getMemberById(id: number): Member | null {
  return db.getFirstSync<Member>("SELECT * FROM members WHERE id = ?", [id]) ?? null;
}

export function updateMember(id: number, payload: Partial<Member>): Member | null {
  const current = getMemberById(id);
  if (!current) return null;

  const updatedAt = new Date().toISOString();
  const nextPayload = {
    ...current,
    ...payload,
    updated_at: updatedAt,
  };

  db.runSync(
    `UPDATE members SET
      member_code = ?,
      name = ?,
      phone = ?,
      email = ?,
      gender = ?,
      date_of_birth = ?,
      height_cm = ?,
      weight_kg = ?,
      blood_group = ?,
      address = ?,
      membership_plan = ?,
      start_date = ?,
      end_date = ?,
      amount = ?,
      emergency_contact = ?,
      image_path = ?,
      notes = ?,
      updated_at = ?
    WHERE id = ?`,
    [
      nextPayload.member_code,
      nextPayload.name,
      nextPayload.phone,
      nextPayload.email ?? null,
      nextPayload.gender ?? null,
      nextPayload.date_of_birth ?? null,
      nextPayload.height_cm ?? null,
      nextPayload.weight_kg ?? null,
      nextPayload.blood_group ?? null,
      nextPayload.address ?? null,
      nextPayload.membership_plan,
      nextPayload.start_date,
      nextPayload.end_date,
      Number(nextPayload.amount ?? 0),
      nextPayload.emergency_contact ?? null,
      nextPayload.image_path ?? null,
      nextPayload.notes ?? null,
      updatedAt,
      id,
    ],
  );

  return getMemberById(id);
}

export function deleteMember(id: number): boolean {
  const member = getMemberById(id);
  if (!member) return false;

  if (member.image_path) {
    const imagePath = `${FileSystem.documentDirectory ?? ""}${member.image_path}`;
    void FileSystem.deleteAsync(imagePath, { idempotent: true });
  }

  db.runSync("DELETE FROM members WHERE id = ?", [id]);
  return true;
}

export function searchMembers(term: string): Member[] {
  const safeTerm = `%${term.trim()}%`;
  if (!term.trim()) return getMembers();

  return db.getAllSync<Member>(
    `SELECT * FROM members
     WHERE name LIKE ? OR phone LIKE ? OR member_code LIKE ?
     ORDER BY created_at DESC`,
    [safeTerm, safeTerm, safeTerm],
  );
}
