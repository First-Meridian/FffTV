import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { rmSync } from "node:fs";
import { db } from "../src/lib/db";
import { parseMovie, releaseDate, splitAreas } from "../src/lib/catalog";
import { groupMovies } from "../src/lib/grouping";
import {
  indexMovies,
  browseCatalog,
  indexedVariants,
} from "../src/lib/catalog-index";
import {
  currentSeason,
  parseSeasonEntry,
  matchesSeasonEntry,
} from "../src/lib/season";

const path = resolve(
  `data/catalog-test-${randomBytes(8).toString("hex")}.sqlite`,
);
process.env.DATABASE_PATH = path;
process.env.ADMIN_PASSWORD = randomBytes(24).toString("hex");
after(() => {
  db().close();
  for (const suffix of ["", "-wal", "-shm"])
    rmSync(path + suffix, { force: true });
});
const movie = (i: number, source = "modu", overrides = {}) =>
  parseMovie(
    {
      vod_id: i,
      vod_name: `片库测试${i}`,
      vod_year: "2026",
      type_name: "科幻片",
      vod_area: "大陆 / 美国",
      vod_class: "科幻,冒险",
      vod_pubdate: "2026-10-05(中国大陆)",
      vod_time: "2026-11-10 12:00:00",
      ...overrides,
    },
    { id: source, name: source },
  )!;

test("metadata uses premiere dates rather than the latest episode update", () => {
  const parsed = movie(1, "modu", {
    vod_pubdate: "2020年3月8日",
    vod_time: "2026-11-10",
    type_name: "国产动漫",
  });
  assert.equal(parsed.releaseDate, "2020-03-08");
  assert.equal(parsed.kind, "anime");
  assert.deepEqual(parsed.areas, ["中国大陆", "美国"]);
  assert.deepEqual(parsed.genres, ["科幻", "冒险"]);
  assert.equal(releaseDate("2026-02-30"), "");
  assert.equal(releaseDate("2026"), "");
  assert.deepEqual(
    splitAreas("\u200b德国,中国大陆6/暂无简介/普通话/印尼/港台"),
    ["德国", "中国大陆", "印度尼西亚", "中国香港", "中国台湾"],
  );
});
test("three providers and multiple editions occupy one work card", () => {
  const a = movie(1),
    b = movie(2, "jisu", { vod_name: a.title }),
    c = movie(3, "360", { vod_name: a.title });
  const grouped = groupMovies([a, b, c, b]);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].variants?.length, 3);
  assert.equal(groupMovies([...grouped, c])[0].variants?.length, 3);
  assert.equal(
    groupMovies([
      a,
      movie(1, "360", { vod_year: "2014" }),
      movie(1, "360", { type_name: "国产剧" }),
    ]).length,
    3,
  );
  assert.equal(
    groupMovies([
      movie(1, "modu", { vod_name: "新番第二季" }),
      movie(1, "jisu", { vod_name: "新番第三季" }),
    ]).length,
    2,
  );
});
test("language/year suffixes merge while sequel numbers and remake years remain distinct", () => {
  const base = movie(1, "modu", { vod_name: "归鹭" });
  assert.equal(
    groupMovies([
      base,
      movie(2, "jisu", { vod_name: "归鹭2026" }),
      movie(3, "360", { vod_name: "归鹭（国语版）" }),
    ]).length,
    1,
  );
  assert.equal(
    groupMovies([base, movie(4, "360", { vod_name: "归鹭2" })]).length,
    2,
  );
  assert.equal(movie(1, "modu", { vod_year: "22026" }).year, "2026");
  assert.equal(
    groupMovies([
      movie(1, "modu", { vod_name: "测试第二季" }),
      movie(1, "jisu", { vod_name: "测试 第2季" }),
    ]).length,
    1,
  );
});
test("pagination and totals operate on merged works, retaining all playback sources", () => {
  indexMovies(
    Array.from({ length: 30 }, (_, i) => [
      movie(i + 1),
      movie(i + 1, "jisu"),
      movie(i + 1, "360"),
    ]).flat(),
  );
  const first = browseCatalog({ page: 1 }),
    second = browseCatalog({ page: 2 });
  assert.equal(first.total, 30);
  assert.equal(first.pages, 2);
  assert.equal(first.movies.length, 24);
  assert.equal(second.movies.length, 6);
  assert.equal(
    new Set([...first.movies, ...second.movies].map((m) => m.key)).size,
    30,
  );
  assert.ok(first.movies.every((m) => m.variants?.length === 3));
  assert.deepEqual(
    browseCatalog({ page: 1 }).movies.map((m) => m.key),
    first.movies.map((m) => m.key),
  );
  assert.equal(browseCatalog({ page: 999 }).page, 2);
});
test("filtering supports year, region, genre, format and real release date across the full index", () => {
  assert.equal(
    browseCatalog({
      kind: "movie",
      year: "2026",
      area: "美国",
      genre: "科幻",
      from: "2026-10-01",
      to: "2026-10-31",
    }).total,
    30,
  );
  assert.equal(browseCatalog({ from: "2026-11-01" }).total, 0);
  assert.equal(browseCatalog({ kind: "anime" }).total, 0);
  assert.equal(browseCatalog({ q: "片库测试30" }).total, 1);
  assert.equal(browseCatalog({ q: "%" }).total, 0);
  assert.equal(browseCatalog({ q: "' OR 1=1 --" }).total, 0);
  assert.ok(browseCatalog({}).facets.areas.includes("中国大陆"));
});
test("disabled sources disappear from cards, variants and source filters", () => {
  db().prepare("UPDATE sources SET enabled=0 WHERE id='jisu'").run();
  assert.equal(browseCatalog({ source: "jisu" }).total, 0);
  assert.ok(browseCatalog({}).movies.every((m) => m.variants?.length === 2));
  assert.equal(indexedVariants(movie(1)).length, 2);
  db().prepare("UPDATE sources SET enabled=1 WHERE id='jisu'").run();
  // A source filter chooses works, while their other enabled variants remain available.
  assert.equal(browseCatalog({ source: "jisu" }).movies[0].variants?.length, 3);
});
test("upserts are idempotent and newly supplied premiere data changes filtering", () => {
  indexMovies([
    movie(30, "modu", { vod_pubdate: "2025-04-01", vod_year: "2025" }),
  ]);
  indexMovies([
    movie(30, "modu", { vod_pubdate: "2025-04-01", vod_year: "2025" }),
  ]);
  assert.equal(browseCatalog({ year: "2025" }).total, 1);
  assert.equal(browseCatalog({ year: "2025" }).movies[0].variants?.length, 1);
  assert.equal(browseCatalog({ year: "2026" }).total, 30);
});
test("quarter calculation uses Shanghai time at quarter and year boundaries", () => {
  assert.deepEqual(currentSeason(new Date("2026-09-30T15:59:59Z")), {
    year: 2026,
    quarter: 3,
    start: "2026-07-01",
    end: "2026-10-01",
    label: "2026 年 · 夏季新番",
  });
  assert.equal(currentSeason(new Date("2026-09-30T16:00:00Z")).quarter, 4);
  assert.equal(currentSeason(new Date("2026-12-31T16:00:00Z")).year, 2027);
});
test("season listing includes upcoming TV/WEB premieres but excludes carryovers and films", () => {
  const raw = {
    id: 123,
    type: 2,
    name: "New Anime",
    name_cn: "本季新番",
    platform: "TV",
    date: "2026-12-31",
    nsfw: false,
    infobox: [{ key: "别名", value: [{ v: "本季动画" }] }],
  };
  const entry = parseSeasonEntry(raw, "2026-10-01", "2027-01-01")!;
  assert.equal(entry.title, "本季新番");
  assert.ok(entry.aliases.includes("本季动画"));
  for (const delta of [
    { date: "2026-09-30" },
    { date: "2027-01-01" },
    { platform: "剧场版" },
    { platform: "OVA" },
    { nsfw: true },
  ])
    assert.equal(
      parseSeasonEntry({ ...raw, ...delta }, "2026-10-01", "2027-01-01"),
      null,
    );
  assert.equal(
    matchesSeasonEntry(
      entry,
      movie(1, "modu", { vod_name: "本季动画", type_name: "日韩动漫" }),
    ),
    true,
  );
  assert.equal(
    matchesSeasonEntry(
      entry,
      movie(1, "modu", { vod_name: "本季动画第二季", type_name: "日韩动漫" }),
    ),
    false,
  );
  assert.equal(
    matchesSeasonEntry(
      entry,
      movie(1, "modu", {
        vod_name: "本季动画",
        type_name: "日韩动漫",
        vod_year: "2025",
      }),
    ),
    false,
  );
});

test("year-only dates overlap the requested period and unknown years stay out of date filters", () => {
  indexMovies([
    movie(500, "modu", { vod_year: "2024", vod_pubdate: "" }),
    movie(501, "modu", { vod_year: "未知", vod_pubdate: "" }),
  ]);
  assert.equal(
    browseCatalog({ from: "2024-04-01", to: "2024-06-30" }).total,
    1,
  );
  assert.equal(browseCatalog({ to: "2024-12-31" }).total, 1);
});

test("catalog sync resumes durable checkpoints, retains failures and waits after completion", async () => {
  const { syncCatalogBatch } = await import("../src/lib/catalog-sync");
  db().prepare("UPDATE sources SET enabled=0 WHERE id<>'modu'").run();
  const pages: string[] = [];
  const fetchPage = async (
    _source: unknown,
    params: Record<string, string>,
  ) => {
    pages.push(params.pg);
    return { movies: [], page: Number(params.pg), pages: 2, total: 40 };
  };
  await syncCatalogBatch(fetchPage);
  assert.equal(
    (
      db()
        .prepare("SELECT next_page FROM catalog_sync WHERE source_id='modu'")
        .get() as { next_page: number }
    ).next_page,
    2,
  );
  await syncCatalogBatch(fetchPage);
  assert.deepEqual(pages, ["1"]);
  db()
    .prepare("UPDATE catalog_sync SET retry_at=0 WHERE source_id='modu'")
    .run();
  await syncCatalogBatch(async () => {
    throw new Error("test offline");
  });
  const failed = db()
    .prepare("SELECT next_page,error FROM catalog_sync WHERE source_id='modu'")
    .get() as { next_page: number; error: string };
  assert.equal(failed.next_page, 2);
  assert.equal(failed.error, "test offline");
  db()
    .prepare("UPDATE catalog_sync SET retry_at=0 WHERE source_id='modu'")
    .run();
  await syncCatalogBatch(fetchPage);
  const done = db()
    .prepare(
      "SELECT next_page,completed,retry_at,error FROM catalog_sync WHERE source_id='modu'",
    )
    .get() as {
    next_page: number;
    completed: number;
    retry_at: number;
    error: string;
  };
  assert.deepEqual(pages, ["1", "2"]);
  assert.equal(done.next_page, 1);
  assert.ok(done.completed > 0);
  assert.ok(done.retry_at > Date.now() + 5 * 3600000);
  assert.equal(done.error, "");
});
