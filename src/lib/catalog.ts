import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { isPublicAddress } from "./network";
import { normalizedTitle } from "./identity";
import type { Episode, Movie, PlayLine } from "./types";

export const BUILTIN_SOURCES = [
  {
    id: "modu",
    name: "魔都",
    url: "https://www.mdzyapi.com/api.php/provide/vod",
    enabled: true,
    note: "优先试用 · 动漫与电影",
  },
  {
    id: "jisu",
    name: "极速",
    url: "https://jszyapi.com/api.php/provide/vod",
    enabled: true,
    note: "备用来源 · 部分影片连接较慢",
  },
  {
    id: "360",
    name: "360",
    url: "https://360zy.com/api.php/provide/vod",
    enabled: true,
    note: "备用来源 · 支持标准加密 HLS",
  },
  {
    id: "wujin",
    name: "无尽",
    url: "https://api.wujinapi.me/api.php/provide/vod",
    enabled: false,
    note: "候选来源 · 部分样本通过",
  },
  {
    id: "ikun",
    name: "iKun",
    url: "https://ikunzyapi.com/api.php/provide/vod",
    enabled: false,
    note: "候选来源 · 需核对版本与完整性",
  },
  {
    id: "ruyi",
    name: "如意",
    url: "http://cj.rycjapi.com/api.php/provide/vod",
    enabled: false,
    note: "候选来源 · 部分样本通过",
  },
];

export function text(value: unknown, max = 1000): string {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .trim()
    .slice(0, max);
}
export function mediaUrl(value: unknown): string {
  try {
    const url = new URL(String(value));
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      (isIP(host) !== 0 && !isPublicAddress(host))
    )
      return "";
    return url.href;
  } catch {
    return "";
  }
}
export function movieKey(title: string, year: string): string {
  const normalized = normalizedTitle(title);
  return createHash("sha256")
    .update(`${normalized}|${year.slice(0, 4)}`)
    .digest("hex")
    .slice(0, 24);
}
export function episodeKey(
  name: string,
  index: number,
  series: boolean,
): string {
  const match =
    name.match(/(?:第\s*)?(\d{1,4})\s*(?:集|话|話|期)/) ??
    name.match(/^(\d{1,4})$/);
  if (match) return `episode:${Number(match[1])}`;
  if (!series) {
    if (/TC|抢先|预告|TS版/i.test(name)) return `preview:${name.trim()}`;
    if (/粤语/.test(name)) return "feature:cantonese";
    if (/国语|普通话/.test(name)) return "feature:mandarin";
    if (/4K/i.test(name)) return "feature:4k";
    return "feature";
  }
  return `label:${name.trim() || index}`;
}
export function parseMovie(
  raw: Record<string, unknown>,
  source: { id: string; name: string },
): Movie | null {
  const title = text(raw.vod_name, 180),
    id = text(raw.vod_id, 40);
  if (
    !id ||
    !title ||
    /电影解说|影视解说|预告片|幕后纪录|伦理片|伦理|福利姬/.test(
      title + text(raw.type_name),
    )
  )
    return null;
  const from = String(raw.vod_play_from ?? "").split("$$$");
  const lines: PlayLine[] = String(raw.vod_play_url ?? "")
    .split("$$$")
    .map((group, i) => {
      const rawEpisodes = group
        .split("#")
        .map((entry) => {
          const dollar = entry.indexOf("$");
          if (dollar < 0) return null;
          const name = text(entry.slice(0, dollar), 80),
            url = mediaUrl(entry.slice(dollar + 1));
          if (!url || !/\.(m3u8|mp4)(?:[?#]|$)/i.test(url)) return null;
          return { name, url };
        })
        .filter((item): item is { name: string; url: string } => item !== null);
      const series = rawEpisodes.some((ep) => /\d\s*[集话話期]/.test(ep.name));
      const keys = new Set<string>();
      const episodes: Episode[] = rawEpisodes.map((ep, index) => {
        const baseKey = episodeKey(ep.name, index, series),
          key = keys.has(baseKey) ? `${baseKey}:variant:${index}` : baseKey;
        keys.add(key);
        return {
          ...ep,
          index,
          key,
          quality: /TC|抢先|预告|TS版/i.test(ep.name) ? "preview" : "normal",
        };
      });
      episodes.sort(
        (a, b) =>
          Number(a.quality === "preview") - Number(b.quality === "preview"),
      );
      return { name: text(from[i] || `线路 ${i + 1}`, 50), episodes };
    })
    .filter((line) => line.episodes.length > 0);
  const year = text(raw.vod_year, 12);
  return {
    id,
    key: movieKey(title, year),
    source: source.id,
    sourceName: source.name,
    title,
    year,
    type: text(raw.type_name, 40),
    area: text(raw.vod_area, 40),
    language: text(raw.vod_lang, 60),
    poster: mediaUrl(raw.vod_pic),
    description: text(raw.vod_content || raw.vod_blurb, 3000),
    remarks: text(raw.vod_remarks, 80),
    score: text(raw.vod_douban_score || raw.vod_score, 10),
    director: text(raw.vod_director, 150),
    actors: text(raw.vod_actor, 350),
    lines,
    updated: text(raw.vod_time, 40),
  };
}
