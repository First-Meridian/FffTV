export type User = { id: number; username: string; role: "admin" | "member" };
export type Source = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  note: string;
};
export type Episode = {
  name: string;
  url: string;
  index: number;
  key: string;
  quality: "normal" | "preview";
};
export type PlayLine = { name: string; episodes: Episode[] };
export type Movie = {
  id: string;
  key: string;
  source: string;
  sourceName: string;
  title: string;
  year: string;
  type: string;
  area: string;
  language: string;
  poster: string;
  description: string;
  remarks: string;
  score: string;
  director: string;
  actors: string;
  lines: PlayLine[];
  updated: string;
  releaseDate?: string;
  genres?: string[];
  areas?: string[];
  kind?: string;
  variants?: MovieVariant[];
};
export type MovieVariant = Pick<
  Movie,
  "id" | "source" | "sourceName" | "title" | "year" | "remarks" | "language"
>;
export type SourceResult = {
  id: string;
  name: string;
  count: number;
  elapsed: number;
  error?: string;
  page?: number;
  pages?: number;
};
export type SearchResult = { movies: Movie[]; sources: SourceResult[] };
export type CatalogSync = {
  id: string;
  name: string;
  nextPage: number;
  pages: number;
  total: number;
  indexed: number;
  completed: number;
  updated: number;
  error: string;
};
export type CatalogResult = {
  movies: Movie[];
  total: number;
  page: number;
  pages: number;
  pageSize: number;
  facets: { years: string[]; areas: string[]; genres: string[] };
  sync: CatalogSync[];
};
export type SeasonEntry = {
  id: number;
  title: string;
  originalTitle: string;
  aliases: string[];
  date: string;
  platform: string;
  poster: string;
  description: string;
};
export type SeasonResult = {
  year: number;
  quarter: number;
  label: string;
  entries: SeasonEntry[];
  updated: number;
  stale?: boolean;
  error?: string;
};
export type LibraryItem = {
  movie: Movie;
  episodeKey: string;
  episodeName: string;
  position: number;
  duration: number;
  updated: number;
  favorite: boolean;
};
