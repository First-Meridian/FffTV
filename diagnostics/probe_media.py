"""Bounded playlist/segment probes. Does not download complete episodes."""
import argparse
import concurrent.futures
import datetime
import ipaddress
import json
import pathlib
import re
import socket
import time
import urllib.parse
import urllib.request
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT / "results"
ORIGIN = "http://127.0.0.1:8765"


def public_url(url):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username:
        raise ValueError("Only public HTTP(S) URLs are allowed")
    addresses = socket.getaddrinfo(parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM)
    if any(not ipaddress.ip_address(entry[4][0]).is_global for entry in addresses):
        raise ValueError("Non-public destination rejected")


class PublicRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        public_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def get(url, cap, ranged=False):
    public_url(url)
    headers = {"User-Agent": "FffTV-CompatibilityCheck/0.1", "Origin": ORIGIN}
    if ranged:
        headers["Range"] = f"bytes=0-{cap-1}"
    start = time.monotonic()
    with urllib.request.build_opener(PublicRedirect()).open(urllib.request.Request(url, headers=headers), timeout=12) as response:
        content = response.read(cap)
        return content, {"url": url, "final_url": response.url, "status": response.status,
                         "type": response.headers.get("Content-Type"),
                         "cors": response.headers.get("Access-Control-Allow-Origin"),
                         "bytes_read": len(content), "elapsed_ms": round((time.monotonic()-start)*1000)}


def kind(content):
    if content.startswith(b"#EXTM3U"):
        return "hls"
    if any(content[offset:offset+1] == b"G" and content[offset+188:offset+189] == b"G" and content[offset+376:offset+377] == b"G" for offset in range(min(188, len(content)-376))):
        return "mpeg-ts"
    if any(marker in content[:64] for marker in (b"ftyp", b"moof", b"styp", b"moov")):
        return "mp4"
    if content.lstrip().lower().startswith((b"<!doctype", b"<html")):
        return "html"
    return "unknown"


def episodes(item):
    groups = str(item.get("vod_play_url") or "").split("$$$")
    names = str(item.get("vod_play_from") or "").split("$$$")
    for index, group in enumerate(groups):
        entries = []
        for entry in group.split("#"):
            if "$" not in entry:
                continue
            label, url = entry.split("$", 1)
            if re.search(r"\.m3u8(?:[?#]|$)", url, re.I):
                entries.append({"label": label, "url": url})
        if entries:
            return names[index] if index < len(names) else "", entries
    return "", []


def select_item(query):
    keyword = query["query"]
    candidates = []
    for item in query.get("items", []):
        title = re.sub(r"\s+", "", item.get("vod_name") or "")
        if keyword not in title or any(word in title for word in ("解说", "纪录", "幕后", "中的科学", "总集")):
            continue
        if keyword == "葬送的芙莉莲" and "第二季" not in title:
            continue
        if keyword == "咒术回战" and "第三季" not in title:
            continue
        if keyword == "星际牛仔" and str(item.get("vod_year")) != "1998":
            continue
        candidates.append(item)
    candidates.sort(key=lambda item: (len(item.get("vod_name") or ""), str(item.get("vod_id"))))
    return candidates[0] if candidates else None


def probe(url):
    report = {"entry_url": url, "playlists": [], "segments": []}
    try:
        for _ in range(4):
            content, meta = get(url, 2_000_000)
            meta["kind"] = kind(content)
            report["playlists"].append(meta)
            if meta["kind"] != "hls":
                raise ValueError("Not an HLS playlist: " + meta["kind"])
            text = content.decode("utf-8-sig")
            lines = [line.strip() for line in text.splitlines() if line.strip()]
            uris = [line for line in lines if not line.startswith("#")]
            if not uris:
                raise ValueError("Empty playlist")
            base = meta["final_url"]
            if "#EXT-X-STREAM-INF:" in text:
                url = urllib.parse.urljoin(base, uris[0])
                continue
            report["duration_seconds"] = round(sum(float(value) for value in re.findall(r"#EXTINF:([\d.]+)", text)), 2)
            report["segment_count"] = len(uris)
            report["endlist"] = "#EXT-X-ENDLIST" in text
            report["encryption"] = re.findall(r"#EXT-X-KEY:METHOD=([^,\r\n]+)", text)
            report["map"] = re.findall(r'#EXT-X-MAP:URI="([^"]+)"', text)
            sequence_match = re.search(r"#EXT-X-MEDIA-SEQUENCE:(\d+)", text)
            media_sequence = int(sequence_match.group(1)) if sequence_match else 0
            active_key = None
            segment_keys = []
            for line in lines:
                if line.startswith("#EXT-X-KEY:"):
                    active_key = dict((key, val.strip('"')) for key, val in re.findall(r'(\w+)=("[^"]*"|[^,]+)', line))
                elif not line.startswith("#"):
                    segment_keys.append(active_key)
            report["keys"] = []
            for index in sorted(set([0, len(uris)//2])):
                segment_url = urllib.parse.urljoin(base, uris[index])
                fragment, segment_meta = get(segment_url, 65536, True)
                segment_meta.update({"index": index, "kind": kind(fragment)})
                key_spec = segment_keys[index]
                if key_spec and key_spec.get("METHOD") == "AES-128":
                    key_url = urllib.parse.urljoin(base, key_spec["URI"])
                    key_bytes, key_meta = get(key_url, 17)
                    report["keys"].append(key_meta)
                    if len(key_bytes) != 16:
                        raise ValueError("Invalid standard HLS AES-128 key length")
                    iv = int(key_spec.get("IV", str(media_sequence + index)), 0).to_bytes(16, "big")
                    decryptor = Cipher(algorithms.AES(key_bytes), modes.CBC(iv)).decryptor()
                    plaintext = decryptor.update(fragment[:len(fragment)//16*16])
                    segment_meta["kind"] = kind(plaintext)
                    segment_meta["standard_hls_decryption"] = "AES-128"
                report["segments"].append(segment_meta)
            report["media_ok"] = all(segment["kind"] in ("mpeg-ts", "mp4") for segment in report["segments"])
            report["cors_ok"] = all(meta.get("cors") in ("*", ORIGIN) for meta in report["playlists"] + report["segments"] + report["keys"])
            return report
        raise ValueError("Playlist nesting exceeded")
    except Exception as exc:
        report["error"] = str(exc)
        report["media_ok"] = False
        return report


def check_source(source, last_episode=False):
    checks = []
    for query in source["queries"]:
        item = select_item(query)
        check = {"source_key": source["key"], "source_name": source["name"], "query": query["query"],
                 "search_ms": query["elapsed_ms"], "search_error": query.get("error")}
        if item:
            line, items = episodes(item)
            check.update({"title": item["vod_name"], "year": item["vod_year"], "id": item["vod_id"],
                          "remarks": item["vod_remarks"], "line": line, "episode_count": len(items)})
            if items:
                entry = items[-1] if last_episode else items[0]
                check["episode"] = entry["label"]
                check["probe"] = probe(entry["url"])
            else:
                check["error"] = "No direct HLS URL"
        else:
            check["error"] = "No matching title/year/season in response"
        checks.append(check)
        print(json.dumps({"source": source["name"], "query": query["query"], "title": check.get("title"),
                          "episode": check.get("episode"), "ok": check.get("probe", {}).get("media_ok", False),
                          "cors": check.get("probe", {}).get("cors_ok"),
                          "error": check.get("error") or check.get("probe", {}).get("error")}, ensure_ascii=False), flush=True)
        time.sleep(0.2)
    return checks


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sources", default="ffzy,dyttzy,jisu,mdzy,zuid,wujin,ruyi,zy360,ikun")
    parser.add_argument("--last-episode", action="store_true")
    parser.add_argument("--queries", default="")
    parser.add_argument("--output", default="")
    args = parser.parse_args()
    sources = {}
    for filename in ("matrix.json", "recent.json"):
        for source in json.loads((OUT / filename).read_text(encoding="utf-8"))["sources"]:
            if source["key"] not in args.sources.split(","):
                continue
            if source["key"] not in sources:
                sources[source["key"]] = {**source, "queries": []}
            sources[source["key"]]["queries"].extend(source["queries"])
    if args.last_episode:
        for source in sources.values():
            source["queries"] = [query for query in source["queries"] if query["query"] in ("葬送的芙莉莲", "咒术回战", "星际牛仔")]
    if args.queries:
        for source in sources.values():
            source["queries"] = [query for query in source["queries"] if query["query"] in args.queries.split(",")]
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        for checks in pool.map(lambda source: check_source(source, args.last_episode), sources.values()):
            results.extend(checks)
    report = {"checked_at": datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat(),
              "origin": ORIGIN, "checks": results}
    suffix = args.output or ("last-episodes" if args.last_episode else "media")
    (OUT / f"{suffix}.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Saved", OUT / f"{suffix}.json", flush=True)


if __name__ == "__main__":
    main()
