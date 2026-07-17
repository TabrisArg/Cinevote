export interface MovieResult {
  title: string;
  year: string;
  description: string;
  director: string;
  genres: string[];
  poster: string;
  trailerUrl?: string;
  tmdbId?: string | number;
}

const TMDB_API_KEY = "599d9925eb94b5ad1025189ed23ab847";

export const POPULAR_MOVIES_FALLBACK: MovieResult[] = [
  {
    title: "Interstellar",
    year: "2014",
    description: "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.",
    director: "Christopher Nolan",
    genres: ["Sci-Fi", "Adventure", "Drama"],
    poster: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&auto=format&fit=crop"
  },
  {
    title: "Inception",
    year: "2010",
    description: "A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea.",
    director: "Christopher Nolan",
    genres: ["Sci-Fi", "Action", "Thriller"],
    poster: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=400&auto=format&fit=crop"
  },
  {
    title: "The Dark Knight",
    year: "2008",
    description: "When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological tests.",
    director: "Christopher Nolan",
    genres: ["Action", "Crime", "Drama"],
    poster: "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=400&auto=format&fit=crop"
  },
  {
    title: "Spirited Away",
    year: "2001",
    description: "During her family's move to the suburbs, a sullen 10-year-old girl wanders into a world ruled by gods, witches, and spirits.",
    director: "Hayao Miyazaki",
    genres: ["Animation", "Adventure", "Fantasy"],
    poster: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&auto=format&fit=crop"
  },
  {
    title: "Pulp Fiction",
    year: "1994",
    description: "The lives of two mob hitmen, a boxer, a gangster and his wife, and a pair of diner bandits intertwine in four tales of violence and redemption.",
    director: "Quentin Tarantino",
    genres: ["Crime", "Drama"],
    poster: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=400&auto=format&fit=crop"
  },
  {
    title: "The Matrix",
    year: "1999",
    description: "When a beautiful stranger leads computer hacker Neo to a forbidding underworld, he discovers the shocking truth--the life he knows is the elaborate deception of an evil cyber-intelligence.",
    director: "Lana Wachowski, Lilly Wachowski",
    genres: ["Sci-Fi", "Action"],
    poster: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&auto=format&fit=crop"
  },
  {
    title: "Joker",
    year: "2019",
    description: "A mentally troubled comedian is devalued and mistreated by society. He then embarks on a downward spiral of revolution and bloody crime.",
    director: "Todd Phillips",
    genres: ["Crime", "Drama", "Thriller"],
    poster: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&auto=format&fit=crop"
  },
  {
    title: "Parasite",
    year: "2019",
    description: "Greed and class discrimination threaten the newly formed symbiotic relationship between the wealthy Park family and the destitute Kim clan.",
    director: "Bong Joon Ho",
    genres: ["Drama", "Thriller"],
    poster: "https://images.unsplash.com/photo-1533928298208-27ff66555d8d?w=400&auto=format&fit=crop"
  },
  {
    title: "Gladiator",
    year: "2000",
    description: "A former Roman General sets out to exact vengeance against the corrupt emperor who murdered his family and sent him into slavery.",
    director: "Ridley Scott",
    genres: ["Action", "Adventure", "Drama"],
    poster: "https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=400&auto=format&fit=crop"
  },
  {
    title: "Avatar",
    year: "2009",
    description: "A paraplegic Marine dispatched to the moon Pandora on a unique mission becomes torn between following his orders and protecting the world he feels is his home.",
    director: "James Cameron",
    genres: ["Action", "Adventure", "Fantasy"],
    poster: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&auto=format&fit=crop"
  },
  {
    title: "La La Land",
    year: "2016",
    description: "While navigating their careers in Los Angeles, a pianist and an actress fall in love while attempting to reconcile their aspirations for the future.",
    director: "Damien Chazelle",
    genres: ["Comedy", "Drama", "Music"],
    poster: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop"
  }
];

export function getLocalFallbackResults(query: string): MovieResult[] {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) return [];

  const matched = POPULAR_MOVIES_FALLBACK.filter(
    (movie) =>
      movie.title.toLowerCase().includes(normalizedQuery) ||
      movie.director.toLowerCase().includes(normalizedQuery) ||
      movie.genres.some((g) => g.toLowerCase().includes(normalizedQuery))
  );

  return matched.map((m) => ({
    ...m,
    trailerUrl: m.trailerUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent(m.title + " " + m.year + " official trailer")}`
  }));
}

export async function fetchMoviesFromTMDB(query: string): Promise<MovieResult[]> {
  try {
    const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${encodeURIComponent(TMDB_API_KEY)}&query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`;
    const searchRes = await fetch(searchUrl);
    
    if (!searchRes.ok) {
      throw new Error(`TMDB Search failed with status: ${searchRes.status}`);
    }
    const searchData = await searchRes.json();

    if (!searchData.results || !Array.isArray(searchData.results) || searchData.results.length === 0) {
      return getLocalFallbackResults(query);
    }

    const candidates = searchData.results.slice(0, 5);
    const detailedMovies = await Promise.all(
      candidates.map(async (movie: any) => {
        try {
          const detailUrl = `https://api.themoviedb.org/3/movie/${movie.id}?api_key=${encodeURIComponent(TMDB_API_KEY)}&append_to_response=videos,credits&language=en-US`;
          const detailRes = await fetch(detailUrl);
          if (!detailRes.ok) {
            return null;
          }
          const detailData = await detailRes.json();

          const title = detailData.title || movie.title || "Untitled Movie";
          const releaseDate = detailData.release_date || movie.release_date || "";
          const year = releaseDate ? releaseDate.substring(0, 4) : "N/A";
          
          const directors = detailData.credits?.crew
            ? detailData.credits.crew.filter((member: any) => member.job === "Director").map((d: any) => d.name)
            : [];
          const director = directors.length > 0 ? directors.join(", ") : "Unknown Director";
          
          const description = detailData.overview || movie.overview || `A cinematic production released in ${year}.`;
          
          const genres = detailData.genres && Array.isArray(detailData.genres) && detailData.genres.length > 0
            ? detailData.genres.map((g: any) => g.name)
            : [];

          const posterPath = detailData.poster_path || movie.poster_path;
          const poster = posterPath 
            ? `https://image.tmdb.org/t/p/w500${posterPath}` 
            : "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=400&auto=format&fit=crop";

          // Find YouTube trailer key if available
          const videosList = detailData.videos?.results || [];
          const youtubeTrailer = videosList.find(
            (v: any) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser")
          ) || videosList.find((v: any) => v.site === "YouTube");

          const trailerUrl = youtubeTrailer
            ? `https://www.youtube.com/watch?v=${youtubeTrailer.key}`
            : `https://www.youtube.com/results?search_query=${encodeURIComponent(title + " " + year + " official trailer")}`;

          return {
            title,
            year,
            director,
            description,
            genres,
            poster,
            trailerUrl,
            tmdbId: movie.id
          };
        } catch (err) {
          console.error(`Error fetching TMDB detail for ${movie.id}:`, err);
          return null;
        }
      })
    );

    const finalMovies = detailedMovies.filter((m): m is MovieResult => m !== null);
    if (finalMovies.length === 0) {
      return getLocalFallbackResults(query);
    }
    return finalMovies;
  } catch (err) {
    console.error("Error in fetchMoviesFromTMDB:", err);
    return getLocalFallbackResults(query);
  }
}
