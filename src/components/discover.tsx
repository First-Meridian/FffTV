"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Search,
  Sparkles,
  Film,
  Tv,
  SlidersHorizontal,
  RotateCw,
  X,
  ChevronRight,
} from "lucide-react";
import { api } from "@/lib/client";
import type { LibraryItem, Movie, SearchResult, Source } from "@/lib/types";
import { MovieCard } from "./movie-card";
import { MovieDetail } from "./movie-detail";
const suggestions = [
  "葬送的芙莉莲",
  "咒术回战",
  "挽救计划",
  "星际穿越",
  "千与千寻",
];
export function Discover() {
  const [query, setQuery] = useState(""),
    [submitted, setSubmitted] = useState(""),
    [result, setResult] = useState<SearchResult>({ movies: [], sources: [] }),
    [sources, setSources] = useState<Source[]>([]),
    [source, setSource] = useState(""),
    [filter, setFilter] = useState("all"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<Movie | null>(null),
    [history, setHistory] = useState<LibraryItem[]>([]);
  const generation = useRef(0);
  async function search(value: string, sourceId = source) {
    const current = ++generation.current;
    setSubmitted(value);
    setLoading(true);
    setError("");
    try {
      const data = await api<SearchResult>(
        `search?q=${encodeURIComponent(value)}${sourceId ? `&source=${sourceId}` : ""}`,
      );
      if (current === generation.current) setResult(data);
    } catch (e) {
      if (current === generation.current) setError((e as Error).message);
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    api<{ sources: Source[] }>("sources")
      .then((data) => setSources(data.sources))
      .catch(() => {});
    api<{ items: LibraryItem[] }>("library")
      .then((data) =>
        setHistory(
          data.items
            .filter(
              (item) =>
                item.position > 0 && item.position / item.duration < 0.95,
            )
            .slice(0, 6),
        ),
      )
      .catch(() => {});
    void search("");
  }, []);
  const movies = result.movies.filter(
    (movie) =>
      filter === "all" ||
      (filter === "anime"
        ? /动漫|动画/.test(movie.type)
        : !/动漫|动画|剧|综艺|短剧/.test(movie.type)),
  );
  return (
    <>
      <div className="page-top">
        <div className="breadcrumb">
          放映室 <ChevronRight size={13} />
          <span>发现</span>
        </div>
        <span className="member-pill">
          <i />
          INVITE ONLY
        </span>
      </div>
      <div className="discover-title">
        <div>
          <span className="eyebrow">A LITTLE ESCAPE, A GREAT STORY.</span>
          <h1>
            今晚，把时间交给故事<span>。</span>
          </h1>
        </div>
        <span className="desktop-only muted">电影 / 番剧 / 每一个好故事</span>
      </div>
      <form
        className="search-bar"
        onSubmit={(e) => {
          e.preventDefault();
          void search(query);
        }}
      >
        <Search size={22} />
        <input
          aria-label="搜索电影或番剧"
          placeholder="搜索电影、番剧，或一个念念不忘的名字…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={80}
        />
        {query && (
          <button
            type="button"
            className="icon-button"
            aria-label="清空搜索"
            onClick={() => {
              setQuery("");
              void search("");
            }}
          >
            <X size={17} />
          </button>
        )}
        <button className="button primary" type="submit">
          找个故事
          <ArrowRight size={16} />
        </button>
      </form>
      <div className="suggestions">
        <span>试试搜索</span>
        {suggestions.map((title) => (
          <button
            key={title}
            onClick={() => {
              setQuery(title);
              void search(title);
            }}
          >
            {title}
          </button>
        ))}
      </div>
      {!submitted && (
        <section className="hero">
          <div className="hero-art">
            <div className="planet" />
            <div className="mountain back" />
            <div className="mountain front" />
            <span className="hero-stars" />
          </div>
          <div className="hero-content">
            <span className="hero-kicker">
              <Sparkles size={14} />
              今晚的灵感 · 科幻经典
            </span>
            <h2>
              在星辰之间，
              <br />
              找回那个想念的人。
            </h2>
            <p>
              有些故事，值得一遍又一遍。
              <br />
              从《星际穿越》开始今晚的旅程。
            </p>
            <button
              className="button light"
              onClick={() => {
                setQuery("星际穿越");
                void search("星际穿越");
              }}
            >
              寻找《星际穿越》
              <ArrowRight size={17} />
            </button>
          </div>
          <div className="hero-index">
            <span>01</span> / THE WORLD BEYOND
          </div>
        </section>
      )}
      {history.length > 0 && !submitted && (
        <section className="continue-section">
          <div className="section-heading">
            <h2>
              故事，还没结束 <span>CONTINUE WATCHING</span>
            </h2>
            <Link href="/history" className="text-link">
              全部记录
              <ArrowRight size={15} />
            </Link>
          </div>
          <div className="continue-grid">
            {history.slice(0, 3).map((item) => (
              <Link
                key={item.movie.key}
                className="continue-card"
                href={`/watch?source=${item.movie.source}&id=${item.movie.id}&libraryKey=${item.movie.key}`}
              >
                <span className="continue-icon">
                  <Film size={22} />
                </span>
                <div>
                  <strong>{item.movie.title}</strong>
                  <small>
                    {item.episodeName} · 看到{" "}
                    {Math.round((item.position / item.duration) * 100)}%
                  </small>
                  <span className="mini-progress">
                    <i
                      style={{
                        width: `${(item.position / item.duration) * 100}%`,
                      }}
                    />
                  </span>
                </div>
                <ArrowRight size={17} />
              </Link>
            ))}
          </div>
        </section>
      )}
      <section className="catalog-section">
        <div className="section-heading">
          <h2>
            {submitted ? `“${submitted}”的搜索结果` : "发现下一部心动"}
            <span>
              {submitted
                ? `${movies.length} 个来源条目`
                : "EXPLORE THE STORIES"}
            </span>
          </h2>
          <button
            className="text-link"
            onClick={() => void search(submitted, source)}
          >
            <RotateCw size={14} className={loading ? "spin" : ""} />
            刷新
          </button>
        </div>
        <div className="catalog-toolbar">
          <div className="chips">
            {[
              { id: "all", label: "全部", icon: Sparkles },
              { id: "anime", label: "动漫番剧", icon: Tv },
              { id: "movie", label: "电影", icon: Film },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={`chip ${filter === id ? "selected" : ""}`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>
          <label className="source-select">
            <SlidersHorizontal size={15} />
            <select
              aria-label="选择搜索来源"
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                void search(submitted, e.target.value);
              }}
            >
              <option value="">全部启用来源</option>
              {sources
                .filter((s) => s.enabled)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        {result.sources.length > 0 && (
          <div className="source-status">
            {result.sources.map((s) => (
              <span
                key={s.id}
                className={s.error ? "unavailable" : ""}
                title={s.error || `${s.elapsed}ms`}
              >
                <i />
                {s.name} · {s.error ? "暂时不可用" : `${s.count} 条`}
              </span>
            ))}
          </div>
        )}
        {loading ? (
          <div className="movie-grid" aria-label="正在搜索" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => (
              <div className="skeleton-card" key={i}>
                <div />
                <span />
                <small />
              </div>
            ))}
          </div>
        ) : movies.length ? (
          <div className="movie-grid">
            {movies.map((movie) => (
              <MovieCard
                key={`${movie.source}:${movie.id}`}
                movie={movie}
                onClick={() => setSelected(movie)}
              />
            ))}
          </div>
        ) : (
          <div className="empty">
            <Search size={34} />
            <h3>
              {result.sources.some((s) => s.error)
                ? "这个故事，暂时没连接上"
                : "还没有找到这个故事"}
            </h3>
            <p>
              {result.sources.some((s) => s.error)
                ? "部分来源连接失败，可以选择其他来源或稍后重试。"
                : "试试更短的片名，或切换到其他来源。"}
            </p>
            <button className="button" onClick={() => void search(submitted)}>
              重新查找
              <RotateCw size={15} />
            </button>
          </div>
        )}
      </section>
      {selected && (
        <MovieDetail movie={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
