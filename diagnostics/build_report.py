"""Render the saved observations; this script does not contact any source."""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT / "results"


def load(name):
    return json.loads((OUT / name).read_text(encoding="utf-8"))


def main():
    screen = load("screen.json")
    media = load("media.json")["checks"]
    supplemental = load("encrypted-media.json")["checks"]
    last = load("last-episodes.json")["checks"]
    browser = load("browser.json") if (OUT / "browser.json").exists() else []
    lines = [
        "# FffTV 公开播放来源实测", "", "测试日期：2026-11-10（Asia/Shanghai）。", "",
        "结论：发现可实际播放的公开接口，魔都可作为进一步试用的优先候选；360、无尽、iKun、如意和极速有部分样本通过。没有任何来源达到已验证长期稳定、整季完整的标准。", "",
        "| 建议 | 来源 | 依据与限制 |", "|---|---|---|",
        "| 优先评估 | 魔都 | 10 个作品样本中 8 个通过清单和分片检查；《星际穿越》《千与千寻》在浏览器起播及中段播放成功。新片和番剧仍有缓冲、末集连接失败。 |",
        "| 作品级备用 | 极速 | 《挽救计划》以 1920×1036 实际起播，中段跳转后又播放约 30 秒，两段观察无错误；《咒术回战》第三季分片验证成功。其他样本多次超时。 |",
        "| 番剧备用候选 | 360 | 《芙莉莲》第二季实际 1080p 起播，但出现分片超时和缓冲停顿。 |",
        "| 尚需浏览器与内容复核 | 无尽、如意、iKun | 部分媒体分片通过；iKun 某些同名电影时长明显不同，不能直接当作同一完整版本。 |",
        "| 暂缓 | 非凡、电影天堂、最大 | 前两者媒体请求多次 403/超时；最大首个播放项常为 TC，存在短片段及质量问题。 |", "",
        "## 方法与边界", "",
        "- 候选来自 aahl/MoonTV 的公开 config.json，20 个来源初筛，11 个返回可解析 JSON，9 个失败。随后选 9 个做 8 组作品查询，对其中 6 个补查 2 部 2026 年电影。",
        "- 样本覆盖 2026 年番剧、2026 年电影、2025 年电影和经典作品；不是当日热度排名。",
        "- 核对片名、年份和季度，排除明显的解说、纪录片和同名真人剧；搜索超时不等于片库没有该作品。",
        "- 媒体检查读取 HLS 清单，并对开头、中段分片各读取最多 64 KiB。标准 AES-128 HLS 在补测中使用清单公开指定的密钥验证。没有绕过付费、登录或 DRM。",
        "- 浏览器使用本地页面、HLS.js 1.6.13、直接跨域加载和静音播放；没有视频代理。解码帧数、画面尺寸及进度来自页面实际观测。声音内容未人工试听。",
        "- 仅反映当前电脑及其现有网络环境。本次没有更改系统网络或代理设置，也没有分别验证其他地区、手机、部署服务器、多人并发或长时间播放。",
        "- CORS 检查使用 http://127.0.0.1:8765；通过的样本返回通配允许来源，实际 HTTPS 部署仍需复测。",
        "- 未取得或核实这些来源对具体影视内容的传播授权。技术可达性不能作为内容授权依据。", "",
        "## 来源筛选", "",
        "| 来源 | 初筛 | 接口 |", "|---|---|---|"
    ]
    for source in screen["sources"]:
        result = source["queries"][0]
        state = "JSON 可解析" if result.get("status") == 200 else result.get("error", "失败")
        lines.append(f"| {source['name']} | {state} | `{source['api']}` |")
    lines += ["", "## 作品与媒体抽检", "",
              "这里的‘通过’仅表示清单及两个分片的格式验证成功，不代表完整观看通过。", "",
              "| 来源 | 作品 | 年份 | 播放项 | 列表项数 | 清单分钟数 | 结果 |", "|---|---|---|---|---:|---:|---|"]
    for check in media + supplemental:
        probe = check.get("probe", {})
        state = "通过" if probe.get("media_ok") else check.get("error") or probe.get("error") or "需补验标准加密分片"
        if check.get("search_error"):
            state = "搜索失败：" + check["search_error"]
        duration = round(probe["duration_seconds"]/60, 1) if probe.get("duration_seconds") else "—"
        lines.append(f"| {check['source_name']} | {check.get('title') or check['query']} | {check.get('year','—')} | {check.get('episode','—')} | {check.get('episode_count','—')} | {duration} | {state} |")
    lines += ["", "## 浏览器实际播放", "", "| 样本 | 阶段 | 当前秒数 / 总秒数 | 画面尺寸 | 已解码帧 | 观测到的错误 |", "|---|---|---|---|---:|---|"]
    for record in browser:
        observed = record["observed"]
        errors = ", ".join(dict.fromkeys(error.get("details") or error.get("message", "unknown") for error in observed.get("errors", []))) or "无"
        lines.append(f"| {observed['sample']} | {record['phase']} | {observed['currentTime']} / {observed['duration']} | {observed['resolution']} | {observed['decodedFrames']} | {errors} |")
    lines += ["", "## 剧集末集抽检", "", "| 作品 | 末集 | 结果 |", "|---|---|---|"]
    for check in last:
        lines.append(f"| {check['title']} | {check['episode']} | {check['probe'].get('error') or '通过'} |")
    lines += ["", "## 接入建议", "",
              "1. 魔都优先试用，360、无尽、iKun、如意和极速按具体作品补充。接入前另行确认内容使用权限。",
              "2. 非凡和电影天堂此次媒体请求多次 403 或连接失败，不作为默认来源；其他初筛失败来源暂缓。",
              "3. 选择具体播放项时优先 HD/正片，排除 TC、抢先版、预告片和解说。最大来源虽然有 4 个媒体通过样本，但取到的均为 TC；其中《飞驰人生3》只有约 48 分钟，不能当作完整正片。",
              "4. 同名作品时长明显不一致：例如《星际穿越》魔都约 171 分钟、iKun 所选条目约 138 分钟。需要核对版本、完整性和插入内容，不能仅凭名称合并。",
              "5. 账号和收藏绑定内部作品/季度/剧集 ID；播放来源与这些记录解耦。",
              "6. 为搜索和播放各设超时与有限重试；保留清晰的加载失败提示、手动换源、短期健康缓存。以实际播放质量调整来源优先级。",
              "7. 只在来源许可范围内决定是否增加代理；当前实测没有用代理解决跨域或绕过访问限制。", "",
              "## 可复核材料", "",
              "- 候选清单出处：https://github.com/aahl/MoonTV/blob/main/config.json",
              "- 原始观察：results/screen.json、matrix.json、recent.json、media.json、encrypted-media.json、last-episodes.json、browser.json。",
              "- 本地播放器：player.html。启动方式：在项目根目录运行 `python -m http.server 8765 --bind 127.0.0.1 --directory diagnostics`，访问 `http://127.0.0.1:8765/player.html`。",
              "- 网络复测脚本：check_sources.py、probe_media.py。接口和播放地址是测试时的快照，未来可能失效。",
              "- HLS.js 发行文件来源：https://cdn.jsdelivr.net/npm/hls.js@1.6.13/dist/hls.min.js；项目许可：https://github.com/video-dev/hls.js/blob/v1.6.13/LICENSE。", ""]
    (ROOT / "source-verification-2026-11-10.md").write_text("\n".join(lines), encoding="utf-8")
    config = load("source-config.json")["data"]["api_site"]
    candidates = {key: {**config[key], "enabled": False, "authorization": "not_verified", "use": "evaluation_candidate"}
                  for key in ["mdzy", "zy360", "wujin", "ikun", "ruyi", "jisu"]}
    (OUT / "candidate-sources.json").write_text(json.dumps({"checked_on": "2026-11-10", "api_site": candidates}, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Wrote report and evaluation candidate list")


if __name__ == "__main__":
    main()
