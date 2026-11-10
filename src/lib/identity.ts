export function normalizedTitle(title: string): string {
  return title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\((?:国语|普通话|粤语|原声|英语|日语)(?:版)?\)/g, "")
    .replace(/[\s·・:：—_-]/g, "");
}
export function sameWork(
  a: { title: string; year: string },
  b: { title: string; year: string },
): boolean {
  return (
    normalizedTitle(a.title) === normalizedTitle(b.title) &&
    a.year.slice(0, 4) === b.year.slice(0, 4)
  );
}
