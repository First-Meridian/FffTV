import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
const origin = process.env.APP_ORIGIN || "http://127.0.0.1:3000";
const username = `test_${randomBytes(6).toString("hex")}`,
  password = randomBytes(18).toString("base64url");
let memberId, invite, adminCookie, memberCookie;
async function request(path, options = {}) {
  const response = await fetch(`${origin}/api/${path}`, {
    method: options.data ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      Origin: options.origin || origin,
      ...(options.cookie ? { Cookie: options.cookie } : {}),
    },
    body: options.data ? JSON.stringify(options.data) : undefined,
  });
  return {
    status: response.status,
    data: await response.json(),
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
}
try {
  assert.equal((await request("library")).status, 401);
  console.log("PASS anonymous requests require login");
  assert.equal(
    (
      await request("login", {
        origin: "https://untrusted.invalid",
        data: { username: "a", password: "b" },
      })
    ).status,
    403,
  );
  console.log("PASS cross-origin mutations rejected");
  const login = await request("login", {
    data: {
      username: process.env.ADMIN_USERNAME,
      password: process.env.ADMIN_PASSWORD,
    },
  });
  assert.equal(login.status, 200);
  adminCookie = login.cookie;
  assert.equal(login.data.user.role, "admin");
  console.log("PASS administrator login");
  const originalAdminLibrary = (
    await request("library", { cookie: adminCookie })
  ).data.items;
  const invitation = await request("admin/invite", {
    cookie: adminCookie,
    data: {},
  });
  assert.equal(invitation.status, 200);
  invite = invitation.data.invite;
  const registered = await request("register", {
    data: { username, password, invite },
  });
  assert.equal(registered.status, 200);
  memberId = registered.data.user.id;
  memberCookie = registered.cookie;
  assert.equal(
    (
      await request("register", {
        data: { username: `${username}2`, password, invite },
      })
    ).status,
    400,
  );
  console.log("PASS invite registration and single-use enforcement");
  assert.equal((await request("admin", { cookie: memberCookie })).status, 403);
  assert.equal(
    (
      await request("admin/source", {
        cookie: memberCookie,
        data: { id: "modu", enabled: false },
      })
    ).status,
    403,
  );
  console.log("PASS member cannot read admin data or change sources");
  const search = await request(
    `search?q=${encodeURIComponent("星际穿越")}&source=modu`,
    { cookie: memberCookie },
  );
  assert.equal(search.status, 200);
  const movie = search.data.movies.find((movie) => movie.title === "星际穿越");
  assert.ok(movie, "Live source should return the requested film");
  console.log("PASS live source search and normalized metadata");
  const detail = await request(`detail?source=modu&id=${movie.id}`, {
    cookie: memberCookie,
  });
  assert.equal(detail.status, 200);
  assert.ok(detail.data.movie.lines[0].episodes.length);
  const episode = detail.data.movie.lines[0].episodes[0];
  assert.equal(
    (
      await request("library", {
        cookie: memberCookie,
        data: { source: "modu", id: movie.id, favorite: true },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request("library", {
        cookie: memberCookie,
        data: {
          source: "modu",
          id: movie.id,
          episodeKey: episode.key,
          position: 123,
          duration: 10261,
        },
      })
    ).status,
    200,
  );
  const saved = (await request("library", { cookie: memberCookie })).data
    .items[0];
  assert.equal(saved.position, 123);
  assert.equal(saved.favorite, true);
  console.log("PASS favorite and playback progress persisted");
  assert.deepEqual(
    (await request("library", { cookie: adminCookie })).data.items,
    originalAdminLibrary,
  );
  console.log("PASS user libraries isolated");
  assert.equal(
    (
      await request("library", {
        cookie: memberCookie,
        data: {
          source: "modu",
          id: movie.id,
          episodeKey: "fake",
          position: 1,
          duration: 10,
        },
      })
    ).status,
    400,
  );
  console.log("PASS unknown episode progress rejected");
  assert.equal(
    (await request("logout", { cookie: memberCookie, data: {} })).status,
    200,
  );
  assert.equal(
    (await request("library", { cookie: memberCookie })).status,
    401,
  );
  console.log("PASS logout invalidates session");
} finally {
  if (adminCookie) await request("logout", { cookie: adminCookie, data: {} });
  const database = new DatabaseSync(
    resolve(process.env.DATABASE_PATH || "./data/ffftv.sqlite"),
  );
  database.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
  if (invite) {
    const { createHash } = await import("node:crypto");
    database
      .prepare("DELETE FROM invites WHERE token=?")
      .run(createHash("sha256").update(invite).digest("hex"));
  }
  if (memberId)
    database
      .prepare("DELETE FROM users WHERE id=? AND username=?")
      .run(memberId, username);
  database.close();
}
