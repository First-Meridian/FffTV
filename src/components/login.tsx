"use client";
import { useState } from "react";
import { ArrowRight, Film, LoaderCircle, Sparkles } from "lucide-react";
import { Brand } from "./shell";
import { post } from "@/lib/client";
export function Login({ ready }: { ready: boolean }) {
  const [register, setRegister] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="login-page">
      <div className="login-art">
        <Brand />
        <div className="login-orbit">
          <Film size={42} />
        </div>
        <div className="login-copy">
          <span className="eyebrow">
            <Sparkles size={14} /> YOUR LITTLE CINEMA
          </span>
          <h1>
            好故事，
            <br />
            值得一起看<span>。</span>
          </h1>
          <p>
            从一部心心念念的电影，
            <br />
            到舍不得告别的番剧。这里，留着你的位置。
          </p>
          <div className="login-caption">
            <span>01 / MOVIES</span>
            <span>02 / ANIME</span>
            <span>03 / YOUR STORIES</span>
          </div>
        </div>
      </div>
      <div className="login-form-wrap">
        <form
          className="login-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            const form = new FormData(event.currentTarget);
            try {
              await post(
                register ? "register" : "login",
                Object.fromEntries(form),
              );
              window.location.assign("/");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <span className="eyebrow">WELCOME TO FffTV</span>
          <h2>{register ? "你的座位，已预留" : "今晚，想看点什么？"}</h2>
          <p className="muted">
            {register
              ? "使用朋友分享的邀请码，加入放映室。"
              : "登录你的账号，接着上次的故事。"}
          </p>
          {!ready && (
            <div className="notice">
              站点尚未初始化。请管理员运行 <code>npm run setup</code>
              ，重启服务后使用 .env.local 中的账号登录。
            </div>
          )}
          <label>
            用户名
            <input
              name="username"
              autoComplete="username"
              placeholder="输入你的用户名"
              required
              minLength={2}
              maxLength={24}
            />
          </label>
          <label>
            密码
            <input
              name="password"
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              placeholder={register ? "至少 8 位字符" : "输入你的密码"}
              required
              minLength={8}
              maxLength={128}
            />
          </label>
          {register && (
            <label>
              邀请码
              <input
                name="invite"
                autoComplete="off"
                placeholder="粘贴你的专属邀请码"
                required
                maxLength={100}
              />
            </label>
          )}
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          <button className="button primary full" disabled={busy || !ready}>
            {busy ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <>
                {register ? "加入放映室" : "进入放映室"}
                <ArrowRight size={18} />
              </>
            )}
          </button>
          <button
            className="text-button login-toggle"
            type="button"
            onClick={() => {
              setRegister(!register);
              setError("");
            }}
          >
            {register ? "已有账号？返回登录" : "收到邀请码？创建账号"}
          </button>
          <p className="form-footnote">
            邀请制开放 · 每个人都有自己的片单与进度
          </p>
        </form>
      </div>
    </div>
  );
}
