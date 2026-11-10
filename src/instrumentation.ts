export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    const { startCatalogSync } = await import("./lib/catalog-sync");
    startCatalogSync();
  }
}
