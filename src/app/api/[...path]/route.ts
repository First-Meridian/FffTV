import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import {
  currentUser,
  setSession,
  SESSION_COOKIE,
  sameOrigin,
  body,
} from "@/lib/auth";
import {
  configured,
  consumeLimit,
  createSession,
  db,
  digest,
  getSources,
  library,
  passwordMatches,
  registerWithInvite,
  saveLibrary,
} from "@/lib/db";
import { getMovie, searchCatalog, clearSourceCache } from "@/lib/sources";
import type { User } from "@/lib/types";
import { sameWork } from "@/lib/identity";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
const fail = (message: string, status = 400) =>
  json({ error: message }, status);
type Context = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, context: Context) {
  try {
    const path = (await context.params).path.join("/");
    if (path === "session")
      return json({ user: await currentUser(), configured: configured() });
    const user = await currentUser();
    if (!user) return fail("请先登录", 401);
    const url = new URL(request.url);
    if (path === "sources") return json({ sources: getSources() });
    if (path === "library") return json({ items: library(user) });
    if (path === "search") {
      if (!consumeLimit(`search:${user.id}`, 60, 60000))
        return fail("搜索太频繁，请稍后再试", 429);
      const q = (url.searchParams.get("q") || "").trim().slice(0, 80);
      return json(
        await searchCatalog(q, url.searchParams.get("source") || undefined),
      );
    }
    if (path === "detail") {
      if (!consumeLimit(`detail:${user.id}`, 100, 60000))
        return fail("请求太频繁，请稍后再试", 429);
      const movie = await getMovie(
        url.searchParams.get("source") || "",
        url.searchParams.get("id") || "",
      );
      return movie ? json({ movie }) : fail("暂时没有找到这部作品", 404);
    }
    if (path === "admin") {
      if (user.role !== "admin") return fail("需要管理员权限", 403);
      return json({
        users: db()
          .prepare(
            "SELECT id,username,role,created FROM users ORDER BY created DESC",
          )
          .all(),
        invites: db()
          .prepare(
            "SELECT expires,used_by AS usedBy FROM invites ORDER BY expires DESC LIMIT 30",
          )
          .all(),
        sources: getSources(),
      });
    }
    return fail("接口不存在", 404);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "服务暂时不可用", 502);
  }
}
export async function POST(request: Request, context: Context) {
  if (!sameOrigin(request))
    return fail("请求来源不匹配，请使用配置的网站地址", 403);
  try {
    const path = (await context.params).path.join("/"),
      input = await body(request);
    if (path === "login" || path === "register") {
      if (!configured())
        return fail("站点尚未初始化，请先运行 npm run setup 并重启服务", 503);
      const username = String(input.username || "").trim(),
        password = String(input.password || "");
      if (
        !/^[\p{L}\p{N}_-]{2,24}$/u.test(username) ||
        password.length < 8 ||
        password.length > 128
      )
        return fail("用户名需为 2–24 位文字、数字或下划线，密码需为 8–128 位");
      if (
        !consumeLimit("auth:global", 80, 15 * 60000) ||
        !consumeLimit(`auth:${username.toLowerCase()}`, 10, 15 * 60000)
      )
        return fail("尝试次数过多，请 15 分钟后再试", 429);
      let user: User;
      if (path === "login") {
        const row = db()
          .prepare("SELECT * FROM users WHERE username=?")
          .get(username) as (User & { password: string }) | undefined;
        if (!row || !passwordMatches(password, row.password))
          return fail("用户名或密码不正确", 401);
        user = { id: row.id, username: row.username, role: row.role };
      } else {
        const invite = String(input.invite || "").trim();
        if (invite.length > 100) return fail("邀请码无效");
        user = registerWithInvite(username, password, invite);
      }
      return setSession(json({ user }), createSession(user.id));
    }
    const user = await currentUser();
    if (!user) return fail("请先登录", 401);
    if (path === "logout") {
      const token = (await cookies()).get(SESSION_COOKIE)?.value;
      if (token)
        db().prepare("DELETE FROM sessions WHERE token=?").run(digest(token));
      const response = json({ ok: true });
      response.cookies.delete(SESSION_COOKIE);
      return response;
    }
    if (path === "library") {
      if (!consumeLimit(`library:${user.id}`, 120, 60000))
        return fail("记录保存过于频繁", 429);
      const movie = await getMovie(
        String(input.source || ""),
        String(input.id || ""),
      );
      if (!movie) return fail("作品不存在", 404);
      let key = movie.key;
      if (typeof input.libraryKey === "string" && input.libraryKey !== key) {
        const existing = library(user).find(
          (item) => item.movie.key === input.libraryKey,
        );
        if (!existing || !sameWork(existing.movie, movie))
          return fail("无法将进度关联到这部作品");
        key = input.libraryKey;
      }
      if (typeof input.favorite === "boolean") {
        saveLibrary(user, { ...movie, key }, key, { favorite: input.favorite });
      } else {
        const episode = movie.lines
          .flatMap((line) => line.episodes)
          .find((ep) => ep.key === input.episodeKey);
        const position = Number(input.position),
          duration = Number(input.duration);
        if (
          !episode ||
          !Number.isFinite(position) ||
          !Number.isFinite(duration) ||
          position < 0 ||
          duration <= 0 ||
          duration > 86400 ||
          position > duration + 5
        )
          return fail("播放进度无效");
        saveLibrary(user, { ...movie, key }, key, {
          episodeKey: episode.key,
          episodeName: episode.name,
          position: Math.min(position, duration),
          duration,
        });
      }
      return json({ ok: true });
    }
    if (path.startsWith("admin/")) {
      if (user.role !== "admin") return fail("需要管理员权限", 403);
      if (path === "admin/invite") {
        if (!consumeLimit(`invite:${user.id}`, 20, 3600000))
          return fail("邀请码生成过于频繁", 429);
        const token = randomBytes(18).toString("base64url"),
          expires = Date.now() + 7 * 86400000;
        db()
          .prepare(
            "INSERT INTO invites(token,created_by,expires) VALUES(?,?,?)",
          )
          .run(digest(token), user.id, expires);
        return json({ invite: token, expires });
      }
      if (path === "admin/source") {
        const source = getSources().find((item) => item.id === input.id);
        if (!source || typeof input.enabled !== "boolean")
          return fail("来源设置无效");
        db()
          .prepare("UPDATE sources SET enabled=? WHERE id=?")
          .run(Number(input.enabled), source.id);
        clearSourceCache();
        return json({ sources: getSources() });
      }
    }
    return fail("接口不存在", 404);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "操作未完成，请重试");
  }
}
