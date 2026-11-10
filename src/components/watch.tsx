"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  Heart,
  LoaderCircle,
  Radio,
  SkipForward,
  RefreshCw,
  Check,
} from "lucide-react";
import { api, post, clock } from "@/lib/client";
import type { Episode, LibraryItem, Movie, SearchResult } from "@/lib/types";
import { Player } from "./player";
import { sameWork } from "@/lib/identity";
export function Watch({
  source,
  id,
  requestedEpisode,
  requestedLine,
  libraryKey,
}: {
  source: string;
  id: string;
  requestedEpisode: string;
  requestedLine: number;
  libraryKey: string;
}) {
  const [movie, setMovie] = useState<Movie | null>(null),
    [line, setLine] = useState(0),
    [episodeKey, setEpisodeKey] = useState(""),
    [resume, setResume] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [saveError, setSaveError] = useState(""),
    [favorite, setFavorite] = useState(false),
    [autoNext, setAutoNext] = useState(true),
    [alternatives, setAlternatives] = useState<Movie[]>([]),
    [searching, setSearching] = useState(false),
    [searched, setSearched] = useState(false),
    [progress, setProgress] = useState(""),
    [switching, setSwitching] = useState(false);
  const canonical = useRef(""),
    position = useRef({ position: 0, duration: 0 }),
    currentEpisode = useRef<Episode | undefined>(undefined),
    saveChain = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    let active = true;
    Promise.all([
      api<{ movie: Movie }>(
        `detail?source=${encodeURIComponent(source)}&id=${encodeURIComponent(id)}`,
      ),
      api<{ items: LibraryItem[] }>("library"),
    ])
      .then(([detail, lib]) => {
        if (!active) return;
        const found = lib.items.find(
          (item) =>
            item.movie.key === (libraryKey || detail.movie.key) ||
            (!libraryKey && sameWork(item.movie, detail.movie)),
        );
        canonical.current = found?.movie.key || detail.movie.key;
        setMovie(detail.movie);
        setFavorite(Boolean(found?.favorite));
        const selectedLine =
          Number.isInteger(requestedLine) && detail.movie.lines[requestedLine]
            ? requestedLine
            : 0;
        setLine(selectedLine);
        const episodes = detail.movie.lines[selectedLine]?.episodes || [],
          wanted = requestedEpisode || found?.episodeKey;
        const episode = episodes.find((ep) => ep.key === wanted) || episodes[0];
        setEpisodeKey(episode?.key || "");
        if (
          found &&
          found.episodeKey === episode?.key &&
          found.position / found.duration < 0.95
        ) {
          setResume(found.position);
          position.current = {
            position: found.position,
            duration: found.duration,
          };
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [source, id, requestedEpisode, requestedLine, libraryKey]);
  const episodes = movie?.lines[line]?.episodes || [],
    episode = episodes.find((ep) => ep.key === episodeKey) || episodes[0];
  currentEpisode.current = episode;
  const index = episodes.findIndex((ep) => ep === episode),
    next = episodes.some((ep) => ep.key.startsWith("episode:"))
      ? episodes[index + 1]
      : undefined;
  function selectEpisode(key: string) {
    setResume(0);
    position.current = { position: 0, duration: 0 };
    setEpisodeKey(key);
    setProgress("");
  }
  function save(time: number, duration: number) {
    if (!movie || !episode) return;
    if (currentEpisode.current?.key === episode.key) {
      position.current = { position: time, duration };
      setProgress(`${clock(time)} / ${clock(duration)}`);
    }
    const payload = {
      source: movie.source,
      id: movie.id,
      libraryKey: canonical.current,
      episodeKey: episode.key,
      position: time,
      duration,
    };
    saveChain.current = saveChain.current
      .catch(() => {})
      .then(() => post("library", payload))
      .then(() => setSaveError(""))
      .catch((e) => setSaveError(`进度暂未保存：${e.message}`));
  }
  async function findAlternatives() {
    if (!movie) return;
    setSearching(true);
    setError("");
    setSearched(true);
    try {
      const data = await api<SearchResult>(
        `alternatives?source=${movie.source}&id=${movie.id}`,
      );
      setAlternatives(data.movies.filter((item) => sameWork(item, movie)));
      if (data.sources.every((s) => s.error))
        setError("来源搜索暂时无法连接，请稍后重试");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  }
  useEffect(() => {
    if (movie) void findAlternatives();
  }, [movie?.key]);
  async function switchSource(target: Movie) {
    if (switching || !movie) return;
    setSwitching(true);
    setError("");
    try {
      await saveChain.current;
      const { movie: detail } = await api<{ movie: Movie }>(
        `detail?source=${target.source}&id=${target.id}`,
      );
      const matchedLine = detail.lines.findIndex((item) =>
        item.episodes.some((ep) => ep.key === episode?.key),
      );
      const matches = detail.lines[matchedLine]?.episodes.find(
        (ep) => ep.key === episode?.key,
      );
      if (episode && !matches)
        throw new Error(
          "这个版本没有对应剧集，请从作品详情选择正确的季度或集数。",
        );
      if (!sameWork(detail, movie))
        throw new Error("这个版本的年份不同，请返回搜索确认作品。");
      setResume(matches ? position.current.position : 0);
      setMovie(detail);
      setLine(matchedLine >= 0 ? matchedLine : 0);
      setEpisodeKey(matches?.key || detail.lines[0]?.episodes[0]?.key || "");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSwitching(false);
    }
  }
  if (loading)
    return (
      <div className="empty">
        <LoaderCircle className="spin" size={32} />
        <h3>正在准备你的放映室…</h3>
      </div>
    );
  if (!movie)
    return (
      <div className="empty">
        <h2>这次没能连接到作品</h2>
        <p>{error}</p>
        <Link href="/catalog" className="button primary">
          返回搜索，换个来源
        </Link>
      </div>
    );
  return (
    <>
      <div className="watch-top">
        <Link href="/catalog" className="text-link">
          <ArrowLeft size={17} />
          返回片库
        </Link>
        <span>
          私人放映室
          <ChevronRight size={13} />
          {movie.type}
        </span>
      </div>
      <div className="watch-layout">
        <div className="watch-main">
          {episode ? (
            <Player
              key={`${movie.source}:${movie.id}:${episode.url}`}
              url={episode.url}
              resume={resume}
              title={`${movie.title} ${episode.name}`}
              onProgress={save}
              onEnded={() => {
                if (autoNext && next) selectEpisode(next.key);
              }}
            />
          ) : (
            <div className="empty">
              <h3>暂时没有可播放的剧集</h3>
              <p>选择其他来源再试试。</p>
            </div>
          )}
          <div className="watch-controls">
            <span>
              <i className="status-dot" />
              {movie.sourceName} · {episode?.name || "暂无剧集"}
            </span>
            <div>
              <label>
                <input
                  type="checkbox"
                  checked={autoNext}
                  onChange={(e) => setAutoNext(e.target.checked)}
                />
                自动下一集
              </label>
              <button
                className="text-link"
                disabled={!next}
                onClick={() => next && selectEpisode(next.key)}
              >
                <SkipForward size={16} />
                下一集
              </button>
            </div>
          </div>
          {saveError && <p className="notice error">{saveError}</p>}
          <div className="watch-title">
            <div>
              <span className="eyebrow">NOW SHOWING</span>
              <h1>{movie.title}</h1>
              <p className="muted">
                {[movie.year, movie.area, movie.type, movie.remarks]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <button
              className={`button ${favorite ? "saved" : ""}`}
              onClick={async () => {
                try {
                  await post("library", {
                    source: movie.source,
                    id: movie.id,
                    libraryKey: canonical.current,
                    favorite: !favorite,
                  });
                  setFavorite(!favorite);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Heart size={17} fill={favorite ? "currentColor" : "none"} />
              {favorite ? "已收藏" : "加入片单"}
            </button>
          </div>
          {episode?.quality === "preview" && (
            <p className="notice">
              当前播放项标记为抢先版，画质或内容可能不完整。建议选择高清播放项。
            </p>
          )}
          <p className="watch-description">
            {movie.description || "暂时没有作品简介。"}
          </p>
          <section className="source-panel">
            <div className="section-heading">
              <h3>
                <Radio size={18} />
                换个来源
              </h3>
              <button
                className="text-link"
                disabled={searching}
                onClick={findAlternatives}
              >
                <RefreshCw size={15} className={searching ? "spin" : ""} />
                {searching ? "查找中…" : "查找其他来源"}
              </button>
            </div>
            <p className="muted small">
              连接不顺畅时，可以换一条线路。请选择同一作品、季度和版本，进度将尽量保留。
            </p>
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
            <div className="alternative-list">
              <div className="alternative selected">
                <span>
                  <Check size={15} />
                  {movie.sourceName}
                </span>
                <strong>当前来源</strong>
              </div>
              {alternatives
                .filter(
                  (item) =>
                    item.source !== movie.source || item.id !== movie.id,
                )
                .map((item) => (
                  <button
                    className="alternative"
                    key={`${item.source}:${item.id}`}
                    disabled={switching}
                    onClick={() => void switchSource(item)}
                  >
                    <span>{item.sourceName}</span>
                    <strong>{item.title}</strong>
                    <small>
                      {item.year} · {item.remarks}
                    </small>
                  </button>
                ))}
            </div>
            {searched &&
              !searching &&
              !alternatives.some(
                (item) => item.source !== movie.source || item.id !== movie.id,
              ) && (
                <p className="muted small">
                  暂未找到其他匹配条目，可以稍后再试。
                </p>
              )}
          </section>
        </div>
        <aside className="episode-panel">
          <div className="section-heading">
            <h3>剧集列表</h3>
            <span>{episodes.length} 集</span>
          </div>
          {movie.lines.length > 1 && (
            <select
              aria-label="选择播放线路"
              className="line-select"
              value={line}
              onChange={(e) => {
                const targetLine = Number(e.target.value);
                const matched = movie.lines[targetLine]?.episodes.find(
                  (ep) => ep.key === episode?.key,
                );
                setLine(targetLine);
                setResume(matched ? position.current.position : 0);
                setEpisodeKey(
                  matched?.key ||
                    movie.lines[targetLine]?.episodes[0]?.key ||
                    "",
                );
              }}
            >
              {movie.lines.map((item, i) => (
                <option key={i} value={i}>
                  线路 {i + 1} · {item.episodes.length} 个播放项
                </option>
              ))}
            </select>
          )}
          <div className="episode-grid">
            {episodes.map((item, i) => (
              <button
                key={`${item.key}:${i}`}
                className={`episode ${item === episode ? "selected" : ""} ${item.quality === "preview" ? "low-quality" : ""}`}
                onClick={() => selectEpisode(item.key)}
              >
                {item.name}
              </button>
            ))}
          </div>
          <div className="episode-foot">
            <span className="status-dot" />
            进度自动保存{progress && <small>{progress}</small>}
          </div>
        </aside>
      </div>
    </>
  );
}
