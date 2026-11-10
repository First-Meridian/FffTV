import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { BUILTIN_SOURCES } from "./catalog";
import type { User, Source, Movie, LibraryItem } from "./types";

const globalDb = globalThis as unknown as { fffDb?: DatabaseSync };
export function passwordHash(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function passwordMatches(password: string, encoded: string): boolean {
  try {
    const [salt, hash] = encoded.split(":");
    const actual = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, "hex");
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  } catch {
    return false;
  }
}
export function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
export function db(): DatabaseSync {
  if (globalDb.fffDb) return globalDb.fffDb;
  const path = resolve(
    /* turbopackIgnore: true */ process.env.DATABASE_PATH ||
      "./data/ffftv.sqlite",
  );
  mkdirSync(dirname(path), { recursive: true });
  const conn = new DatabaseSync(path);
  conn.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL COLLATE NOCASE, password TEXT NOT NULL, role TEXT NOT NULL, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS invites(token TEXT PRIMARY KEY, created_by INTEGER NOT NULL REFERENCES users(id), expires INTEGER NOT NULL, used_by INTEGER REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS sources(id TEXT PRIMARY KEY, enabled INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS library(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, movie_key TEXT NOT NULL, movie_json TEXT NOT NULL, favorite INTEGER NOT NULL DEFAULT 0, episode_key TEXT NOT NULL DEFAULT '', episode_name TEXT NOT NULL DEFAULT '', position REAL NOT NULL DEFAULT 0, duration REAL NOT NULL DEFAULT 0, updated INTEGER NOT NULL, PRIMARY KEY(user_id,movie_key));
    CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS catalog_entries(source_id TEXT NOT NULL, id TEXT NOT NULL, work_key TEXT NOT NULL, title TEXT NOT NULL, year TEXT NOT NULL, kind TEXT NOT NULL, areas TEXT NOT NULL, genres TEXT NOT NULL, release_date TEXT NOT NULL, updated TEXT NOT NULL, movie_json TEXT NOT NULL, PRIMARY KEY(source_id,id));
    CREATE INDEX IF NOT EXISTS catalog_work ON catalog_entries(work_key);
    CREATE INDEX IF NOT EXISTS catalog_filter ON catalog_entries(kind,year,release_date);
    CREATE TABLE IF NOT EXISTS catalog_sync(source_id TEXT PRIMARY KEY, next_page INTEGER NOT NULL DEFAULT 1, pages INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL DEFAULT 0, completed INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL DEFAULT 0, error TEXT NOT NULL DEFAULT '', retry_at INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS metadata_cache(key TEXT PRIMARY KEY, json TEXT NOT NULL, updated INTEGER NOT NULL);
  `);
  globalDb.fffDb = conn;
  for (const source of BUILTIN_SOURCES)
    conn
      .prepare("INSERT OR IGNORE INTO sources(id,enabled) VALUES(?,?)")
      .run(source.id, Number(source.enabled));
  const count = conn.prepare("SELECT COUNT(*) AS count FROM users").get() as {
    count: number;
  };
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (
    count.count === 0 &&
    adminPassword &&
    adminPassword.length >= 12 &&
    adminPassword !== "replace-with-a-unique-long-password"
  ) {
    conn
      .prepare(
        "INSERT INTO users(username,password,role,created) VALUES(?,?,?,?)",
      )
      .run(
        process.env.ADMIN_USERNAME || "admin",
        passwordHash(adminPassword),
        "admin",
        Date.now(),
      );
  }
  return conn;
}
export function configured(): boolean {
  return (
    Number(
      (
        db().prepare("SELECT COUNT(*) AS count FROM users").get() as {
          count: number;
        }
      ).count,
    ) > 0
  );
}
export function getSources(): Source[] {
  const rows = db().prepare("SELECT * FROM sources").all() as {
    id: string;
    enabled: number;
  }[];
  return BUILTIN_SOURCES.map((source) => ({
    ...source,
    enabled: Boolean(rows.find((row) => row.id === source.id)?.enabled),
  }));
}
export function consumeLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  db().prepare("DELETE FROM rate_limits WHERE expires < ?").run(now);
  const row = db()
    .prepare("SELECT count FROM rate_limits WHERE key=?")
    .get(key) as { count: number } | undefined;
  if (row && row.count >= limit) return false;
  db()
    .prepare(
      "INSERT INTO rate_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1",
    )
    .run(key, now + windowMs);
  return true;
}
export function sessionUser(token: string | undefined): User | null {
  if (!token || token.length > 100) return null;
  db().prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
  const row = db()
    .prepare(
      "SELECT users.id,users.username,users.role FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token=? AND expires>?",
    )
    .get(digest(token), Date.now()) as User | undefined;
  return row ? { id: row.id, username: row.username, role: row.role } : null;
}
export function createSession(userId: number): string {
  const token = randomBytes(32).toString("base64url");
  db()
    .prepare("INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)")
    .run(digest(token), userId, Date.now() + 7 * 86400000);
  return token;
}
export function registerWithInvite(
  username: string,
  password: string,
  token: string,
): User {
  const conn = db();
  const hashed = passwordHash(password);
  conn.exec("BEGIN IMMEDIATE");
  try {
    const invite = conn
      .prepare(
        "SELECT token FROM invites WHERE token=? AND used_by IS NULL AND expires>?",
      )
      .get(digest(token), Date.now());
    if (!invite) throw new Error("邀请码无效、已使用或已过期");
    const result = conn
      .prepare(
        "INSERT INTO users(username,password,role,created) VALUES(?,?,?,?)",
      )
      .run(username, hashed, "member", Date.now());
    const id = Number(result.lastInsertRowid);
    conn
      .prepare("UPDATE invites SET used_by=? WHERE token=?")
      .run(id, digest(token));
    conn.exec("COMMIT");
    return { id, username, role: "member" };
  } catch (error) {
    conn.exec("ROLLBACK");
    if (String(error).includes("UNIQUE"))
      throw new Error("这个用户名已经被使用");
    throw error;
  }
}
type LibraryRow = {
  movie_json: string;
  episode_key: string;
  episode_name: string;
  position: number;
  duration: number;
  updated: number;
  favorite: number;
};
export function library(user: User): LibraryItem[] {
  return (
    db()
      .prepare(
        "SELECT * FROM library WHERE user_id=? ORDER BY updated DESC LIMIT 100",
      )
      .all(user.id) as LibraryRow[]
  ).map((row) => ({
    movie: JSON.parse(row.movie_json) as Movie,
    episodeKey: row.episode_key,
    episodeName: row.episode_name,
    position: row.position,
    duration: row.duration,
    updated: row.updated,
    favorite: Boolean(row.favorite),
  }));
}
export function saveLibrary(
  user: User,
  movie: Movie,
  key: string,
  update: {
    favorite?: boolean;
    episodeKey?: string;
    episodeName?: string;
    position?: number;
    duration?: number;
  },
) {
  const conn = db();
  const cleanMovie = { ...movie, lines: [] };
  conn
    .prepare(
      "INSERT INTO library(user_id,movie_key,movie_json,updated) VALUES(?,?,?,?) ON CONFLICT(user_id,movie_key) DO UPDATE SET movie_json=excluded.movie_json",
    )
    .run(user.id, key, JSON.stringify(cleanMovie), Date.now());
  if (update.favorite !== undefined)
    conn
      .prepare("UPDATE library SET favorite=? WHERE user_id=? AND movie_key=?")
      .run(Number(update.favorite), user.id, key);
  if (update.position !== undefined)
    conn
      .prepare(
        "UPDATE library SET episode_key=?,episode_name=?,position=?,duration=?,updated=? WHERE user_id=? AND movie_key=?",
      )
      .run(
        update.episodeKey!,
        update.episodeName!,
        update.position,
        update.duration!,
        Date.now(),
        user.id,
        key,
      );
}
