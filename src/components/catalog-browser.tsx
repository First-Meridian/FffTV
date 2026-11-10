"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Search, RotateCw } from "lucide-react";
import { api } from "@/lib/client";
import type { CatalogResult, Movie, SearchResult, Source } from "@/lib/types";
import { MovieCard } from "./movie-card";
import { MovieDetail } from "./movie-detail";

export function Catalog() {
  const params = useSearchParams(),
    router = useRouter(),
    key = params.toString();
  const [query, setQuery] = useState(params.get("q") || ""),
    [data, setData] = useState<CatalogResult | null>(null),
    [sources, setSources] = useState<Source[]>([]),
    [selected, setSelected] = useState<Movie | null>(null),
    [loading, setLoading] = useState(true),
    [searching, setSearching] = useState(false),
    [error, setError] = useState(""),
    [searchNote, setSearchNote] = useState(""),
    [more, setMore] = useState(0),
    [refresh, setRefresh] = useState(0);
  const generation = useRef(0),
    searchKey = useRef("");
  useEffect(() => {
    api<{ sources: Source[] }>("sources")
      .then((r) => setSources(r.sources))
      .catch(() => {});
  }, []);
  useEffect(() => {
    setQuery(params.get("q") || "");
  }, [params]);
  useEffect(() => {
    const current = ++generation.current,
      queryParams = new URLSearchParams(key),
      q = queryParams.get("q") || "",
      source = queryParams.get("source") || "";
    setLoading(true);
    setError("");
    const fetchPage = async () => {
      try {
        const liveKey = JSON.stringify([q, source]);
        if (q && searchKey.current !== liveKey) {
          setSearching(true);
          setSearchNote("");
          setMore(0);
          const found = await api<SearchResult>(
            `search?${new URLSearchParams({ q, source })}`,
          );
          if (current !== generation.current) return;
          searchKey.current = liveKey;
          setMore(found.sources.some((s) => (s.pages || 1) > 1) ? 2 : 0);
          const failed = found.sources
            .filter((s) => s.error)
            .map((s) => s.name);
          setSearchNote(
            failed.length
              ? `${failed.join("、")}暂未连接，展示已收录结果。`
              : "已补充来源搜索结果，并合并相同作品。",
          );
        } else if (!q) {
          setSearchNote("");
          setMore(0);
          searchKey.current = "";
        }
        const result = await api<CatalogResult>(`catalog?${key}`);
        if (current === generation.current) setData(result);
      } catch (e) {
        if (current === generation.current) setError((e as Error).message);
      } finally {
        if (current === generation.current) {
          setLoading(false);
          setSearching(false);
        }
      }
    };
    void fetchPage();
    return () => {
      generation.current++;
    };
  }, [key, refresh]);
  const update = (name: string, value: string) => {
    const next = new URLSearchParams(key);
    value ? next.set(name, value) : next.delete(name);
    if (name !== "page") next.delete("page");
    router.push(`/catalog${next.size ? `?${next}` : ""}`, { scroll: false });
  };
  async function searchMore() {
    const current = generation.current;
    setSearching(true);
    setError("");
    try {
      const found = await api<SearchResult>(
        `search?${new URLSearchParams({ q: params.get("q") || "", source: params.get("source") || "", page: String(more) })}`,
      );
      if (current !== generation.current) return;
      if (found.sources.some((s) => s.error))
        setSearchNote(
          "部分来源未完成检索，可再次点击重试；已返回的作品已加入片库。",
        );
      else
        setMore(
          found.sources.some((s) => (s.pages || 1) > more) ? more + 1 : 0,
        );
      const result = await api<CatalogResult>(`catalog?${key}`);
      if (current === generation.current) setData(result);
    } catch (e) {
      if (current === generation.current) setError((e as Error).message);
    } finally {
      if (current === generation.current) setSearching(false);
    }
  }
  const select = (
    label: string,
    name: string,
    options: { value: string; label: string }[],
  ) => (
    <label>
      {label}
      <select
        aria-label={label}
        value={params.get(name) || ""}
        onChange={(e) => update(name, e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
  const options = (all: string, items: string[] = []) => [
    { value: "", label: all },
    ...items.map((value) => ({ value, label: value })),
  ];
  return (
    <>
      <div className="page-top">
        <span className="eyebrow">FIND YOUR NEXT STORY</span>
        <span className="member-pill">
          <i />
          PRIVATE CINEMA
        </span>
      </div>
      <div className="page-title">
        <h1>每一个故事，只占一个位置。</h1>
        <p>按你喜欢的方式挑选，进入作品后自由切换播放源。</p>
      </div>
      <form
        className="search-bar"
        onSubmit={(e) => {
          e.preventDefault();
          searchKey.current = "";
          update("q", query.trim());
          setRefresh((n) => n + 1);
        }}
      >
        <Search size={22} />
        <input
          aria-label="搜索片库"
          placeholder="输入电影、番剧或电视剧名称…"
          value={query}
          maxLength={80}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="button primary" type="submit">
          搜索作品
          <ArrowRight size={16} />
        </button>
      </form>
      <section className="catalog-section">
        <div className="catalog-toolbar">
          <div className="chips">
            {[
              ["", "全部类型"],
              ["anime", "动漫番剧"],
              ["movie", "电影"],
              ["series", "电视剧"],
              ["variety", "综艺"],
              ["short", "短剧"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={`chip ${(params.get("kind") || "") === id ? "selected" : ""}`}
                onClick={() => update("kind", id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="catalog-filters">
          {select("上映年份", "year", options("全部年份", data?.facets.years))}
          {select(
            "国家／地区",
            "area",
            options("全部地区", data?.facets.areas),
          )}
          {select("题材", "genre", options("全部题材", data?.facets.genres))}
          {select("播放源", "source", [
            { value: "", label: "全部来源" },
            ...sources
              .filter((s) => s.enabled)
              .map((s) => ({ value: s.id, label: s.name })),
          ])}
          {select("排列方式", "sort", [
            { value: "", label: "上映时间：从新到旧" },
            { value: "updated", label: "最近更新" },
            { value: "title", label: "按片名" },
          ])}
          <label>
            上映时间从
            <input
              aria-label="上映开始日期"
              type="date"
              value={params.get("from") || ""}
              onChange={(e) => update("from", e.target.value)}
            />
          </label>
          <label>
            至
            <input
              aria-label="上映结束日期"
              type="date"
              value={params.get("to") || ""}
              onChange={(e) => update("to", e.target.value)}
            />
          </label>
          <button
            className="text-link reset-filters"
            onClick={() => router.push("/catalog", { scroll: false })}
          >
            清空筛选
          </button>
        </div>
        <div className="section-heading">
          <h2>
            {params.get("q") ? `“${params.get("q")}”` : "影视片库"}
            <span>
              {data ? `${data.total.toLocaleString()} 部作品` : "正在读取"}
            </span>
          </h2>
          <button
            className="text-link"
            disabled={loading}
            onClick={() => {
              searchKey.current = "";
              setRefresh((n) => n + 1);
            }}
          >
            <RotateCw size={14} className={loading ? "spin" : ""} />
            刷新
          </button>
        </div>
        {data && (
          <div className="index-status">
            <p>
              {data.sync.some((s) => !s.completed)
                ? "片库正在分批收录，数量和筛选范围以已收录作品为准；找不到时可搜索片名补充。"
                : "已完成首次片库收录，后续更新会自动同步。"}
            </p>
            <div className="source-status">
              {data.sync.map((s) => (
                <span
                  key={s.id}
                  className={s.error ? "unavailable" : ""}
                  title={
                    s.error ||
                    (s.pages
                      ? `同步至 ${Math.min(s.nextPage - 1, s.pages)} / ${s.pages} 页`
                      : "等待同步")
                  }
                >
                  <i />
                  {s.name} · {s.indexed.toLocaleString()} 条
                  {s.error ? " · 稍后重试" : !s.completed ? " · 收录中" : ""}
                </span>
              ))}
            </div>
            <small>
              有首播日期的作品按日期筛选；只有年份的作品按全年范围匹配。缺失年份的作品保留在“全部年份”。
            </small>
          </div>
        )}
        {searchNote && (
          <p className="muted small" role="status">
            {searchNote}
          </p>
        )}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <div className="empty" aria-busy="true">
            <RotateCw className="spin" />
            <p>{searching ? "正在查找各来源并合并作品…" : "正在整理片库…"}</p>
          </div>
        ) : data?.movies.length ? (
          <div className="movie-grid">
            {data.movies.map((movie) => (
              <MovieCard
                key={`${movie.key}:${movie.kind}`}
                movie={movie}
                onClick={() => setSelected(movie)}
              />
            ))}
          </div>
        ) : (
          <div className="empty">
            <Search size={32} />
            <h3>当前筛选下暂无已收录作品</h3>
            <p>试试搜索片名、放宽筛选，或待收录进度更新后刷新。</p>
          </div>
        )}
        {data && data.pages > 0 && (
          <nav className="pagination" aria-label="片库分页">
            <button
              className="button"
              disabled={loading || data.page <= 1}
              onClick={() => update("page", String(data.page - 1))}
            >
              <ArrowLeft size={16} />
              上一页
            </button>
            <span>
              第 {data.page} / {data.pages} 页 · 每页 {data.pageSize} 部
            </span>
            <button
              className="button"
              disabled={loading || data.page >= data.pages}
              onClick={() => update("page", String(data.page + 1))}
            >
              下一页
              <ArrowRight size={16} />
            </button>
          </nav>
        )}
        {more > 0 && params.get("q") && (
          <div className="search-more">
            <p className="muted small">
              来源还有未收录的搜索结果，继续检索后会合并到片库分页中。
            </p>
            <button
              className="button"
              disabled={searching || loading}
              onClick={() => void searchMore()}
            >
              {searching ? "正在检索…" : "继续检索来源结果"}
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
