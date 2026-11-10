import { movieKind } from "./catalog";
import type { Movie, MovieVariant } from "./types";

export function workKey(movie: Movie): string {
  return `${movie.key}:${movie.kind || movieKind(movie.type)}`;
}
export function variant(movie: Movie): MovieVariant {
  const { id, source, sourceName, title, year, remarks, language } = movie;
  return { id, source, sourceName, title, year, remarks, language };
}
/** Group before paginating. Keep seasons, remakes and formats separate. */
export function groupMovies(movies: Movie[]): Movie[] {
  const groups = new Map<string, Movie>();
  for (const movie of movies) {
    const key = workKey(movie),
      found = groups.get(key);
    if (!found)
      groups.set(key, {
        ...movie,
        variants: movie.variants?.length
          ? [...movie.variants]
          : [variant(movie)],
      });
    else if (
      !found.variants!.some(
        (v) => v.source === movie.source && v.id === movie.id,
      )
    ) {
      found.variants!.push(variant(movie));
      found.genres = [
        ...new Set([...(found.genres || []), ...(movie.genres || [])]),
      ];
      found.areas = [
        ...new Set([...(found.areas || []), ...(movie.areas || [])]),
      ];
      if (!found.releaseDate) found.releaseDate = movie.releaseDate;
      if (!found.poster) found.poster = movie.poster;
    }
    const group = groups.get(key)!;
    for (const item of movie.variants || [])
      if (
        !group.variants!.some(
          (v) => v.source === item.source && v.id === item.id,
        )
      )
        group.variants!.push(item);
  }
  return [...groups.values()];
}
