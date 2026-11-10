"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  Heart,
  History,
  Settings2,
  LogOut,
  Clapperboard,
  ArrowUpRight,
} from "lucide-react";
import { post } from "@/lib/client";
import type { User } from "@/lib/types";
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">
        <Clapperboard size={21} />
      </span>
      <span>
        Fff<span className="accent">TV</span>
        <small>PRIVATE CINEMA</small>
      </span>
    </span>
  );
}
export function Shell({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const links = [
    { href: "/", label: "发现好故事", icon: Compass },
    { href: "/library", label: "我的片单", icon: Heart },
    { href: "/history", label: "继续观看", icon: History },
    ...(user.role === "admin"
      ? [{ href: "/settings", label: "放映室管理", icon: Settings2 }]
      : []),
  ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" aria-label="FffTV 首页">
          <Brand />
        </Link>
        <div className="sidebar-label">你的放映室</div>
        <nav>
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              href={href}
              key={href}
              className={pathname === href ? "nav-item active" : "nav-item"}
            >
              <Icon size={19} />
              <span>{label}</span>
              {pathname === href && <i />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="status-dot" />
          小小放映室，大大的世界。<p>按下播放，让故事发生。</p>
          <ArrowUpRight size={18} />
        </div>
        <div className="user-panel">
          <span className="avatar">
            {user.username.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{user.username}</strong>
            <small>
              {user.role === "admin" ? "放映室管理员" : "放映室成员"}
            </small>
          </div>
          <button
            className="icon-button"
            title="退出登录"
            aria-label="退出登录"
            onClick={async () => {
              await post("logout", {});
              window.location.assign("/login");
            }}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="mobile-header">
          <Link href="/">
            <Brand />
          </Link>
          <div className="mobile-account">
            <span className="badge">私人放映室</span>
            <button
              className="icon-button"
              aria-label="退出登录"
              title="退出登录"
              onClick={async () => {
                await post("logout", {});
                window.location.assign("/login");
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>
        <main>{children}</main>
        <footer>
          <span>
            FffTV <i>·</i> 留一点时间给好故事
          </span>
          <span>仅限受邀成员</span>
        </footer>
      </div>
    </div>
  );
}
