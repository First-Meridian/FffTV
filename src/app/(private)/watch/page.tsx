import { Watch } from "@/components/watch";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  const value = (key: string) =>
    typeof p[key] === "string" ? (p[key] as string) : "";
  return (
    <Watch
      source={value("source")}
      id={value("id")}
      requestedEpisode={value("episode")}
      requestedLine={Number(value("line"))}
      libraryKey={value("libraryKey")}
    />
  );
}
