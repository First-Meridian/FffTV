"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Heart, LoaderCircle, Play, X } from "lucide-react";
import { api, post } from "@/lib/client";
import type { LibraryItem, Movie } from "@/lib/types";
import { Poster } from "./movie-card";
export function MovieDetail({
  movie: initial,
  onClose,
}: {
  movie: Movie;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    [movie, setMovie] = useState(initial),
    [favorite, setFavorite] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [line, setLine] = useState(0);
  useEffect(() => {
    dialog.current?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);
  useEffect(() => {
    let alive = true;
    Promise.all([
      api<{ movie: Movie }>(`detail?source=${initial.source}&id=${initial.id}`),
      api<{ items: LibraryItem[] }>("library"),
    ])
      .then(([detail, lib]) => {
        if (alive) {
          setMovie(detail.movie);
          setFavorite(
            lib.items.some(
              (item) => item.movie.key === initial.key && item.favorite,
            ),
          );
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [initial]);
  const episodes = movie.lines[line]?.episodes || [];
  const watch = (episode?: string) =>
    `/watch?source=${encodeURIComponent(movie.source)}&id=${encodeURIComponent(movie.id)}&line=${line}${episode ? `&episode=${encodeURIComponent(episode)}` : ""}`;
  return (
    <dialog
      className="detail-dialog"
      ref={dialog}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      aria-labelledby="detail-title"
    >
      <button
        className="icon-button close-button"
        aria-label="关闭详情"
        onClick={onClose}
      >
        <X size={22} />
      </button>
      <div className="detail-top">
        <Poster movie={movie} />
        <div>
          <span className="eyebrow">{movie.type || "YOUR NEXT STORY"}</span>
          <h2 id="detail-title">{movie.title}</h2>
          <div className="meta-row">
            {[movie.year, movie.area, movie.language, movie.remarks]
              .filter(Boolean)
              .map((value, i) => (
                <span key={i}>{value}</span>
              ))}
          </div>
          <p className="description">
            {movie.description || "这部作品暂时没有简介，点开看看它的故事。"}
          </p>
          <div className="detail-credits">
            {movie.director && (
              <p>
                导演 <span>{movie.director}</span>
              </p>
            )}
            {movie.actors && (
              <p>
                主演 <span>{movie.actors}</span>
              </p>
            )}
          </div>
          <div className="actions">
            {episodes.length > 0 && (
              <Link href={watch()} className="button primary">
                <Play size={17} fill="currentColor" />
                开始观看
              </Link>
            )}
            <button
              className={`button ${favorite ? "saved" : ""}`}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await post("library", {
                    source: movie.source,
                    id: movie.id,
                    favorite: !favorite,
                  });
                  setFavorite(!favorite);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Heart size={17} fill={favorite ? "currentColor" : "none"} />
              {favorite ? "已加入片单" : "加入片单"}
            </button>
          </div>
        </div>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="section-heading">
        <h3>
          选择剧集 <small>{episodes.length} 个播放项</small>
        </h3>
        <span className="badge">{movie.sourceName}</span>
      </div>
      {movie.lines.length > 1 && (
        <div className="chips">
          {movie.lines.map((item, i) => (
            <button
              key={i}
              className={`chip ${line === i ? "selected" : ""}`}
              onClick={() => setLine(i)}
            >
              线路 {i + 1} · {item.episodes.length} 集
            </button>
          ))}
        </div>
      )}
      {loading ? (
        <p className="loading">
          <LoaderCircle className="spin" size={19} />
          正在获取最新剧集…
        </p>
      ) : episodes.length ? (
        <div className="episode-grid">
          {episodes.map((episode, i) => (
            <Link
              key={`${episode.key}-${i}`}
              href={watch(episode.key)}
              className={`episode ${episode.quality === "preview" ? "low-quality" : ""}`}
            >
              {episode.name}
              {episode.quality === "preview" && <small>抢先 / 预告</small>}
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty compact">
          这个来源暂时没有可直接播放的地址，请返回搜索选择其他来源。
        </div>
      )}
    </dialog>
  );
}
