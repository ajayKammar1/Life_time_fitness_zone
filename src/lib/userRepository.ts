import { db } from "./database";
import type { User } from "./types";

export function validateAdminLogin(input: string, password: string): boolean {
  const identifier = input.trim();
  const user = db.getFirstSync<User>(
    `SELECT * FROM users
     WHERE (LOWER(username) = LOWER(?) OR LOWER(COALESCE(email, '')) = LOWER(?))
       AND password = ?`,
    [identifier, identifier, password],
  );

  return Boolean(user);
}

export function getAdminUser(): User | null {
  return db.getFirstSync<User>("SELECT * FROM users WHERE username = ?", ["admin"]) ?? null;
}
