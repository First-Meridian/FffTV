import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { lookup } from "node:dns";
import { BlockList, isIP } from "node:net";

const blocked = new BlockList();
for (const [network, mask] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["192.0.0.0", 24],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocked.addSubnet(network, mask, "ipv4");
for (const [network, mask] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const)
  blocked.addSubnet(network, mask, "ipv6");
export function isPublicAddress(address: string): boolean {
  if (address.startsWith("::ffff:")) return isPublicAddress(address.slice(7));
  const family = isIP(address);
  return (
    family !== 0 && !blocked.check(address, family === 4 ? "ipv4" : "ipv6")
  );
}

/** DNS validation happens in the connection's lookup callback. Redirects are rejected. */
export async function fetchCatalog(url: URL): Promise<Record<string, unknown>> {
  if (!["https:", "http:"].includes(url.protocol))
    throw new Error("不支持的接口协议");
  if (isIP(url.hostname) && !isPublicAddress(url.hostname))
    throw new Error("接口地址不可用");
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (error?: Error, value?: Record<string, unknown>) => {
      if (!done) {
        done = true;
        clearTimeout(deadline);
        error ? reject(error) : resolve(value!);
      }
    };
    const req = (url.protocol === "https:" ? httpsRequest : httpRequest)(
      url,
      {
        headers: {
          "User-Agent": "FffTV/0.1",
          Accept: "application/json",
          "Accept-Encoding": "identity",
        },
        lookup(hostname, options, callback) {
          lookup(hostname, { all: true }, (error, addresses) => {
            if (error) return callback(error, [], 0);
            const safe = addresses.filter((item) =>
              isPublicAddress(item.address),
            );
            if (!safe.length)
              return callback(new Error("接口解析到非公网地址"), [], 0);
            if (options.all) callback(null, safe);
            else callback(null, safe[0].address, safe[0].family);
          });
        },
      },
      (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          finish(new Error(`来源返回 HTTP ${response.statusCode}`));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 3_000_000) {
            req.destroy(new Error("来源响应过大"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("error", (error) => finish(error));
        response.on("end", () => {
          try {
            const data: unknown = JSON.parse(
              Buffer.concat(chunks)
                .toString("utf8")
                .replace(/^\uFEFF/, ""),
            );
            if (!data || typeof data !== "object" || Array.isArray(data))
              throw new Error();
            finish(undefined, data as Record<string, unknown>);
          } catch {
            finish(new Error("来源未返回有效的影视数据"));
          }
        });
      },
    );
    const deadline = setTimeout(
      () => req.destroy(new Error("连接超时，请尝试其他来源")),
      10000,
    );
    req.on("error", (error) => finish(error));
    req.end();
  });
}
