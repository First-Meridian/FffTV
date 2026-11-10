"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  LoaderCircle,
  Search,
  X,
  Tv,
} from "lucide-react";
import { api } from "@/lib/client";
import type {
  Movie,
  SearchResult,
  SeasonEntry,
  SeasonResult,
} from "@/lib/types";
import { MovieDetail } from "./movie-detail";

function SeasonDetail({
  entry,
  onClose,
  onPlay,
}: {
  entry: SeasonEntry;
  onClose: () => void;
  onPlay: (movie: Movie) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    [result, setResult] = useState<SearchResult | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    dialog.current?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);
  useEffect(() => {
    let alive = true;
    setResult(null);
    setError("");
    api<SearchResult>(`season/match?id=${entry.id}`)
      .then((r) => {
        if (alive) setResult(r);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [entry.id, retry]);
  return (
    <dialog
      ref={dialog}
      className="detail-dialog"
      aria-labelledby="season-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        className="icon-button close-button"
        aria-label="关闭新番详情"
        onClick={onClose}
      >
        <X size={22} />
      </button>
      <span className="eyebrow">THIS SEASON · {entry.platform}</span>
      <h2 id="season-title">{entry.title}</h2>
      <p className="muted">
        {entry.originalTitle !== entry.title && `${entry.originalTitle} · `}
        {entry.date} 首播
      </p>
      <p className="description">{entry.description || "暂无简介。"}</p>
      {!result && !error && (
        <p className="loading">
          <LoaderCircle className="spin" size={18} />
          正在匹配这部新番的播放来源…
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {result?.movies.map((movie) => (
        <button
          key={movie.key}
          className="button primary"
          onClick={() => onPlay(movie)}
        >
          选择剧集 · {new Set(movie.variants?.map((v) => v.source)).size || 1}{" "}
          个播放源
          <ArrowRight size={16} />
        </button>
      ))}
      {result && !result.movies.length && (
        <div className="notice">
          {result.sources.some((s) => s.error)
            ? "部分来源暂未连接，暂未确认匹配的播放地址。"
            : "暂未找到同名、同年份的播放资源。新番仍会保留在本季名单中。"}
        </div>
      )}
      <div className="actions season-actions">
        <Link
          className="button"
          href={`/catalog?q=${encodeURIComponent(entry.title)}`}
        >
          在片库中搜索
        </Link>
        {(error || result?.movies.length === 0) && (
          <button className="button" onClick={() => setRetry((n) => n + 1)}>
            重新匹配
          </button>
        )}
        <a
          className="text-link"
          href={`https://bgm.tv/subject/${entry.id}`}
          target="_blank"
          rel="noreferrer"
        >
          Bangumi 条目
          <ArrowRight size={14} />
        </a>
      </div>
    </dialog>
  );
}
export function Discover() {
  const [data, setData] = useState<SeasonResult | null>(null),
    [error, setError] = useState(""),
    [filter, setFilter] = useState(""),
    [selected, setSelected] = useState<SeasonEntry | null>(null),
    [movie, setMovie] = useState<Movie | null>(null),
    [retry, setRetry] = useState(0),
    [failed, setFailed] = useState<Set<number>>(new Set());
  useEffect(() => {
    let alive = true;
    setError("");
    api<SeasonResult>("season")
      .then((r) => {
        if (alive) setData(r);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [retry]);
  const entries =
    data?.entries.filter(
      (e) =>
        !filter ||
        [e.title, ...e.aliases].some((name) =>
          name.toLowerCase().includes(filter.toLowerCase()),
        ),
    ) || [];
  return (
    <>
      <div className="page-top">
        <span className="eyebrow">A NEW SEASON, A NEW STORY.</span>
        <span className="member-pill">
          <i />
          INVITE ONLY
        </span>
      </div>
      <div className="season-hero">
        <div>
          <span className="hero-kicker">
            <CalendarDays size={16} />
            {data?.label || "本季新番"}
          </span>
          <h1>
            这一季，
            <br />
            又有新的期待<span>。</span>
          </h1>
          <p>
            把这一季的故事收进日常。
            <br />
            从第一集开始，等一次每周的相见。
          </p>
          <Link className="button primary" href="/catalog">
            去影视片库
            <ArrowRight size={17} />
          </Link>
        </div>
        <div className="season-art" aria-hidden="true">
          <div className="season-orbit" />
          <span>
            {data ? String((data.quarter - 1) * 3 + 1).padStart(2, "0") : "TV"}
          </span>
          <small>{data?.year || "THIS SEASON"} / NEW ANIME</small>
        </div>
      </div>
      <section className="catalog-section">
        <div className="section-heading">
          <h2>
            本季新番全览
            <span>
              {data ? `${data.entries.length} 部 TV / WEB 番剧` : "THIS SEASON"}
            </span>
          </h2>
          <Link className="text-link" href="/catalog?kind=anime">
            全部动漫
            <ArrowRight size={15} />
          </Link>
        </div>
        <div className="season-explainer">
          <p>
            按北京时间的当前季度，展示 Bangumi 收录的本季首播 TV／WEB
            动画，包含本季尚未开播的作品。跨季续播作品可在片库查找。
          </p>
          <p>
            名单独立于播放资源；点进作品后查找可用来源。
            {data && (
              <span>
                {" "}
                最近更新：{new Date(data.updated).toLocaleString("zh-CN")}
              </span>
            )}
          </p>
          <a href="https://bgm.tv" target="_blank" rel="noreferrer">
            目录与海报：Bangumi
          </a>
        </div>
        {data?.stale && (
          <p className="notice" role="status">
            {data.error}
          </p>
        )}
        <div className="season-search">
          <Search size={18} />
          <input
            aria-label="筛选本季新番"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="在本季名单中查找…"
          />
        </div>
        {error ? (
          <div className="empty">
            <h3>本季目录暂时没连接上</h3>
            <p>{error}</p>
            <button className="button" onClick={() => setRetry((n) => n + 1)}>
              重新加载
            </button>
          </div>
        ) : !data ? (
          <div className="empty" aria-busy="true">
            <LoaderCircle className="spin" size={30} />
            <p>正在读取完整季度名单…</p>
          </div>
        ) : entries.length ? (
          <div className="movie-grid season-grid">
            {entries.map((entry) => (
              <button
                className="movie-card"
                key={entry.id}
                onClick={() => setSelected(entry)}
              >
                <div className="poster-wrap">
                  <div className="poster">
                    {entry.poster && !failed.has(entry.id) ? (
                      <img
                        src={entry.poster}
                        alt={`${entry.title}海报`}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailed((prev) => new Set([...prev, entry.id]))
                        }
                      />
                    ) : (
                      <div className="poster-fallback">
                        <Tv size={30} />
                        <span>{entry.title}</span>
                      </div>
                    )}
                  </div>
                  <span className="poster-tag">{entry.platform}</span>
                  <span className="poster-source">
                    {entry.date.slice(5)} 首播
                  </span>
                  <div className="poster-hover">
                    <span>
                      <ArrowRight size={23} />
                    </span>
                  </div>
                </div>
                <h3 title={entry.title}>{entry.title}</h3>
                <p>
                  {entry.originalTitle !== entry.title
                    ? entry.originalTitle
                    : "查看介绍与播放来源"}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty">
            <h3>
              {filter ? "本季名单中没有匹配的作品" : "目录暂未收录本季首播番剧"}
            </h3>
            <Link href="/catalog" className="text-link">
              去片库找找
              <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </section>
      {selected && (
        <SeasonDetail
          entry={selected}
          onClose={() => setSelected(null)}
          onPlay={(value) => {
            setSelected(null);
            setMovie(value);
          }}
        />
      )}
      {movie && <MovieDetail movie={movie} onClose={() => setMovie(null)} />}
    </>
  );
}
