# FffTV 公开播放来源实测

测试日期：2026-11-10（Asia/Shanghai）。

结论：发现可实际播放的公开接口，魔都可作为进一步试用的优先候选；360、无尽、iKun、如意和极速有部分样本通过。没有任何来源达到已验证长期稳定、整季完整的标准。

| 建议 | 来源 | 依据与限制 |
|---|---|---|
| 优先评估 | 魔都 | 10 个作品样本中 8 个通过清单和分片检查；《星际穿越》《千与千寻》在浏览器起播及中段播放成功。新片和番剧仍有缓冲、末集连接失败。 |
| 作品级备用 | 极速 | 《挽救计划》以 1920×1036 实际起播，中段跳转后又播放约 30 秒，两段观察无错误；《咒术回战》第三季分片验证成功。其他样本多次超时。 |
| 番剧备用候选 | 360 | 《芙莉莲》第二季实际 1080p 起播，但出现分片超时和缓冲停顿。 |
| 尚需浏览器与内容复核 | 无尽、如意、iKun | 部分媒体分片通过；iKun 某些同名电影时长明显不同，不能直接当作同一完整版本。 |
| 暂缓 | 非凡、电影天堂、最大 | 前两者媒体请求多次 403/超时；最大首个播放项常为 TC，存在短片段及质量问题。 |

## 方法与边界

- 候选来自 aahl/MoonTV 的公开 config.json，20 个来源初筛，11 个返回可解析 JSON，9 个失败。随后选 9 个做 8 组作品查询，对其中 6 个补查 2 部 2026 年电影。
- 样本覆盖 2026 年番剧、2026 年电影、2025 年电影和经典作品；不是当日热度排名。
- 核对片名、年份和季度，排除明显的解说、纪录片和同名真人剧；搜索超时不等于片库没有该作品。
- 媒体检查读取 HLS 清单，并对开头、中段分片各读取最多 64 KiB。标准 AES-128 HLS 在补测中使用清单公开指定的密钥验证。没有绕过付费、登录或 DRM。
- 浏览器使用本地页面、HLS.js 1.6.13、直接跨域加载和静音播放；没有视频代理。解码帧数、画面尺寸及进度来自页面实际观测。声音内容未人工试听。
- 仅反映当前电脑及其现有网络环境。本次没有更改系统网络或代理设置，也没有分别验证其他地区、手机、部署服务器、多人并发或长时间播放。
- CORS 检查使用 http://127.0.0.1:8765；通过的样本返回通配允许来源，实际 HTTPS 部署仍需复测。
- 未取得或核实这些来源对具体影视内容的传播授权。技术可达性不能作为内容授权依据。

## 来源筛选

| 来源 | 初筛 | 接口 |
|---|---|---|
| 天涯资源 | Expecting value: line 1 column 1 (char 0) | `https://tyyszy.com/api.php/provide/vod` |
| 非凡影视 | JSON 可解析 | `http://ffzy5.tv/api.php/provide/vod` |
| 电影天堂资源 | JSON 可解析 | `http://caiji.dyttzyapi.com/api.php/provide/vod` |
| 黑木耳 | Expecting value: line 1 column 1 (char 0) | `https://json.heimuer.xyz/api.php/provide/vod` |
| 极速资源 | JSON 可解析 | `https://jszyapi.com/api.php/provide/vod` |
| 暴风资源 | JSON 可解析 | `https://bfzyapi.com/api.php/provide/vod` |
| 如意资源 | JSON 可解析 | `http://cj.rycjapi.com/api.php/provide/vod` |
| 魔都资源 | JSON 可解析 | `https://www.mdzyapi.com/api.php/provide/vod` |
| 360资源 | JSON 可解析 | `https://360zy.com/api.php/provide/vod` |
| 豆瓣资源 | <urlopen error [SSL: UNEXPECTED_EOF_WHILE_READING] EOF occurred in violation of protocol (_ssl.c:1000)> | `https://dbzy.tv/api.php/provide/vod` |
| 樱花资源 | HTTP Error 403: Forbidden | `https://m3u8.apiyhzy.com/api.php/provide/vod` |
| 最大资源 | JSON 可解析 | `https://api.zuidapi.com/api.php/provide/vod` |
| iKun资源 | JSON 可解析 | `https://ikunzyapi.com/api.php/provide/vod` |
| 无尽资源 | JSON 可解析 | `https://api.wujinapi.me/api.php/provide/vod` |
| 旺旺短剧 | Expecting value: line 1 column 1 (char 0) | `https://wwzy.tv/api.php/provide/vod` |
| 卧龙资源 | Expecting value: line 1 column 1 (char 0) | `https://wolongzyw.com/api.php/provide/vod` |
| 量子资源站 | JSON 可解析 | `https://cj.lziapi.com/api.php/provide/vod` |
| 小猫咪资源 | <urlopen error [SSL: UNEXPECTED_EOF_WHILE_READING] EOF occurred in violation of protocol (_ssl.c:1000)> | `https://zy.xmm.hk/api.php/provide/vod` |
| 茅台资源 | <urlopen error _ssl.c:983: The handshake operation timed out> | `https://caiji.maotaizy.cc/api.php/provide/vod` |
| 魔爪资源 | <urlopen error [SSL: UNEXPECTED_EOF_WHILE_READING] EOF occurred in violation of protocol (_ssl.c:1000)> | `https://mozhuazy.com/api.php/provide/vod` |

## 作品与媒体抽检

这里的‘通过’仅表示清单及两个分片的格式验证成功，不代表完整观看通过。

| 来源 | 作品 | 年份 | 播放项 | 列表项数 | 清单分钟数 | 结果 |
|---|---|---|---|---:|---:|---|
| 极速资源 | 葬送的芙莉莲第二季 | 2026 | 第1集 | 10 | — | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 极速资源 | 咒术回战第三季 | 2026 | 第1集 | 12 | — | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 极速资源 | 哪吒之魔童闹海 | 2025 | 正片 | 1 | — | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 极速资源 | 疯狂动物城2 | 2025 | 正片 | 1 | 107.5 | 需补验标准加密分片 |
| 极速资源 | 星际穿越(原声版) | 2014 | 正片 | 1 | — | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 极速资源 | 肖申克的救赎 | 1994 | 正片 | 1 | 142.6 | 需补验标准加密分片 |
| 极速资源 | 千与千寻 | 2001 | 正片 | 1 | — | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 极速资源 | 星际牛仔 | — | — | — | — | No matching title/year/season in response |
| 极速资源 | 飞驰人生3 | 2026 | 正片 | 1 | — | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 极速资源 | 挽救计划 | 2026 | 正片 | 1 | 156.5 | 需补验标准加密分片 |
| 魔都资源 | 葬送的芙莉莲第二季 | 2026 | 第01集 | 10 | 24.9 | 通过 |
| 魔都资源 | 咒术回战第三季 | 2026 | 第01集 | 12 | 24.8 | 通过 |
| 魔都资源 | 哪吒之魔童闹海 | 2025 | 正片 | 1 | 146.0 | 通过 |
| 魔都资源 | 疯狂动物城2 | 2025 | 正片 | 1 | 110.5 | 通过 |
| 魔都资源 | 星际穿越 | 2014 | 正片 | 1 | 171.0 | 通过 |
| 魔都资源 | 肖申克的救赎 | 1994 | 正片 | 1 | — | Non-public destination rejected |
| 魔都资源 | 千与千寻 | 2001 | HD高清 | 1 | 132.2 | 通过 |
| 魔都资源 | 星际牛仔 | 1998 | 第1集 | 26 | 26.5 | 通过 |
| 魔都资源 | 飞驰人生3 | 2026 | 正片 | 1 | 128.5 | 通过 |
| 魔都资源 | 挽救计划 | 2026 | 正片 | 1 | — | <urlopen error [SSL: UNEXPECTED_EOF_WHILE_READING] EOF occurred in violation of protocol (_ssl.c:1000)> |
| 如意资源 | 葬送的芙莉莲第二季 | 2026 | 第01集 | 10 | 24.5 | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 如意资源 | 咒术回战第三季 | 2026 | 第01集 | 12 | 24.5 | 通过 |
| 如意资源 | 哪吒之魔童闹海 | 2025 | HD中字 | 1 | — | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 如意资源 | 疯狂动物城2 | 2025 | HD中字 | 1 | — | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 如意资源 | 星际穿越 | 2014 | HD中字 | 1 | — | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 如意资源 | 肖申克的救赎 | 1994 | HD中字 | 1 | — | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 如意资源 | 千与千寻 | 2019 | 国语 | 2 | — | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 如意资源 | 星际牛仔 | 1998 | 第01集 | 26 | — | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 电影天堂资源 | 葬送的芙莉莲第二季 | 2026 | 第01集 | 10 | — | HTTP Error 403: Forbidden |
| 电影天堂资源 | 咒术回战第三季 | 2026 | 第01集 | 12 | — | HTTP Error 403: Forbidden |
| 电影天堂资源 | 哪吒之魔童闹海 | 2025 | HD国语 | 1 | — | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 电影天堂资源 | 疯狂动物城2 | 2025 | HD中字 | 3 | — | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 电影天堂资源 | 星际穿越 | 2014 | HD中字 | 2 | — | HTTP Error 403: Forbidden |
| 电影天堂资源 | 肖申克的救赎 | 1994 | HD中字 | 2 | — | HTTP Error 403: Forbidden |
| 电影天堂资源 | 千与千寻 | 2001 | HD国语 | 2 | — | HTTP Error 403: Forbidden |
| 电影天堂资源 | 星际牛仔1998 | 1998 | 第01集 | 26 | — | HTTP Error 403: Forbidden |
| 电影天堂资源 | 飞驰人生3 | 2026 | HD国语 | 1 | — | HTTP Error 403: Forbidden |
| 电影天堂资源 | 挽救计划 | 2026 | HD中字 | 2 | — | HTTP Error 403: Forbidden |
| 非凡影视 | 葬送的芙莉莲第二季 | 2026 | 第01集 | 10 | — | HTTP Error 403: Forbidden |
| 非凡影视 | 咒术回战第三季 | 2026 | 第01集 | 12 | — | HTTP Error 403: Forbidden |
| 非凡影视 | 哪吒之魔童闹海 | 2025 | HD国语 | 1 | — | HTTP Error 403: Forbidden |
| 非凡影视 | 疯狂动物城2 | 2025 | HD中字 | 3 | — | HTTP Error 403: Forbidden |
| 非凡影视 | 星际穿越 | — | — | — | — | 搜索失败：timed out |
| 非凡影视 | 肖申克的救赎 | 1994 | HD中字 | 1 | — | HTTP Error 403: Forbidden |
| 非凡影视 | 千与千寻 | 2001 | HD中字 | 1 | — | HTTP Error 403: Forbidden |
| 非凡影视 | 星际牛仔 | 1998 | 第01集 | 26 | — | HTTP Error 403: Forbidden |
| 非凡影视 | 飞驰人生3 | 2026 | HD国语 | 1 | — | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 非凡影视 | 挽救计划 | 2026 | HD中字 | 2 | — | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 360资源 | 葬送的芙莉莲第二季 | 2026 | 第01集 | 10 | 24.6 | 需补验标准加密分片 |
| 360资源 | 咒术回战第三季 | 2026 | 第01集 | 12 | 24.5 | 需补验标准加密分片 |
| 360资源 | 哪吒之魔童闹海 | 2025 | 正片 | 1 | 146.3 | 需补验标准加密分片 |
| 360资源 | 疯狂动物城2 | 2025 | 正片 | 1 | 109.6 | 需补验标准加密分片 |
| 360资源 | 星际穿越 | 2014 | 星际穿越 | 1 | 169.1 | 需补验标准加密分片 |
| 360资源 | 肖申克的救赎 | 1994 | HD中字 | 1 | — | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 360资源 | 千与千寻 | — | — | — | — | 搜索失败：<urlopen error _ssl.c:983: The handshake operation timed out> |
| 360资源 | 星际牛仔 | — | — | — | — | No matching title/year/season in response |
| 无尽资源 | 葬送的芙莉莲第二季 | 2026 | 第01集 | 10 | 24.0 | 通过 |
| 无尽资源 | 咒术回战第三季 | 2026 | 第01集 | 12 | 23.9 | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 无尽资源 | 哪吒之魔童闹海 | 2025 | HD | 1 | 144.0 | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 无尽资源 | 疯狂动物城2 | 2025 | HD | 1 | 107.9 | 通过 |
| 无尽资源 | 星际穿越 | 2014 | HD中字 | 1 | 85.4 | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 无尽资源 | 肖申克的救赎 | 1994 | HD中字 | 1 | 142.6 | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 无尽资源 | 千与千寻 | 2001 | HD | 1 | 124.5 | <urlopen error [SSL: UNEXPECTED_EOF_WHILE_READING] EOF occurred in violation of protocol (_ssl.c:1000)> |
| 无尽资源 | 星际牛仔 | 1998 | 第01集 | 26 | 24.7 | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 无尽资源 | 飞驰人生3 | 2026 | HD | 1 | 125.8 | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 无尽资源 | 挽救计划 | 2026 | HD | 1 | 156.5 | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 最大资源 | 葬送的芙莉莲第二季 | 2026 | 第01集 | 10 | 24.7 | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 最大资源 | 咒术回战第三季 | 2026 | 第01集 | 12 | 24.6 | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 最大资源 | 哪吒之魔童闹海 | 2025 | TC | 3 | 139.1 | 通过 |
| 最大资源 | 疯狂动物城2 | 2025 | TC | 3 | 99.1 | 通过 |
| 最大资源 | 星际穿越 | 2014 | HD中字 | 2 | 56.3 | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 最大资源 | 肖申克的救赎 | 1994 | HD中字 | 1 | 143.0 | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 最大资源 | 千与千寻 | 2001 | 4K | 1 | 125.0 | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 最大资源 | 星际牛仔 | 1998 | 第01集 | 26 | 25.1 | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 最大资源 | 飞驰人生3 | 2026 | TC | 2 | 48.3 | 通过 |
| 最大资源 | 挽救计划 | 2026 | TC | 2 | 151.0 | 通过 |
| iKun资源 | 葬送的芙莉莲 | — | — | — | — | 搜索失败：<urlopen error _ssl.c:983: The handshake operation timed out> |
| iKun资源 | 咒术回战 | — | — | — | — | 搜索失败：<urlopen error _ssl.c:983: The handshake operation timed out> |
| iKun资源 | 哪吒之魔童闹海 | 2025 | 正片 | 1 | 146.6 | 通过 |
| iKun资源 | 疯狂动物城2 | — | — | — | — | 搜索失败：<urlopen error _ssl.c:983: The handshake operation timed out> |
| iKun资源 | 星际穿越 | 2014 | 正片 | 1 | 137.8 | 通过 |
| iKun资源 | 肖申克的救赎 | 1994 | 正片 | 1 | 139.3 | 通过 |
| iKun资源 | 千与千寻 | 2001 | 正片 | 1 | 127.2 | 通过 |
| iKun资源 | 星际牛仔 | — | — | — | — | No matching title/year/season in response |
| 极速资源 | 葬送的芙莉莲第二季 | 2026 | 第1集 | 10 | 24.0 | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 极速资源 | 咒术回战第三季 | 2026 | 第1集 | 12 | 23.9 | 通过 |
| 极速资源 | 哪吒之魔童闹海 | 2025 | 正片 | 1 | — | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 极速资源 | 疯狂动物城2 | 2025 | 正片 | 1 | — | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 极速资源 | 星际穿越(原声版) | 2014 | 正片 | 1 | — | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 极速资源 | 肖申克的救赎 | 1994 | 正片 | 1 | — | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 极速资源 | 挽救计划 | 2026 | 正片 | 1 | 156.5 | 通过 |
| 360资源 | 葬送的芙莉莲第二季 | 2026 | 第01集 | 10 | 24.6 | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 360资源 | 咒术回战第三季 | 2026 | 第01集 | 12 | — | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 360资源 | 哪吒之魔童闹海 | 2025 | 正片 | 1 | — | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 360资源 | 疯狂动物城2 | 2025 | 正片 | 1 | — | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 360资源 | 星际穿越 | 2014 | 星际穿越 | 1 | — | <urlopen error _ssl.c:983: The handshake operation timed out> |
| 360资源 | 肖申克的救赎 | 1994 | HD中字 | 1 | 142.5 | <urlopen error _ssl.c:983: The handshake operation timed out> |

## 浏览器实际播放

| 样本 | 阶段 | 当前秒数 / 总秒数 | 画面尺寸 | 已解码帧 | 观测到的错误 |
|---|---|---|---|---:|---|
| 魔都资源｜葬送的芙莉莲第二季｜第01集 | startup (seek not confirmed) | 20.4 / 1495 | 1920×1080 | 492 | bufferStalledError |
| 魔都资源｜飞驰人生3｜正片 | start | 2 / 7708 | 1920×808 | 48 | fragLoadTimeOut, fragLoadError |
| 360资源｜葬送的芙莉莲第二季｜第01集 | start | 25.6 / 1477 | 1920×1080 | 644 | fragLoadTimeOut, bufferStalledError |
| 魔都资源｜星际穿越｜正片 | start | 29.9 / 10261 | 1920×1080 | 719 | 无 |
| 魔都资源｜星际穿越｜正片 | midpoint | 5160.4 / 10261 | 1920×1080 | 1407 | bufferStalledError |
| 魔都资源｜千与千寻｜HD高清 | start | 29.6 / 7929 | 1280×691 | 893 | 无 |
| 魔都资源｜千与千寻｜HD高清 | midpoint | 3994.4 / 7929 | 1280×691 | 1807 | 无 |
| 极速资源｜挽救计划｜正片 | start | 29.4 / 9392 | 1920×1036 | 710 | 无 |
| 极速资源｜挽救计划｜正片 | midpoint | 4725.6 / 9392 | 1920×1036 | 1484 | 无 |

## 剧集末集抽检

| 作品 | 末集 | 结果 |
|---|---|---|
| 葬送的芙莉莲第二季 | 第10集 | <urlopen error [SSL: UNEXPECTED_EOF_WHILE_READING] EOF occurred in violation of protocol (_ssl.c:1000)> |
| 咒术回战第三季 | 第12集 | <urlopen error [SSL: UNEXPECTED_EOF_WHILE_READING] EOF occurred in violation of protocol (_ssl.c:1000)> |
| 星际牛仔 | 第26集 | <urlopen error _ssl.c:983: The handshake operation timed out> |

## 接入建议

1. 魔都优先试用，360、无尽、iKun、如意和极速按具体作品补充。接入前另行确认内容使用权限。
2. 非凡和电影天堂此次媒体请求多次 403 或连接失败，不作为默认来源；其他初筛失败来源暂缓。
3. 选择具体播放项时优先 HD/正片，排除 TC、抢先版、预告片和解说。最大来源虽然有 4 个媒体通过样本，但取到的均为 TC；其中《飞驰人生3》只有约 48 分钟，不能当作完整正片。
4. 同名作品时长明显不一致：例如《星际穿越》魔都约 171 分钟、iKun 所选条目约 138 分钟。需要核对版本、完整性和插入内容，不能仅凭名称合并。
5. 账号和收藏绑定内部作品/季度/剧集 ID；播放来源与这些记录解耦。
6. 为搜索和播放各设超时与有限重试；保留清晰的加载失败提示、手动换源、短期健康缓存。以实际播放质量调整来源优先级。
7. 只在来源许可范围内决定是否增加代理；当前实测没有用代理解决跨域或绕过访问限制。

## 可复核材料

- 候选清单出处：https://github.com/aahl/MoonTV/blob/main/config.json
- 原始观察：results/screen.json、matrix.json、recent.json、media.json、encrypted-media.json、last-episodes.json、browser.json。
- 本地播放器：player.html。启动方式：在项目根目录运行 `python -m http.server 8765 --bind 127.0.0.1 --directory diagnostics`，访问 `http://127.0.0.1:8765/player.html`。
- 网络复测脚本：check_sources.py、probe_media.py。接口和播放地址是测试时的快照，未来可能失效。
- HLS.js 发行文件来源：https://cdn.jsdelivr.net/npm/hls.js@1.6.13/dist/hls.min.js；项目许可：https://github.com/video-dev/hls.js/blob/v1.6.13/LICENSE。
