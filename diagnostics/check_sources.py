"""Read-only, bounded public VOD checks; never executes source-provided code."""
import argparse
import concurrent.futures
import datetime
import json
import pathlib
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT / "results"
CONFIG = "https://raw.githubusercontent.com/aahl/MoonTV/main/config.json"
HEADERS = {"User-Agent": "FffTV-CompatibilityCheck/0.1", "Accept": "application/json"}
QUERIES = ["葬送的芙莉莲", "咒术回战", "哪吒之魔童闹海", "疯狂动物城2", "星际穿越", "肖申克的救赎", "千与千寻", "星际牛仔"]


def fetch_json(url):
    start = time.monotonic()
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15) as response:
            content = response.read(4_000_001)
            if len(content) > 4_000_000:
                raise ValueError("response exceeds 4MB limit")
            result = {"url": url, "final_url": response.url, "status": response.status,
                      "cors": response.headers.get("Access-Control-Allow-Origin"),
                      "content_type": response.headers.get("Content-Type"),
                      "data": json.loads(content.decode("utf-8-sig"))}
    except Exception as exc:
        result = {"url": url, "error": str(exc)}
    result["elapsed_ms"] = round((time.monotonic() - start) * 1000)
    return result


def search(base, keyword):
    return fetch_json(base.rstrip("/") + "/?" + urllib.parse.urlencode({"ac": "detail", "wd": keyword}))


def compact_item(item):
    fields = ["vod_id", "vod_name", "vod_year", "vod_remarks", "vod_time", "type_name", "vod_lang", "vod_area", "vod_play_from", "vod_play_url"]
    return {key: item.get(key) for key in fields}


def summarize_response(response):
    data = response.pop("data", None)
    if isinstance(data, dict):
        response.update({"code": data.get("code"), "message": data.get("msg"), "total": data.get("total"),
                         "items": [compact_item(item) for item in data.get("list", []) if isinstance(item, dict)]})
    elif data is not None:
        response["error"] = "Unexpected JSON structure"
    return response


def run_source(key, source, queries):
    results = []
    for keyword in queries:
        response = summarize_response(search(source["api"], keyword))
        response["query"] = keyword
        results.append(response)
        print(json.dumps({"source": source["name"], "query": keyword, "status": response.get("status"),
                          "count": len(response.get("items", [])), "ms": response["elapsed_ms"],
                          "error": response.get("error")}, ensure_ascii=False), flush=True)
        time.sleep(0.35)
    return {"key": key, **source, "queries": results}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["screen", "matrix", "recent"])
    parser.add_argument("--sources", default="")
    args = parser.parse_args()
    OUT.mkdir(exist_ok=True)
    if args.mode == "screen":
        config = fetch_json(CONFIG)
        if "data" not in config:
            raise SystemExit(json.dumps(config))
        (OUT / "source-config.json").write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")
        sources = config["data"]["api_site"]
        queries = [QUERIES[0]]
    else:
        sources = json.loads((OUT / "source-config.json").read_text(encoding="utf-8"))["data"]["api_site"]
        wanted = args.sources.split(",")
        sources = {key: value for key, value in sources.items() if key in wanted}
        queries = ["飞驰人生3", "挽救计划"] if args.mode == "recent" else QUERIES
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        jobs = [pool.submit(run_source, key, value, queries) for key, value in sources.items()]
        for job in concurrent.futures.as_completed(jobs):
            results.append(job.result())
    report = {"checked_at": datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat(),
              "config_reference": CONFIG, "sources": results}
    (OUT / f"{args.mode}.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Saved", OUT / f"{args.mode}.json")


if __name__ == "__main__":
    main()
