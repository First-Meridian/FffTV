"use client";
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { AlertCircle, RotateCw, LoaderCircle, Play } from "lucide-react";
export function Player({
  url,
  resume,
  onProgress,
  onEnded,
  title,
}: {
  url: string;
  resume: number;
  onProgress: (position: number, duration: number) => void;
  onEnded: () => void;
  title: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null),
    hlsRef = useRef<Hls | null>(null),
    callbacks = useRef({ onProgress, onEnded });
  callbacks.current = { onProgress, onEnded };
  const [attempt, setAttempt] = useState(0),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [needsPlay, setNeedsPlay] = useState(false),
    [resolution, setResolution] = useState("");
  useEffect(() => {
    const video = videoRef.current!;
    let resumed = false,
      lastSave = 0,
      played = false;
    let watchdog: ReturnType<typeof setTimeout>;
    setError("");
    setLoading(true);
    setNeedsPlay(false);
    setResolution("");
    const stall = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        setLoading(false);
        setError("视频连接较慢或已经中断。可以重试，或在下方选择其他来源。");
      }, 20000);
    };
    const loaded = () => {
      if (!resumed && Number.isFinite(video.duration) && video.duration > 0) {
        resumed = true;
        if (resume > 5 && resume < video.duration - 15)
          video.currentTime = resume;
      }
      setResolution(
        video.videoHeight ? `${video.videoWidth} × ${video.videoHeight}` : "",
      );
    };
    const canPlay = () => {
      loaded();
      setLoading(false);
      clearTimeout(watchdog);
      if (!played) {
        played = true;
        void video.play().catch(() => setNeedsPlay(true));
      }
    };
    const playing = () => {
      clearTimeout(watchdog);
      setLoading(false);
      setError("");
      setNeedsPlay(false);
    };
    const save = () => {
      if (resumed && video.currentTime > 0 && Number.isFinite(video.duration))
        callbacks.current.onProgress(video.currentTime, video.duration);
    };
    const tick = () => {
      if (Date.now() - lastSave > 10000) {
        lastSave = Date.now();
        save();
      }
    };
    const ended = () => {
      save();
      callbacks.current.onEnded();
    };
    const waiting = () => {
      setLoading(true);
      stall();
    };
    const mediaError = () => {
      setLoading(false);
      setError("浏览器无法播放这个视频，请尝试其他来源。");
    };
    const visibility = () => {
      if (document.hidden) save();
    };
    video.addEventListener("loadedmetadata", loaded);
    video.addEventListener("canplay", canPlay);
    video.addEventListener("playing", playing);
    video.addEventListener("waiting", waiting);
    video.addEventListener("timeupdate", tick);
    video.addEventListener("pause", save);
    video.addEventListener("ended", ended);
    video.addEventListener("error", mediaError);
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", visibility);
    stall();
    if (
      /\.m3u8(?:[?#]|$)/i.test(url) &&
      !video.canPlayType("application/vnd.apple.mpegurl") &&
      Hls.isSupported()
    ) {
      const hls = new Hls({
        maxBufferLength: 25,
        maxMaxBufferLength: 45,
        backBufferLength: 20,
        manifestLoadingTimeOut: 12000,
        manifestLoadingMaxRetry: 1,
        fragLoadingTimeOut: 15000,
        fragLoadingMaxRetry: 2,
      });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          clearTimeout(watchdog);
          setLoading(false);
          setError(
            data.type === Hls.ErrorTypes.NETWORK_ERROR
              ? "播放来源连接失败，请重试或换一个来源。"
              : "这个视频的编码暂时无法播放，请换一个来源。",
          );
          hls.stopLoad();
        }
      });
    } else video.src = url;
    return () => {
      save();
      clearTimeout(watchdog);
      video.removeEventListener("loadedmetadata", loaded);
      video.removeEventListener("canplay", canPlay);
      video.removeEventListener("playing", playing);
      video.removeEventListener("waiting", waiting);
      video.removeEventListener("timeupdate", tick);
      video.removeEventListener("pause", save);
      video.removeEventListener("ended", ended);
      video.removeEventListener("error", mediaError);
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", visibility);
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [url, attempt]);
  return (
    <div className="video-wrap">
      <video
        ref={videoRef}
        controls
        playsInline
        preload="metadata"
        aria-label={title}
      />
      {loading && !error && (
        <div className="video-loading">
          <LoaderCircle size={28} className="spin" />
          <span>正在连接故事…</span>
        </div>
      )}
      {needsPlay && !error && (
        <button
          className="video-start"
          aria-label="播放视频"
          onClick={() => {
            void videoRef.current
              ?.play()
              .catch(() => setError("无法开始播放，请重试"));
          }}
        >
          <Play size={30} fill="currentColor" />
        </button>
      )}
      {error && (
        <div className="video-error" role="alert">
          <AlertCircle size={30} />
          <h3>这条线路暂时没准备好</h3>
          <p>{error}</p>
          <button
            className="button primary"
            onClick={() => setAttempt((n) => n + 1)}
          >
            <RotateCw size={16} />
            重新连接
          </button>
        </div>
      )}
      {resolution && !error && (
        <span className="video-resolution">{resolution}</span>
      )}
    </div>
  );
}
