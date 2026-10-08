import * as SQLite from "expo-sqlite";

export const db = SQLite.openDatabaseSync("gym.db");

function ensureColumn(
  table: "users" | "members",
  column: string,
  definition: string,
) {
  const columns = db.getAllSync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!columns.some((entry) => entry.name === column)) {
    db.execSync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  }
}

export function initializeDatabase() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT,
      password TEXT NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'admin',
      created_at TEXT NOT NULL
    );
  `);

  ensureColumn("users", "email", "TEXT");

  db.execSync(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      gender TEXT,
      date_of_birth TEXT,
      height_cm REAL,
      weight_kg REAL,
      blood_group TEXT,
      address TEXT,
      membership_plan TEXT,
      start_date TEXT,
      end_date TEXT,
      amount REAL DEFAULT 0,
      emergency_contact TEXT,
      image_path TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  ensureColumn("members", "height_cm", "REAL");
  ensureColumn("members", "weight_kg", "REAL");
  ensureColumn("members", "blood_group", "TEXT");

  db.execSync(`
    CREATE TABLE IF NOT EXISTS notification_log (
      alert_key TEXT PRIMARY KEY,
      created_at TEXT NOT NULL
    );
  `);

  const adminUser = db.getFirstSync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM users WHERE username = ?",
    ["admin"],
  );

  if ((adminUser?.count ?? 0) === 0) {
    db.runSync(
      `INSERT INTO users (username, email, password, name, role, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ["admin", "admin@gmail.com", "admin123", "Gym Admin", "admin", new Date().toISOString()],
    );
  } else {
    const adminWithEmail = db.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM users WHERE username = ? AND email = ?",
      ["admin", "admin@gmail.com"],
    );

    if ((adminWithEmail?.count ?? 0) === 0) {
      db.runSync(
        "UPDATE users SET email = ? WHERE username = ?",
        ["admin@gmail.com", "admin"],
      );
    }
  }
}
