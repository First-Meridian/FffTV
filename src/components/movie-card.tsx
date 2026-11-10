"use client";
import { useState } from "react";
import { Play, Film } from "lucide-react";
import type { Movie } from "@/lib/types";
export function Poster({
  movie,
  className = "",
}: {
  movie: Movie;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      className={`poster ${className}`}
      style={
        {
          "--poster-hue": String(
            [...movie.title].reduce((n, c) => n + c.charCodeAt(0), 0) % 360,
          ),
        } as React.CSSProperties
      }
    >
      {movie.poster && !failed ? (
        <img
          src={movie.poster}
          alt={`${movie.title}海报`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="poster-fallback">
          <Film size={28} />
          <span>{movie.title}</span>
          <small>{movie.year || "FffTV"}</small>
        </div>
      )}
    </div>
  );
}
export function MovieCard({
  movie,
  onClick,
  progress,
  subtitle,
}: {
  movie: Movie;
  onClick: () => void;
  progress?: number;
  subtitle?: string;
}) {
  return (
    <button className="movie-card" onClick={onClick}>
      <div className="poster-wrap">
        <Poster movie={movie} />
        <span className="poster-tag">
          {movie.remarks || movie.type || "待探索"}
        </span>
        <span className="poster-source">
          {movie.variants?.length
            ? `${new Set(movie.variants.map((v) => v.source)).size} 个播放源`
            : movie.sourceName}
        </span>
        <div className="poster-hover">
          <span>
            <Play size={22} fill="currentColor" />
          </span>
        </div>
        {progress !== undefined && (
          <div className="progress-track">
            <i style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
        )}
      </div>
      <h3 title={movie.title}>{movie.title}</h3>
      <p>
        {subtitle ||
          [movie.year, movie.type].filter(Boolean).join(" · ") ||
          "查看作品详情"}
      </p>
    </button>
  );
}
