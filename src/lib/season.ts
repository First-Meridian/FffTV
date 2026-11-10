import { db } from "./db";
import { fetchCatalog } from "./network";
import { mediaUrl, text } from "./catalog";
import { normalizedTitle } from "./identity";
import type { SeasonEntry, SeasonResult, Movie } from "./types";

export function currentSeason(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")!.value),
    month = Number(parts.find((p) => p.type === "month")!.value);
  const quarter = Math.ceil(month / 3),
    start = `${year}-${String((quarter - 1) * 3 + 1).padStart(2, "0")}-01`,
    end =
      quarter === 4
        ? `${year + 1}-01-01`
        : `${year}-${String(quarter * 3 + 1).padStart(2, "0")}-01`;
  return {
    year,
    quarter,
    start,
    end,
    label: `${year} 年 · ${["冬", "春", "夏", "秋"][quarter - 1]}季新番`,
  };
}
export function parseSeasonEntry(
  raw: Record<string, unknown>,
  start: string,
  end: string,
): SeasonEntry | null {
  const date = text(raw.date, 10),
    platform = text(raw.platform, 20);
  if (
    raw.nsfw === true ||
    Number(raw.type) !== 2 ||
    !["TV", "WEB"].includes(platform) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    date < start ||
    date >= end
  )
    return null;
  const originalTitle = text(raw.name, 180),
    title = text(raw.name_cn, 180) || originalTitle;
  const tags = Array.isArray(raw.meta_tags) ? raw.meta_tags : [];
  if (
    tags.some((tag) =>
      ["MV", "PV", "广告", "音乐视频"].includes(String(tag)),
    ) ||
    /2DMV|(?:\bMV\b)|宣传片|特别剧情短片/i.test(`${title} ${originalTitle}`)
  )
    return null;
  if (!title || !Number.isSafeInteger(raw.id) || Number(raw.id) <= 0)
    return null;
  const aliases: string[] = [title, originalTitle];
  if (Array.isArray(raw.infobox))
    for (const entry of raw.infobox) {
      if (entry?.key === "别名" && Array.isArray(entry.value))
        for (const alias of entry.value)
          if (alias?.v) aliases.push(text(alias.v, 180));
    }
  const images = raw.images as Record<string, unknown> | undefined;
  return {
    id: Number(raw.id),
    title,
    originalTitle,
    aliases: [...new Set(aliases.filter(Boolean))],
    date,
    platform,
    poster: mediaUrl(images?.common || raw.image),
    description: text(raw.summary, 3000),
  };
}
export function matchesSeasonEntry(entry: SeasonEntry, movie: Movie): boolean {
  return (
    movie.year.slice(0, 4) === entry.date.slice(0, 4) &&
    (movie.kind === "anime" || /动漫/.test(movie.type)) &&
    entry.aliases.some(
      (alias) =>
        normalizedTitle(alias, movie.year) ===
        normalizedTitle(movie.title, movie.year),
    )
  );
}
let pending: Promise<SeasonResult> | undefined;
export async function getSeason(): Promise<SeasonResult> {
  const season = currentSeason(),
    key = `season:v2:${season.year}:${season.quarter}`;
  const saved = db()
    .prepare("SELECT json,updated FROM metadata_cache WHERE key=?")
    .get(key) as { json: string; updated: number } | undefined;
  if (saved && saved.updated > Date.now() - 12 * 3600000)
    return JSON.parse(saved.json);
  if (pending) return pending;
  pending = (async () => {
    try {
      const entries = new Map<number, SeasonEntry>();
      for (let offset = 0; ; offset += 100) {
        if (offset >= 2000)
          throw new Error("季度目录超出读取上限，名单暂未完整更新");
        const result = await fetchCatalog(
          new URL(
            `https://api.bgm.tv/v0/search/subjects?limit=100&offset=${offset}`,
          ),
          {
            keyword: "",
            sort: "rank",
            filter: {
              type: [2],
              air_date: [`>=${season.start}`, `<${season.end}`],
              nsfw: false,
            },
          },
        );
        if (
          !Array.isArray(result.data) ||
          !Number.isFinite(Number(result.total))
        )
          throw new Error("新番目录返回的数据不完整");
        for (const raw of result.data) {
          const entry = parseSeasonEntry(raw, season.start, season.end);
          if (entry) entries.set(entry.id, entry);
        }
        if (offset + result.data.length >= Number(result.total)) break;
        if (!result.data.length)
          throw new Error("新番目录分页未完成，请稍后重试");
      }
      const data: SeasonResult = {
        year: season.year,
        quarter: season.quarter,
        label: season.label,
        entries: [...entries.values()].sort(
          (a, b) => a.date.localeCompare(b.date) || a.id - b.id,
        ),
        updated: Date.now(),
      };
      db()
        .prepare(
          "INSERT INTO metadata_cache(key,json,updated) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET json=excluded.json,updated=excluded.updated",
        )
        .run(key, JSON.stringify(data), data.updated);
      return data;
    } catch (e) {
      if (saved)
        return {
          ...JSON.parse(saved.json),
          stale: true,
          error: "新番目录更新失败，正在展示上次保存的本季名单。",
        };
      throw e;
    }
  })();
  try {
    return await pending;
  } finally {
    pending = undefined;
  }
}
