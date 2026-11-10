import { db, getSources } from "./db";
import {
  movieKind,
  movieKey,
  normalizedYear,
  normalizedGenres,
  splitAreas,
} from "./catalog";
import { groupMovies, workKey } from "./grouping";
import { normalizedTitle } from "./identity";
import type { CatalogResult, CatalogSync, Movie } from "./types";

export function indexMovies(movies: Movie[]) {
  const conn = db();
  const put =
    conn.prepare(`INSERT INTO catalog_entries(source_id,id,work_key,title,year,kind,areas,genres,release_date,updated,movie_json)
    VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(source_id,id) DO UPDATE SET work_key=excluded.work_key,title=excluded.title,year=excluded.year,kind=excluded.kind,areas=excluded.areas,genres=excluded.genres,release_date=excluded.release_date,updated=excluded.updated,movie_json=excluded.movie_json`);
  conn.exec("BEGIN IMMEDIATE");
  try {
    for (const original of movies) {
      const year = normalizedYear(original.year, original.releaseDate),
        movie = {
          ...original,
          year,
          key: movieKey(original.title, year),
          genres: normalizedGenres(
            (original.genres || []).join(",") + "," + original.type,
          ),
          areas: splitAreas(original.area),
        };
      const clean = { ...movie, lines: [], variants: undefined };
      put.run(
        movie.source,
        movie.id,
        workKey(movie),
        normalizedTitle(movie.title),
        movie.year.slice(0, 4),
        movie.kind || movieKind(movie.type),
        JSON.stringify(movie.areas || []),
        JSON.stringify(movie.genres || []),
        movie.releaseDate || "",
        movie.updated,
        JSON.stringify(clean),
      );
    }
    conn.exec("COMMIT");
  } catch (e) {
    conn.exec("ROLLBACK");
    throw e;
  }
}
export function upgradeCatalogIndex() {
  const version = "catalog-index:v3";
  if (db().prepare("SELECT key FROM metadata_cache WHERE key=?").get(version))
    return;
  const movies = (
    db().prepare("SELECT movie_json FROM catalog_entries").all() as {
      movie_json: string;
    }[]
  ).map((row) => JSON.parse(row.movie_json) as Movie);
  indexMovies(movies);
  db()
    .prepare(
      "INSERT OR IGNORE INTO metadata_cache(key,json,updated) VALUES(?,'{}',?)",
    )
    .run(version, Date.now());
}
export function indexedVariants(movie: Movie): Movie[] {
  return (
    db()
      .prepare(
        `SELECT e.movie_json FROM catalog_entries e JOIN sources s ON s.id=e.source_id AND s.enabled=1 WHERE e.work_key=? ORDER BY e.source_id,e.id`,
      )
      .all(workKey(movie)) as { movie_json: string }[]
  ).map((r) => JSON.parse(r.movie_json));
}
export function syncStatus(): CatalogSync[] {
  return getSources()
    .filter((s) => s.enabled)
    .map((source) => {
      const row = db()
        .prepare("SELECT * FROM catalog_sync WHERE source_id=?")
        .get(source.id) as
        | {
            next_page: number;
            pages: number;
            total: number;
            completed: number;
            updated: number;
            error: string;
          }
        | undefined;
      const count = db()
        .prepare("SELECT COUNT(*) AS n FROM catalog_entries WHERE source_id=?")
        .get(source.id) as { n: number };
      return {
        id: source.id,
        name: source.name,
        nextPage: row?.next_page || 1,
        pages: row?.pages || 0,
        total: row?.total || 0,
        indexed: count.n,
        completed: row?.completed || 0,
        updated: row?.updated || 0,
        error: row?.error || "",
      };
    });
}
export type CatalogFilters = {
  q?: string;
  kind?: string;
  year?: string;
  area?: string;
  genre?: string;
  from?: string;
  to?: string;
  source?: string;
  sort?: string;
  page?: number;
};
export function browseCatalog(filters: CatalogFilters): CatalogResult {
  const conn = db(),
    values: string[] = [],
    clauses = ["s.enabled=1"];
  const add = (sql: string, value?: string) => {
    if (value) {
      clauses.push(sql);
      values.push(value);
    }
  };
  add(
    "e.title LIKE ? ESCAPE '\\'",
    filters.q
      ? `%${normalizedTitle(filters.q).replace(/[\\%_]/g, "\\$&")}%`
      : "",
  );
  add("e.kind=?", filters.kind);
  add("e.year=?", filters.year);
  add("EXISTS (SELECT 1 FROM json_each(e.areas) WHERE value=?)", filters.area);
  add(
    "EXISTS (SELECT 1 FROM json_each(e.genres) WHERE value=?)",
    filters.genre,
  );
  if (filters.from || filters.to)
    clauses.push("(e.release_date<>'' OR e.year<>'')");
  add(
    "COALESCE(NULLIF(e.release_date,''),e.year || '-12-31')>=?",
    filters.from,
  );
  add("COALESCE(NULLIF(e.release_date,''),e.year || '-01-01')<=?", filters.to);
  add("e.source_id=?", filters.source);
  const from = `FROM catalog_entries e JOIN sources s ON s.id=e.source_id WHERE ${clauses.join(" AND ")}`;
  const total = (
    conn
      .prepare(`SELECT COUNT(DISTINCT work_key) AS n ${from}`)
      .get(...values) as { n: number }
  ).n;
  const pageSize = 24,
    pages = Math.ceil(total / pageSize),
    page = Math.max(1, Math.min(pages || 1, Math.floor(filters.page || 1)));
  const order =
    filters.sort === "title"
      ? "MIN(e.title) ASC"
      : filters.sort === "updated"
        ? "MAX(e.updated) DESC"
        : "MAX(COALESCE(NULLIF(e.release_date,''),e.year || '-01-01')) DESC";
  const keys = (
    conn
      .prepare(
        `SELECT work_key ${from} GROUP BY work_key ORDER BY ${order},work_key ASC LIMIT ? OFFSET ?`,
      )
      .all(...values, pageSize, (page - 1) * pageSize) as { work_key: string }[]
  ).map((row) => row.work_key);
  const movies: Movie[] = keys.length
    ? (
        conn
          .prepare(
            `SELECT e.movie_json FROM catalog_entries e JOIN sources s ON s.id=e.source_id AND s.enabled=1 WHERE e.work_key IN (${keys.map(() => "?").join(",")}) ORDER BY e.source_id,e.id`,
          )
          .all(...keys) as { movie_json: string }[]
      ).map((row) => JSON.parse(row.movie_json))
    : [];
  const grouped = groupMovies(movies),
    ordered = keys
      .map((key) => grouped.find((movie) => workKey(movie) === key)!)
      .filter(Boolean);
  const years = (
    conn
      .prepare(
        "SELECT DISTINCT year FROM catalog_entries e JOIN sources s ON s.id=e.source_id AND s.enabled=1 WHERE year<>'' ORDER BY year DESC",
      )
      .all() as { year: string }[]
  ).map((r) => r.year);
  const facet = (field: "areas" | "genres") =>
    (
      conn
        .prepare(
          `SELECT DISTINCT j.value AS value FROM catalog_entries e JOIN sources s ON s.id=e.source_id AND s.enabled=1, json_each(e.${field}) j ORDER BY j.value`,
        )
        .all() as { value: string }[]
    ).map((r) => r.value);
  return {
    movies: ordered,
    total,
    page,
    pages,
    pageSize,
    facets: { years, areas: facet("areas"), genres: facet("genres") },
    sync: syncStatus(),
  };
}
