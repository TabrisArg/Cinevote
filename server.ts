import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

const POPULAR_MOVIES_FALLBACK = [
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
  },
  {
    title: "Whiplash",
    year: "2014",
    description: "A promising young drummer enrolls at a cut-throat music conservatory where his dreams of greatness are mentored by an instructor who will stop at nothing.",
    director: "Damien Chazelle",
    genres: ["Drama", "Music"],
    poster: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=400&auto=format&fit=crop"
  },
  {
    title: "Fight Club",
    year: "1999",
    description: "An insomniac office worker and a devil-may-care soapmaker form an underground fight club that evolves into much more.",
    director: "David Fincher",
    genres: ["Drama"],
    poster: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=400&auto=format&fit=crop"
  },
  {
    title: "The Godfather",
    year: "1972",
    description: "The aging patriarch of an organized crime dynasty transfers control of his clandestine empire to his reluctant son.",
    director: "Francis Ford Coppola",
    genres: ["Crime", "Drama"],
    poster: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=400&auto=format&fit=crop"
  },
  {
    title: "Forrest Gump",
    year: "1994",
    description: "The history of the United States from the 1950s to the '70s unfolds from the perspective of an Alabama man with an IQ of 75, who yearns to be reunited with his childhood sweetheart.",
    director: "Robert Zemeckis",
    genres: ["Drama", "Romance"],
    poster: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&auto=format&fit=crop"
  },
  {
    title: "The Shawshank Redemption",
    year: "1994",
    description: "Over the course of several years, two convicts form a friendship, seeking consolation and, eventually, redemption through basic compassion.",
    director: "Frank Darabont",
    genres: ["Drama"],
    poster: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&auto=format&fit=crop"
  },
  {
    title: "The Truman Show",
    year: "1998",
    description: "An insurance salesman discovers his whole life is actually a reality TV show.",
    director: "Peter Weir",
    genres: ["Comedy", "Drama"],
    poster: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=400&auto=format&fit=crop"
  },
  {
    title: "Spider-Man: Into the Spider-Verse",
    year: "2018",
    description: "Teen Miles Morales becomes the Spider-Man of his universe, and must join with five spider-powered individuals from other dimensions to stop a threat for all realities.",
    director: "Bob Persichetti, Peter Ramsey, Rodney Rothman",
    genres: ["Animation", "Action", "Adventure"],
    poster: "https://images.unsplash.com/photo-1635805737707-575885ab0820?w=400&auto=format&fit=crop"
  },
  {
    title: "Dune",
    year: "2021",
    description: "A noble family becomes embroiled in a war for control over the galaxy's most valuable asset while its heir becomes plagued by visions of a dark future.",
    director: "Denis Villeneuve",
    genres: ["Sci-Fi", "Adventure"],
    poster: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=400&auto=format&fit=crop"
  },
  {
    title: "Dune: Part Two",
    year: "2024",
    description: "Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.",
    director: "Denis Villeneuve",
    genres: ["Sci-Fi", "Adventure"],
    poster: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&auto=format&fit=crop"
  },
  {
    title: "Spider-Man: Across the Spider-Verse",
    year: "2023",
    description: "Miles Morales catapults across the Multiverse, where he encounters a team of Spider-People charged with protecting its very existence.",
    director: "Joaquim Dos Santos, Kemp Powers, Justin K. Thompson",
    genres: ["Animation", "Action", "Adventure"],
    poster: "https://images.unsplash.com/photo-1608889175123-8ec330b86f84?w=400&auto=format&fit=crop"
  },
  {
    title: "Oppenheimer",
    year: "2023",
    description: "The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb.",
    director: "Christopher Nolan",
    genres: ["Biography", "Drama", "History"],
    poster: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=400&auto=format&fit=crop"
  },
  {
    title: "Barbie",
    year: "2023",
    description: "Stereotypical Barbie experiences a full-on existential crisis and must travel to the real world.",
    director: "Greta Gerwig",
    genres: ["Comedy", "Adventure", "Fantasy"],
    poster: "https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=400&auto=format&fit=crop"
  },
  {
    title: "Star Wars: Episode IV - A New Hope",
    year: "1977",
    description: "Luke Skywalker joins forces with a Jedi Knight, a cocky pilot, a Wookiee and two droids to save the galaxy from the Empire's world-destroying battle station.",
    director: "George Lucas",
    genres: ["Sci-Fi", "Action", "Adventure"],
    poster: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=400&auto=format&fit=crop"
  },
  {
    title: "Star Wars: Episode V - The Empire Strikes Back",
    year: "1980",
    description: "After the Rebels are brutally overpowered by the Empire on the ice planet Hoth, Luke Skywalker begins Jedi training with Yoda.",
    director: "Irvin Kershner",
    genres: ["Sci-Fi", "Action", "Adventure"],
    poster: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&auto=format&fit=crop"
  },
  {
    title: "Avengers: Endgame",
    year: "2019",
    description: "After the devastating events of Avengers: Infinity War, the universe is in ruins. With the help of remaining allies, the Avengers assemble once more.",
    director: "Anthony Russo, Joe Russo",
    genres: ["Action", "Adventure", "Sci-Fi"],
    poster: "https://images.unsplash.com/photo-1635805737707-575885ab0820?w=400&auto=format&fit=crop"
  },
  {
    title: "Titanic",
    year: "1997",
    description: "A seventeen-year-old aristocrat falls in love with a kind but poor artist aboard the luxurious, ill-fated R.M.S. Titanic.",
    director: "James Cameron",
    genres: ["Drama", "Romance"],
    poster: "https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=400&auto=format&fit=crop"
  },
  {
    title: "The Lord of the Rings: The Fellowship of the Ring",
    year: "2001",
    description: "A meek Hobbit from the Shire and eight companions set out on a journey to destroy the powerful One Ring and save Middle-earth from the Dark Lord Sauron.",
    director: "Peter Jackson",
    genres: ["Adventure", "Drama", "Fantasy"],
    poster: "https://images.unsplash.com/photo-1509198397868-445647b2a1e5?w=400&auto=format&fit=crop"
  },
  {
    title: "The Lord of the Rings: The Return of the King",
    year: "2003",
    description: "Gandalf and Aragorn lead the World of Men against Sauron's army to draw his gaze from Frodo and Sam as they approach Mount Doom with the One Ring.",
    director: "Peter Jackson",
    genres: ["Adventure", "Drama", "Fantasy"],
    poster: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&auto=format&fit=crop"
  },
  {
    title: "Jurassic Park",
    year: "1993",
    description: "A pragmatic paleontologist touring an almost complete theme park on an island in Central America is tasked with protecting a couple of kids after a power failure causes the park's cloned dinosaurs to run loose.",
    director: "Steven Spielberg",
    genres: ["Action", "Adventure", "Sci-Fi"],
    poster: "https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=400&auto=format&fit=crop"
  },
  {
    title: "Back to the Future",
    year: "1985",
    description: "Marty McFly, a 17-year-old high school student, is accidentally sent thirty years into the past in a time-traveling DeLorean invented by his close friend, the maverick scientist Doc Brown.",
    director: "Robert Zemeckis",
    genres: ["Adventure", "Comedy", "Sci-Fi"],
    poster: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=400&auto=format&fit=crop"
  },
  {
    title: "The Silence of the Lambs",
    year: "1991",
    description: "A young F.B.I. cadet must receive the help of an incarcerated and manipulative cannibal killer to help catch another serial killer, a madman who skins his victims.",
    director: "Jonathan Demme",
    genres: ["Crime", "Drama", "Thriller"],
    poster: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=400&auto=format&fit=crop"
  },
  {
    title: "Goodfellas",
    year: "1990",
    description: "The story of Henry Hill and his life in the mob, covering his relationship with his wife Karen Hill and his mob partners Jimmy Conway and Tommy DeVito in the Italian-American crime syndicate.",
    director: "Martin Scorsese",
    genres: ["Biography", "Crime", "Drama"],
    poster: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=400&auto=format&fit=crop"
  },
  {
    title: "Se7en",
    year: "1995",
    description: "Two detectives, a rookie and a veteran, hunt a serial killer who uses the seven deadly sins as his motives.",
    director: "David Fincher",
    genres: ["Crime", "Drama", "Mystery"],
    poster: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=400&auto=format&fit=crop"
  },
  {
    title: "Toy Story",
    year: "1995",
    description: "A cowboy doll is profoundly threatened and jealous when a new spaceman figure supplants him as top toy in a boy's room.",
    director: "John Lasseter",
    genres: ["Animation", "Adventure", "Comedy"],
    poster: "https://images.unsplash.com/photo-1608889175123-8ec330b86f84?w=400&auto=format&fit=crop"
  },
  {
    title: "The Lion King",
    year: "1994",
    description: "Lion prince Simba and his father are targeted by his bitter uncle, who wants to ascend the throne himself.",
    director: "Roger Allers, Rob Minkoff",
    genres: ["Animation", "Adventure", "Drama"],
    poster: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&auto=format&fit=crop"
  },
  {
    title: "Alien",
    year: "1979",
    description: "The crew of a commercial spacecraft encounter a deadly lifeform after investigating an unknown transmission.",
    director: "Ridley Scott",
    genres: ["Horror", "Sci-Fi"],
    poster: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&auto=format&fit=crop"
  },
  {
    title: "Blade Runner 2049",
    year: "2017",
    description: "A new blade runner, LAPD Officer K, unearths a long-buried secret that has the potential to plunge what's left of society into chaos.",
    director: "Denis Villeneuve",
    genres: ["Action", "Drama", "Sci-Fi"],
    poster: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&auto=format&fit=crop"
  },
  {
    title: "Django Unchained",
    year: "2012",
    description: "With the help of a German bounty-hunter, a freed slave sets out to rescue his wife from a brutal Mississippi plantation owner.",
    director: "Quentin Tarantino",
    genres: ["Drama", "Western"],
    poster: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=400&auto=format&fit=crop"
  },
  {
    title: "Inglourious Basterds",
    year: "2009",
    description: "In Nazi-occupied France during World War II, a plan to assassinate Adolf Hitler by a group of Jewish U.S. soldiers coincides with a theatre owner's vengeful plans for the same.",
    director: "Quentin Tarantino",
    genres: ["Action", "Drama", "War"],
    poster: "https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=400&auto=format&fit=crop"
  },
  {
    title: "Psycho",
    year: "1960",
    description: "A Phoenix secretary embezzles $40,000 from her employer's client, goes on the run, and checks into a remote motel run by a young man under the domination of his mother.",
    director: "Alfred Hitchcock",
    genres: ["Horror", "Mystery", "Thriller"],
    poster: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=400&auto=format&fit=crop"
  },
  {
    title: "Mad Max: Fury Road",
    year: "2015",
    description: "In a post-apocalyptic wasteland, a woman rebels against a tyrannical ruler in search for her homeland with the aid of a group of female prisoners, a psychotic worshiper, and a drifter named Max.",
    director: "George Miller",
    genres: ["Action", "Adventure", "Sci-Fi"],
    poster: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=400&auto=format&fit=crop"
  },
  {
    title: "Shutter Island",
    year: "2010",
    description: "Teddy Daniels and Chuck Aule, two US marshals, are sent to an asylum on a remote island in order to investigate the disappearance of a patient.",
    director: "Martin Scorsese",
    genres: ["Mystery", "Thriller"],
    poster: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=400&auto=format&fit=crop"
  },
  {
    title: "The Wolf of Wall Street",
    year: "2013",
    description: "Based on the true story of Jordan Belfort, from his rise to a wealthy stockbroker living the high life to his fall involving crime, corruption and the federal government.",
    director: "Martin Scorsese",
    genres: ["Biography", "Comedy", "Crime"],
    poster: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=400&auto=format&fit=crop"
  },
  {
    title: "Arrival",
    year: "2016",
    description: "A linguist works with the military to communicate with alien lifeforms after twelve mysterious spacecraft appear around the world.",
    director: "Denis Villeneuve",
    genres: ["Drama", "Mystery", "Sci-Fi"],
    poster: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&auto=format&fit=crop"
  },
  {
    title: "Everything Everywhere All at Once",
    year: "2022",
    description: "A middle-aged Chinese immigrant is swept up into an insane adventure in which she alone can save existence by exploring other universes and connecting with the lives she could have led.",
    director: "Daniel Kwan, Daniel Scheinert",
    genres: ["Action", "Adventure", "Comedy", "Sci-Fi"],
    poster: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&auto=format&fit=crop"
  },
  {
    title: "Inside Out 2",
    year: "2024",
    description: "Follow Riley, in her teenage years, encountering new emotions.",
    director: "Kelsey Mann",
    genres: ["Animation", "Adventure", "Comedy"],
    poster: "https://images.unsplash.com/photo-1608889175123-8ec330b86f84?w=400&auto=format&fit=crop"
  }
];

function getFallbackResults(query: string) {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) return [];

  // Filter predefined popular movies
  const matched = POPULAR_MOVIES_FALLBACK.filter(
    (movie) =>
      movie.title.toLowerCase().includes(normalizedQuery) ||
      movie.director.toLowerCase().includes(normalizedQuery) ||
      movie.genres.some((g) => g.toLowerCase().includes(normalizedQuery))
  );

  // If we found exact or partial matches in the predefined list, return them
  if (matched.length > 0) {
    return matched.slice(0, 10).map((m) => ({
      ...m,
      trailerUrl: (m as any).trailerUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent(m.title + " " + m.year + " official trailer")}`
    }));
  }

  // Do not dynamically generate fictional candidates anymore to prevent hallucinated mock data.
  return [];
}

// Movie Search Endpoint - Connects to our robust TMDB movie database
app.get("/api/movies/search", async (req, res) => {
  const query = req.query.q as string;
  if (!query || query.trim().length < 2) {
    return res.json([]);
  }

  const token = (process.env.TMDB_READ_ACCESS_TOKEN?.trim() || "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI1OTlkOTkyNWViOTRiNWFkMTAyNTE4OWVkMjNhYjg0NyIsIm5iZiI6MTc4NDEyNjI4Ny41NzQwMDAxLCJzdWIiOiI2YTU3OWI0ZmZiYzZlNGQ5MmNhN2MwN2UiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.qo8vahApLzLVN3cnnO3kWTDqS1YdoVnG96LUz56ewPI").trim();
  const apiKey = (process.env.TMDB_API_KEY?.trim() || "599d9925eb94b5ad1025189ed23ab847").trim();

  try {
    const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`;
    
    const headers: Record<string, string> = {
      "accept": "application/json"
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const searchRes = await fetch(searchUrl, { headers });
    
    if (searchRes.status === 401) {
      console.warn("[Cinevote AI Warning] TMDB API returned 401 (Unauthorized). Falling back to standard database.");
      const results = getFallbackResults(query);
      return res.json(results);
    }

    if (!searchRes.ok) {
      throw new Error(`TMDB API Search failed with status: ${searchRes.status}`);
    }
    const searchData: any = await searchRes.json();

    if (!searchData.results || !Array.isArray(searchData.results) || searchData.results.length === 0) {
      console.warn(`TMDB returned no results. Trying local fallback.`);
      const results = getFallbackResults(query);
      return res.json(results);
    }

    // Get up to 5 best matches and fetch full details (genres, credits, directors) for each
    const candidates = searchData.results.slice(0, 5);
    const detailedMovies = await Promise.all(
      candidates.map(async (movie: any) => {
        try {
          const detailUrl = `https://api.themoviedb.org/3/movie/${movie.id}?api_key=${encodeURIComponent(apiKey)}&append_to_response=credits&language=en-US`;
          const detailRes = await fetch(detailUrl, { headers });
          if (!detailRes.ok) {
            return null;
          }
          const detailData: any = await detailRes.json();

          const title = detailData.title || movie.title || "Untitled Movie";
          const releaseDate = detailData.release_date || movie.release_date || "";
          const year = releaseDate ? releaseDate.substring(0, 4) : "N/A";
          
          // Extract directors from credits crew
          const directors = detailData.credits?.crew
            ? detailData.credits.crew.filter((member: any) => member.job === "Director").map((d: any) => d.name)
            : [];
          const director = directors.length > 0 ? directors.join(", ") : "Unknown Director";
          
          const description = detailData.overview || movie.overview || `A cinematic production released in ${year}.`;
          
          // Extract genres
          const genres = detailData.genres && Array.isArray(detailData.genres) && detailData.genres.length > 0
            ? detailData.genres.map((g: any) => g.name)
            : ["Drama"];

          // Build TMDB secure image path
          const poster = detailData.poster_path
            ? `https://image.tmdb.org/t/p/w500${detailData.poster_path}`
            : "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&auto=format&fit=crop";

          return {
            title,
            year,
            description,
            director,
            genres,
            poster,
            trailerUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(title + " " + year + " official trailer")}`
          };
        } catch (detailErr) {
          console.error(`Failed to fetch TMDB details for Movie ID ${movie.id}:`, detailErr);
          const releaseDate = movie.release_date || "";
          const year = releaseDate ? releaseDate.substring(0, 4) : "N/A";
          return {
            title: movie.title || "Untitled Movie",
            year,
            description: movie.overview || `A cinematic production released in ${year}.`,
            director: "Unknown Director",
            genres: ["Drama"],
            poster: movie.poster_path
              ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
              : "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&auto=format&fit=crop",
            trailerUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title + " " + year + " official trailer")}`
          };
        }
      })
    );

    const finalMovies = detailedMovies.filter(Boolean);
    if (finalMovies.length === 0) {
      return res.json(getFallbackResults(query));
    }
    return res.json(finalMovies);

  } catch (err) {
    console.error("Error fetching from TMDB API, using fallback search:", err);
    return res.json(getFallbackResults(query));
  }
});

// Configure Vite or Static files
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server middleware mounted.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static production build from dist.");
  }
}

setupVite().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
