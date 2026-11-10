import { db, getSources } from "./db";
import { querySource } from "./sources";
import { upgradeCatalogIndex } from "./catalog-index";

// Durable page checkpoints; one request per source at a time, including across workers.
export async function syncCatalogBatch(fetchPage = querySource) {
  await Promise.all(
    getSources()
      .filter((s) => s.enabled)
      .map(async (source) => {
        const conn = db(),
          now = Date.now();
        conn
          .prepare("INSERT OR IGNORE INTO catalog_sync(source_id) VALUES(?)")
          .run(source.id);
        const lease = conn
          .prepare(
            "UPDATE catalog_sync SET retry_at=? WHERE source_id=? AND retry_at<=?",
          )
          .run(now + 45000, source.id, now);
        if (!lease.changes) return;
        const state = conn
          .prepare(
            "SELECT next_page,completed FROM catalog_sync WHERE source_id=?",
          )
          .get(source.id) as { next_page: number; completed: number };
        try {
          const result = await fetchPage(source, {
            pg: String(state.next_page),
          });
          const complete = state.next_page >= result.pages;
          conn
            .prepare(
              "UPDATE catalog_sync SET next_page=?,pages=?,total=?,completed=?,updated=?,error='',retry_at=? WHERE source_id=?",
            )
            .run(
              complete ? 1 : state.next_page + 1,
              result.pages,
              result.total,
              complete ? now : state.completed,
              now,
              complete ? now + 6 * 3600000 : now + 1500,
              source.id,
            );
        } catch (e) {
          conn
            .prepare(
              "UPDATE catalog_sync SET error=?,retry_at=? WHERE source_id=?",
            )
            .run(
              e instanceof Error ? e.message : "同步失败",
              now + 60000,
              source.id,
            );
        }
      }),
  );
}
const runtime = globalThis as unknown as { catalogSyncStarted?: boolean };
export function startCatalogSync() {
  if (runtime.catalogSyncStarted || process.env.CATALOG_SYNC === "false")
    return;
  runtime.catalogSyncStarted = true;
  upgradeCatalogIndex();
  const run = async () => {
    try {
      await syncCatalogBatch();
    } catch (e) {
      console.error("Catalog sync:", e instanceof Error ? e.message : "failed");
    }
    setTimeout(run, 2000).unref();
  };
  setTimeout(run, 1000).unref();
}
