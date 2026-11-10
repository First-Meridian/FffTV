"use client";
import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  KeyRound,
  LoaderCircle,
  Radio,
  Users,
} from "lucide-react";
import { api, post } from "@/lib/client";
import type { Source, User, CatalogSync } from "@/lib/types";
type AdminData = {
  users: (User & { created: number })[];
  invites: { expires: number; usedBy: number | null }[];
  sources: Source[];
  catalog: CatalogSync[];
};
export function Settings() {
  const [data, setData] = useState<AdminData | null>(null),
    [error, setError] = useState(""),
    [invite, setInvite] = useState(""),
    [copied, setCopied] = useState(false),
    [busy, setBusy] = useState(false),
    [changing, setChanging] = useState("");
  const load = () =>
    api<AdminData>("admin")
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);
  return (
    <>
      <div className="page-top">
        <span className="eyebrow">BEHIND THE SCENES</span>
      </div>
      <div className="page-title">
        <h1>把放映室照顾好</h1>
        <p>邀请你的朋友，管理这个小小的观影空间。</p>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {!data ? (
        <p className="loading">
          <LoaderCircle className="spin" />
          正在读取设置…
        </p>
      ) : (
        <div className="settings-grid">
          <section className="settings-card">
            <div className="settings-icon">
              <KeyRound size={23} />
            </div>
            <h2>为朋友留个座位</h2>
            <p>
              每个邀请码可使用一次，7 天内有效。新成员拥有独立的片单和观看记录。
            </p>
            <button
              className="button primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const result = await post<{ invite: string }>(
                    "admin/invite",
                    {},
                  );
                  setInvite(result.invite);
                  setCopied(false);
                  void load();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <KeyRound size={16} />
              )}
              生成邀请码
            </button>
            {invite && (
              <div className="invite-result">
                <code>{invite}</code>
                <button
                  className="icon-button"
                  title="复制邀请码"
                  aria-label="复制邀请码"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(invite);
                      setCopied(true);
                    } catch {
                      setError("复制失败，请手动选择上方邀请码复制");
                    }
                  }}
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
            )}
            <small className="muted">
              当前{" "}
              {
                data.invites.filter((i) => !i.usedBy && i.expires > Date.now())
                  .length
              }{" "}
              个未使用且有效的邀请码
            </small>
          </section>
          <section className="settings-card">
            <div className="settings-icon">
              <Users size={23} />
            </div>
            <h2>
              放映室成员 <span className="badge">{data.users.length} 人</span>
            </h2>
            <div className="member-list">
              {data.users.map((user) => (
                <div key={user.id}>
                  <span className="avatar">
                    {user.username.slice(0, 1).toUpperCase()}
                  </span>
                  <strong>{user.username}</strong>
                  <span className="muted small">
                    {user.role === "admin" ? "管理员" : "成员"}
                  </span>
                </div>
              ))}
            </div>
          </section>
          <section className="settings-card source-settings">
            <div className="section-heading">
              <h2>
                <Radio size={22} />
                播放来源
              </h2>
              <span className="badge">
                {data.sources.filter((s) => s.enabled).length} 个已启用
              </span>
            </div>
            <p>
              根据 2026 年 11
              月的样本测试预置。来源可用性会变化，可以随时停用不稳定的来源。使用前请确认相应内容的使用权限。
            </p>
            {data.sources.map((source) => (
              <div className="source-setting" key={source.id}>
                <span
                  className={`source-bullet ${source.enabled ? "enabled" : ""}`}
                />
                <div>
                  <strong>{source.name}</strong>
                  <small>{source.note}</small>
                </div>
                <button
                  role="switch"
                  aria-checked={source.enabled}
                  aria-label={`${source.enabled ? "停用" : "启用"}${source.name}`}
                  disabled={Boolean(changing)}
                  className={`switch ${source.enabled ? "on" : ""}`}
                  onClick={async () => {
                    setChanging(source.id);
                    try {
                      const result = await post<{ sources: Source[] }>(
                        "admin/source",
                        { id: source.id, enabled: !source.enabled },
                      );
                      setData({ ...data, sources: result.sources });
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setChanging("");
                    }
                  }}
                >
                  <span />
                </button>
              </div>
            ))}
            <div className="sync-list">
              <div className="section-heading">
                <h3>片库收录进度</h3>
                <button className="text-link" onClick={() => void load()}>
                  刷新进度
                </button>
              </div>
              <p>
                服务运行时自动逐页收录，中断后从上次进度继续；首次收录完成后每 6
                小时开始下一轮。收藏与观看进度独立保留。
              </p>
              {data.catalog.map((source) => (
                <p key={source.id}>
                  <strong>{source.name}</strong> · 已收录{" "}
                  {source.indexed.toLocaleString()} 条 ·{" "}
                  {source.pages
                    ? `当前 ${Math.max(0, source.nextPage - 1)} / ${source.pages} 页`
                    : "等待连接"}
                  {source.completed ? " · 已完成首次收录" : ""}
                  {source.error ? ` · ${source.error}，稍后自动重试` : ""}
                </p>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
