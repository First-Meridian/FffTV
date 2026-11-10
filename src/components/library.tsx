"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, History, ArrowRight, LoaderCircle } from "lucide-react";
import { api, clock } from "@/lib/client";
import type { LibraryItem, Movie } from "@/lib/types";
import { MovieCard } from "./movie-card";
import { MovieDetail } from "./movie-detail";
export function Library({ mode }: { mode: "favorites" | "history" }) {
  const [items, setItems] = useState<LibraryItem[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<Movie | null>(null);
  const load = () =>
    api<{ items: LibraryItem[] }>("library")
      .then((data) => setItems(data.items))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  useEffect(() => {
    void load();
  }, []);
  const visible = items.filter((item) =>
    mode === "favorites" ? item.favorite : item.position > 0,
  );
  return (
    <>
      <div className="page-top">
        <span className="eyebrow">YOUR OWN COLLECTION</span>
      </div>
      <div className="page-title">
        <h1>{mode === "favorites" ? "留给以后的好故事" : "接着上次的故事"}</h1>
        <p>
          {mode === "favorites"
            ? "想看的、喜欢的，都放在这里。"
            : "每一段旅程，都从你离开的地方继续。"}
        </p>
      </div>
      {error && <div className="notice error">{error}</div>}
      {loading ? (
        <p className="loading">
          <LoaderCircle className="spin" />
          正在打开你的片单…
        </p>
      ) : visible.length ? (
        <div className="movie-grid">
          {visible.map((item) => (
            <MovieCard
              key={item.movie.key}
              movie={item.movie}
              progress={
                mode === "history"
                  ? (item.position / item.duration) * 100
                  : undefined
              }
              subtitle={
                mode === "history"
                  ? `${item.episodeName} · ${clock(item.position)} / ${clock(item.duration)}`
                  : undefined
              }
              onClick={() => {
                if (mode === "history")
                  window.location.assign(
                    `/watch?source=${item.movie.source}&id=${item.movie.id}&libraryKey=${item.movie.key}`,
                  );
                else setSelected(item.movie);
              }}
            />
          ))}
        </div>
      ) : (
        <div className="empty library-empty">
          {mode === "favorites" ? <Heart size={40} /> : <History size={40} />}
          <h3>
            {mode === "favorites"
              ? "第一部心动，还在等你"
              : "你的故事，即将开始"}
          </h3>
          <p>
            {mode === "favorites"
              ? "在作品详情里点一下爱心，就能把它留在这里。"
              : "开始观看后，播放进度会自动保存在这里。"}
          </p>
          <Link href="/" className="button primary">
            去发现好故事
            <ArrowRight size={16} />
          </Link>
        </div>
      )}
      {selected && (
        <MovieDetail
          movie={selected}
          onClose={() => {
            setSelected(null);
            void load();
          }}
        />
      )}
    </>
  );
}
