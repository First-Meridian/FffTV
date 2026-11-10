import { getSources } from "./db";
import { parseMovie } from "./catalog";
import { fetchCatalog } from "./network";
import type { Movie, SearchResult, Source } from "./types";
import { indexMovies } from "./catalog-index";
import { groupMovies } from "./grouping";

type SourcePage = {
  movies: Movie[];
  page: number;
  pages: number;
  total: number;
};
const cache = new Map<string, { expires: number; data: SourcePage }>();
const pending = new Map<string, Promise<SourcePage>>();
export function clearSourceCache() {
  cache.clear();
}
export async function querySource(
  source: Source,
  parameters: Record<string, string>,
): Promise<SourcePage> {
  const url = new URL(source.url.replace(/\/$/, "") + "/");
  Object.entries({ ac: "detail", ...parameters }).forEach(([key, value]) =>
    url.searchParams.set(key, value),
  );
  const key = url.href,
    cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.data;
  if (pending.has(key)) return pending.get(key)!;
  const promise = (async () => {
    const data = await fetchCatalog(url);
    if (!Array.isArray(data.list)) throw new Error("来源返回的数据格式不兼容");
    const movies = data.list
      .map((raw) => parseMovie(raw, source))
      .filter((movie): movie is Movie => movie !== null);
    if (cache.size >= 300) cache.delete(cache.keys().next().value!);
    const result = {
      movies,
      page: Math.max(1, Number(data.page) || Number(parameters.pg) || 1),
      pages: Math.max(1, Number(data.pagecount) || 1),
      total: Math.max(0, Number(data.total) || movies.length),
    };
    indexMovies(movies);
    cache.set(key, { expires: Date.now() + 5 * 60000, data: result });
    for (const movie of movies) {
      const detailUrl = new URL(source.url.replace(/\/$/, "") + "/");
      detailUrl.searchParams.set("ac", "detail");
      detailUrl.searchParams.set("ids", movie.id);
      if (cache.size >= 300) cache.delete(cache.keys().next().value!);
      cache.set(detailUrl.href, {
        expires: Date.now() + 5 * 60000,
        data: { movies: [movie], page: 1, pages: 1, total: 1 },
      });
    }
    return result;
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
  page = 1,
): Promise<SearchResult> {
  const sources = getSources().filter(
    (source) => source.enabled && (!sourceId || source.id === sourceId),
  );
  const results = await Promise.all(
    sources.map(async (source) => {
      const start = Date.now();
      try {
        const data = await querySource(source, {
          pg: String(page),
          ...(keyword ? { wd: keyword } : {}),
        });
        const { movies } = data;
        return {
          movies,
          status: {
            id: source.id,
            name: source.name,
            count: movies.length,
            elapsed: Date.now() - start,
            page: data.page,
            pages: data.pages,
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
    movies: groupMovies(results.flatMap((result) => result.movies)),
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
    (await querySource(source, { ids: id })).movies.find(
      (movie) => movie.id === id,
    ) ?? null
  );
}
