import { getSources } from "./db";
import { parseMovie } from "./catalog";
import { fetchCatalog } from "./network";
import type { Movie, SearchResult, Source } from "./types";

const cache = new Map<string, { expires: number; movies: Movie[] }>();
const pending = new Map<string, Promise<Movie[]>>();
export function clearSourceCache() {
  cache.clear();
}
async function query(
  source: Source,
  parameters: Record<string, string>,
): Promise<Movie[]> {
  const url = new URL(source.url.replace(/\/$/, "") + "/");
  Object.entries({ ac: "detail", ...parameters }).forEach(([key, value]) =>
    url.searchParams.set(key, value),
  );
  const key = url.href,
    cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.movies;
  if (pending.has(key)) return pending.get(key)!;
  const promise = (async () => {
    const data = await fetchCatalog(url);
    if (!Array.isArray(data.list)) throw new Error("来源返回的数据格式不兼容");
    const movies = data.list
      .slice(0, 50)
      .map((raw) => parseMovie(raw, source))
      .filter((movie): movie is Movie => movie !== null);
    if (cache.size >= 300) cache.delete(cache.keys().next().value!);
    cache.set(key, { expires: Date.now() + 5 * 60000, movies });
    for (const movie of movies) {
      const detailUrl = new URL(source.url.replace(/\/$/, "") + "/");
      detailUrl.searchParams.set("ac", "detail");
      detailUrl.searchParams.set("ids", movie.id);
      if (cache.size >= 300) cache.delete(cache.keys().next().value!);
      cache.set(detailUrl.href, {
        expires: Date.now() + 5 * 60000,
        movies: [movie],
      });
    }
    return movies;
  })();
  pending.set(key, promise);
  try {
    return await promise;
  } finally {
    pending.delete(key);
  }
}
export async function searchCatalog(
  keyword: string,
  sourceId?: string,
): Promise<SearchResult> {
  const sources = getSources().filter(
    (source) => source.enabled && (!sourceId || source.id === sourceId),
  );
  const results = await Promise.all(
    sources.map(async (source) => {
      const start = Date.now();
      try {
        const movies = await query(
          source,
          keyword ? { wd: keyword } : { pg: "1" },
        );
        return {
          movies,
          status: {
            id: source.id,
            name: source.name,
            count: movies.length,
            elapsed: Date.now() - start,
          },
        };
      } catch (error) {
        return {
          movies: [],
          status: {
            id: source.id,
            name: source.name,
            count: 0,
            elapsed: Date.now() - start,
            error: error instanceof Error ? error.message : "来源暂时无法连接",
          },
        };
      }
    }),
  );
  return {
    movies: results.flatMap((result) => result.movies),
    sources: results.map((result) => result.status),
  };
}
export async function getMovie(
  sourceId: string,
  id: string,
): Promise<Movie | null> {
  const source = getSources().find(
    (source) => source.id === sourceId && source.enabled,
  );
  if (!source) throw new Error("该来源已停用，请切换其他来源");
  if (!/^[\w-]{1,40}$/.test(id)) throw new Error("影片编号无效");
  return (
    (await query(source, { ids: id })).find((movie) => movie.id === id) ?? null
  );
}
