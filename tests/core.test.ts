import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { rmSync } from "node:fs";
import { parseMovie, episodeKey, mediaUrl, movieKey } from "../src/lib/catalog";
import { isPublicAddress } from "../src/lib/network";
import {
  db,
  passwordHash,
  passwordMatches,
  registerWithInvite,
  createSession,
  sessionUser,
  digest,
  library,
  saveLibrary,
  consumeLimit,
} from "../src/lib/db";
import type { User } from "../src/lib/types";
import { sameWork } from "../src/lib/identity";

const databasePath = resolve(
  `data/test-${randomBytes(8).toString("hex")}.sqlite`,
);
process.env.DATABASE_PATH = databasePath;
process.env.ADMIN_USERNAME = "test-admin";
process.env.ADMIN_PASSWORD = randomBytes(24).toString("base64url");
after(() => {
  db().close();
  for (const suffix of ["", "-wal", "-shm"])
    rmSync(databasePath + suffix, { force: true });
});
const source = { id: "test", name: "测试" };
const raw = {
  vod_id: 1,
  vod_name: "星际穿越",
  vod_year: "2014",
  type_name: "科幻片",
  vod_content: "<script>ignore</script><p>故事 &amp; 星辰</p>",
  vod_play_from: "web$$$hls",
  vod_play_url:
    "播放页$https://example.com/player/1$$$TC$https://example.com/tc.m3u8#HD中字$https://example.com/hd.m3u8",
};

test("catalog extracts direct media only, prefers HD and never treats source HTML as markup", () => {
  const movie = parseMovie(raw, source)!;
  assert.equal(movie.lines.length, 1);
  assert.equal(movie.lines[0].episodes[0].name, "HD中字");
  assert.equal(movie.lines[0].episodes[1].quality, "preview");
  assert.equal(movie.lines[0].episodes[0].key, "feature");
  assert.ok(!movie.description.includes("<"));
  assert.equal(
    parseMovie({ ...raw, vod_name: "星际穿越[电影解说]" }, source),
    null,
  );
});
test("episode matching respects numbered episodes, specials and seasons", () => {
  assert.equal(episodeKey("第01集", 0, true), episodeKey("第1集", 0, true));
  assert.notEqual(episodeKey("OVA", 0, true), episodeKey("第01集", 0, true));
  assert.notEqual(
    movieKey("咒术回战第二季", "2023"),
    movieKey("咒术回战第三季", "2026"),
  );
  assert.equal(
    movieKey("葬送的芙莉莲 第二季", "2026"),
    movieKey("葬送的芙莉莲第二季", "2026"),
  );
});
test("feature aliases support source switching without hiding language variants", () => {
  assert.equal(
    episodeKey("星际穿越", 0, false),
    episodeKey("HD中字", 0, false),
  );
  assert.notEqual(
    episodeKey("HD国语", 0, false),
    episodeKey("HD粤语", 0, false),
  );
  const movie = parseMovie(
    {
      ...raw,
      vod_play_url:
        "HD$https://example.com/a.m3u8#HD中字$https://example.com/b.m3u8",
    },
    source,
  )!;
  assert.equal(new Set(movie.lines[0].episodes.map((ep) => ep.key)).size, 2);
});
test("source switching rejects same-year documentaries and different seasons", () => {
  const film = { title: "星际穿越", year: "2014" };
  assert.equal(
    sameWork(film, { title: "星际穿越（原声版）", year: "2014" }),
    true,
  );
  assert.equal(
    sameWork(film, { title: "星际穿越中的科学", year: "2014" }),
    false,
  );
  assert.equal(
    sameWork(
      { title: "咒术回战第二季", year: "2023" },
      { title: "咒术回战 第三季", year: "2023" },
    ),
    false,
  );
});
test("media URLs reject executable schemes and obvious local targets", () => {
  for (const url of [
    "javascript:alert(1)",
    "file:///c:/secret",
    "http://localhost/x.m3u8",
    "http://127.0.0.1/x.m3u8",
    "http://10.0.0.1/a",
    "http://[::1]/a",
    "https://name:password@example.com/a",
  ])
    assert.equal(mediaUrl(url), "");
  assert.equal(
    mediaUrl("https://cdn.example.com/a.m3u8"),
    "https://cdn.example.com/a.m3u8",
  );
});
test("DNS policy rejects private, loopback, metadata and IPv4-mapped addresses", () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.2",
    "172.16.0.2",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "::1",
    "fc00::1",
    "::ffff:127.0.0.1",
  ])
    assert.equal(isPublicAddress(address), false, address);
  assert.equal(isPublicAddress("8.8.8.8"), true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
});
test("password hashes are salted and reject wrong passwords and malformed encodings", () => {
  const one = passwordHash("a-long-test-password"),
    two = passwordHash("a-long-test-password");
  assert.notEqual(one, two);
  assert.equal(passwordMatches("a-long-test-password", one), true);
  assert.equal(passwordMatches("wrong", one), false);
  assert.equal(passwordMatches("a", "broken"), false);
});
test("invites are single-use, expire, and consumption rolls back on duplicate usernames", () => {
  const admin = db()
    .prepare("SELECT id FROM users WHERE role=?")
    .get("admin") as { id: number };
  const token = "valid-invite";
  db()
    .prepare("INSERT INTO invites(token,created_by,expires) VALUES(?,?,?)")
    .run(digest(token), admin.id, Date.now() + 60000);
  assert.throws(
    () => registerWithInvite("test-admin", "password123", token),
    /已经被使用/,
  );
  const user = registerWithInvite("member-one", "password123", token);
  assert.equal(user.role, "member");
  assert.throws(
    () => registerWithInvite("member-two", "password123", token),
    /已使用/,
  );
  db()
    .prepare("INSERT INTO invites(token,created_by,expires) VALUES(?,?,?)")
    .run(digest("expired"), admin.id, Date.now() - 1);
  assert.throws(
    () => registerWithInvite("member-two", "password123", "expired"),
    /已过期/,
  );
});
test("sessions are hashed, expire and are invalid after logout", () => {
  const user = db()
    .prepare("SELECT id,username,role FROM users LIMIT 1")
    .get() as User;
  const token = createSession(user.id);
  assert.equal(sessionUser(token)?.id, user.id);
  assert.equal(Object.getPrototypeOf(sessionUser(token)), Object.prototype);
  assert.equal(
    db().prepare("SELECT token FROM sessions WHERE token=?").get(token),
    undefined,
  );
  db()
    .prepare("UPDATE sessions SET expires=? WHERE token=?")
    .run(Date.now() - 1, digest(token));
  assert.equal(sessionUser(token), null);
  const other = createSession(user.id);
  db().prepare("DELETE FROM sessions WHERE token=?").run(digest(other));
  assert.equal(sessionUser(other), null);
});
test("favorite/progress updates preserve each other and remain isolated per user", () => {
  const users = db()
    .prepare("SELECT id,username,role FROM users ORDER BY id")
    .all() as User[];
  assert.ok(users.length >= 2);
  const movie = parseMovie(raw, source)!;
  saveLibrary(users[0], movie, movie.key, { favorite: true });
  saveLibrary(users[0], movie, movie.key, {
    episodeKey: "feature",
    episodeName: "HD中字",
    position: 120,
    duration: 10260,
  });
  assert.equal(library(users[0])[0].favorite, true);
  assert.equal(library(users[0])[0].position, 120);
  assert.deepEqual(library(users[1]), []);
  saveLibrary(users[0], movie, movie.key, { favorite: false });
  assert.equal(library(users[0])[0].position, 120);
  assert.equal(library(users[0])[0].favorite, false);
  assert.deepEqual(library(users[0])[0].movie.lines, []);
});
test("rate limiting blocks excess operations within its window", () => {
  assert.equal(consumeLimit("test", 2, 10000), true);
  assert.equal(consumeLimit("test", 2, 10000), true);
  assert.equal(consumeLimit("test", 2, 10000), false);
});
