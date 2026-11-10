export function normalizedTitle(title: string, year = ""): string {
  let value = title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\((?:国语|普通话|粤语|原声|英语|日语)(?:版)?\)/g, "")
    .replace(/[《》「」『』]/g, "")
    .replace(/第([一二三四五六七八九十]+)季/g, (_, numeral: string) => {
      const digits = "零一二三四五六七八九";
      const parts = numeral.split("十");
      const number =
        parts.length === 1
          ? digits.indexOf(numeral)
          : (parts[0] ? digits.indexOf(parts[0]) : 1) * 10 +
            (parts[1] ? digits.indexOf(parts[1]) : 0);
      return number > 0 ? `第${number}季` : `第${numeral}季`;
    })
    .replace(/[\s\u200b-\u200d\ufeff·・:：—_-]/g, "");
  if (value.length > 4)
    value = value.replace(/(?:国语|普通话|粤语|原声)(?:版)?$/, "");
  if (/^\d{4}$/.test(year) && value.length > 4)
    value = value.replace(new RegExp(`(?:\\(${year}\\)|${year})$`), "");
  return value;
}
export function sameWork(
  a: { title: string; year: string },
  b: { title: string; year: string },
): boolean {
  return (
    normalizedTitle(a.title, a.year) === normalizedTitle(b.title, b.year) &&
    a.year.slice(0, 4) === b.year.slice(0, 4)
  );
}
