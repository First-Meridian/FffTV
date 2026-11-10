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
};
export type SourceResult = {
  id: string;
  name: string;
  count: number;
  elapsed: number;
  error?: string;
};
export type SearchResult = { movies: Movie[]; sources: SourceResult[] };
export type LibraryItem = {
  movie: Movie;
  episodeKey: string;
  episodeName: string;
  position: number;
  duration: number;
  updated: number;
  favorite: boolean;
};
