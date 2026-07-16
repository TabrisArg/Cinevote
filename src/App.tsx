import { useState, useEffect, useRef, FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Film, 
  Vote, 
  Plus, 
  Minus, 
  User as UserIcon, 
  Share2, 
  ArrowLeft, 
  Trash2, 
  PlusCircle, 
  Check, 
  MessageSquare, 
  Smile, 
  Frown, 
  Search, 
  Sparkles, 
  Users, 
  Link2,
  Lock,
  LogOut,
  Sliders,
  Tv,
  AlertTriangle,
  Clock,
  Ticket,
  Clapperboard
} from "lucide-react";
import { db, auth, googleProvider } from "./firebase";
import { signInWithPopup, signInWithRedirect, getRedirectResult, signOut, User } from "firebase/auth";
import { 
  collection, 
  doc, 
  addDoc, 
  setDoc,
  deleteDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  getDoc
} from "firebase/firestore";
import { VotingList, MovieSuggestion, Argument } from "./types";
import { getOrCreateSessionId, getOrCreateAlias, saveAlias } from "./utils/names";
import { fetchMoviesFromTMDB } from "./movieService";

export default function App() {
  // Navigation & Routing State
  const [currentRoute, setCurrentRoute] = useState<{ path: string; listId?: string }>({ path: "dashboard" });
  
  // User Authentication State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Session & Alias Info
  const [sessionId, setSessionId] = useState("");
  const [alias, setAlias] = useState("");
  const [isEditingAlias, setIsEditingAlias] = useState(false);
  const [tempAlias, setTempAlias] = useState("");

  // Create List Form State
  const [newListTitle, setNewListTitle] = useState("");
  const [newListDesc, setNewListDesc] = useState("");
  const [isCreatingList, setIsCreatingList] = useState(false);

  // List Dashboard Data State
  const [myCreatedLists, setMyCreatedLists] = useState<VotingList[]>([]);
  const [recentListIds, setRecentListIds] = useState<string[]>([]);
  const [recentListsData, setRecentListsData] = useState<VotingList[]>([]);

  // Join Room Input State
  const [joinRoomId, setJoinRoomId] = useState("");

  // Room Detail State
  const [activeList, setActiveList] = useState<VotingList | null>(null);
  const [movieSuggestions, setMovieSuggestions] = useState<MovieSuggestion[]>([]);
  const [watchedMovies, setWatchedMovies] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"active" | "watched">("active");
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number; isFrozen: boolean; isOver: boolean } | null>(null);
  const [loadingActiveList, setLoadingActiveList] = useState(false);

  // Movie Search State (Suggestion Form)
  const [movieQuery, setMovieQuery] = useState("");
  const [movieResults, setMovieResults] = useState<any[]>([]);
  const [searchingMovies, setSearchingMovies] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<any | null>(null);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Argument input map (movieId -> pro/con text)
  const [argumentInputs, setArgumentInputs] = useState<{ [key: string]: { type: "pro" | "con"; text: string } }>({});

  // Movie Editing State
  const [editingMovieId, setEditingMovieId] = useState<string | null>(null);
  const [isEditingWatched, setIsEditingWatched] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editYear, setEditYear] = useState("");
  const [editDirector, setEditDirector] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editGenresText, setEditGenresText] = useState("");
  const [countdownInput, setCountdownInput] = useState("");

  // Room Rules State
  const [isEditingRules, setIsEditingRules] = useState(false);
  const [rulesInput, setRulesInput] = useState("");

  // UI Notification Toasts
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Auto-clear error messages after 30 seconds
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => {
        setErrorMessage("");
      }, 30000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  // Synchronize rulesInput when activeList changes
  useEffect(() => {
    if (activeList) {
      setRulesInput(activeList.rules || "");
    } else {
      setRulesInput("");
    }
  }, [activeList?.id, activeList?.rules]);

  // Helper to extract embeddable YouTube link
  const getYoutubeEmbedUrl = (url: string) => {
    if (!url) return null;
    if (url.includes("results?search_query")) return null;
    
    let videoId = "";
    if (url.includes("youtube.com/watch")) {
      try {
        const parts = url.split("?")[1];
        const urlParams = new URLSearchParams(parts);
        videoId = urlParams.get("v") || "";
      } catch (e) {}
    } else if (url.includes("youtu.be/")) {
      try {
        videoId = url.split("youtu.be/")[1]?.split("?")[0] || "";
      } catch (e) {}
    } else if (url.includes("youtube.com/embed/")) {
      try {
        videoId = url.split("youtube.com/embed/")[1]?.split("?")[0] || "";
      } catch (e) {}
    }
    
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}`;
    }
    return null;
  };

  // Initializing session, auth, and parsing hash routing on mount
  useEffect(() => {
    // Session setup
    const sess = getOrCreateSessionId();
    const currentAlias = getOrCreateAlias();
    setSessionId(sess);
    setAlias(currentAlias);
    setTempAlias(currentAlias);

    // Auth subscription
    const unsubscribeAuth = auth.onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
    });

    // Capture redirect sign-in result (important fallback for Netlify COOP issues)
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          console.log("Redirect login successful:", result.user.displayName);
        }
      })
      .catch((err) => {
        console.warn("Redirect login resolution error (or none pending):", err);
      });

    // Hash routing
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith("#/list/")) {
        const listId = hash.replace("#/list/", "");
        setCurrentRoute({ path: "list", listId });
      } else {
        setCurrentRoute({ path: "dashboard" });
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    // Trigger on initial render
    handleHashChange();

    // Load recent list IDs from localStorage
    const savedRecents = JSON.parse(localStorage.getItem("cinevote_recent_rooms") || "[]");
    setRecentListIds(savedRecents);

    return () => {
      unsubscribeAuth();
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  // Fetch lists created by current user
  useEffect(() => {
    if (!user) {
      setMyCreatedLists([]);
      return;
    }

    const q = query(
      collection(db, "lists"),
      where("creatorId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lists: VotingList[] = [];
      snapshot.forEach((doc) => {
        lists.push({ id: doc.id, ...doc.data() } as VotingList);
      });
      setMyCreatedLists(lists);
    }, (error) => {
      console.error("Error fetching creator lists:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Sync recent lists data
  useEffect(() => {
    if (recentListIds.length === 0) {
      setRecentListsData([]);
      return;
    }

    // Since we cannot run query(where("id", "in", recentListIds)) in standard firestore easily onSnapshot,
    // let's subscribe to individual lists
    const unsubscribes = recentListIds.map((id) => {
      return onSnapshot(doc(db, "lists", id), (docSnapshot) => {
        if (docSnapshot.exists()) {
          setRecentListsData((prev) => {
            const listObj = { id: docSnapshot.id, ...docSnapshot.data() } as VotingList;
            const filtered = prev.filter((item) => item.id !== id);
            return [...filtered, listObj].sort((a, b) => {
              const timeA = a.createdAt?.seconds || (a.createdAt as any)?.seconds || 0;
              const timeB = b.createdAt?.seconds || (b.createdAt as any)?.seconds || 0;
              return timeB - timeA;
            });
          });
        }
      }, (error) => {
        console.warn(`Error listening to recent list ${id}:`, error);
      });
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [recentListIds]);

  // Room Listener (when currentRoute.path is 'list' and has listId)
  useEffect(() => {
    if (currentRoute.path !== "list" || !currentRoute.listId) {
      setActiveList(null);
      setMovieSuggestions([]);
      setWatchedMovies([]);
      return;
    }

    const listId = currentRoute.listId;
    setLoadingActiveList(true);

    // Save room ID to recents in localStorage
    setRecentListIds((prev) => {
      const updated = [listId, ...prev.filter((id) => id !== listId)].slice(0, 10);
      localStorage.setItem("cinevote_recent_rooms", JSON.stringify(updated));
      return updated;
    });

    // 1. Listen to Voting List metadata
    const unsubList = onSnapshot(doc(db, "lists", listId), (docSnapshot) => {
      if (docSnapshot.exists()) {
        setActiveList({ id: docSnapshot.id, ...docSnapshot.data() } as VotingList);
      } else {
        setErrorMessage("This voting list doesn't exist or has been deleted.");
        setCurrentRoute({ path: "dashboard" });
        window.location.hash = "";
      }
      setLoadingActiveList(false);
    }, (err) => {
      console.error("Error listening to list:", err);
      setLoadingActiveList(false);
    });

    // 2. Listen to Movie suggestions inside list
    const moviesQuery = query(
      collection(db, "lists", listId, "movies"),
      orderBy("createdAt", "desc")
    );

    const unsubMovies = onSnapshot(moviesQuery, (snapshot) => {
      const suggestions: MovieSuggestion[] = [];
      snapshot.forEach((doc) => {
        suggestions.push({ id: doc.id, ...doc.data() } as MovieSuggestion);
      });
      setMovieSuggestions(suggestions);
    }, (err) => {
      console.error("Error listening to movies:", err);
    });

    // 3. Listen to Watched movies inside list
    const watchedQuery = query(
      collection(db, "lists", listId, "watched"),
      orderBy("watchedAt", "desc")
    );

    const unsubWatched = onSnapshot(watchedQuery, (snapshot) => {
      const watched: any[] = [];
      snapshot.forEach((doc) => {
        watched.push({ id: doc.id, ...doc.data() });
      });
      setWatchedMovies(watched);
    }, (err) => {
      console.error("Error listening to watched movies:", err);
    });

    return () => {
      unsubList();
      unsubMovies();
      unsubWatched();
    };
  }, [currentRoute.path, currentRoute.listId]);

  // Helper to trigger the transition once countdown expires
  const triggerReleaseTransition = async () => {
    if (!activeList || !activeList.releaseTime || movieSuggestions.length === 0) return;
    
    const listId = activeList.id;

    try {
      // Find the movie with the highest votes
      const sorted = [...movieSuggestions].sort((a, b) => {
        const votesA = a.voterIds?.length || 0;
        const votesB = b.voterIds?.length || 0;
        if (votesB !== votesA) return votesB - votesA;
        // Tie-breaker: older suggestion first
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeA - timeB;
      });

      const topMovie = sorted[0];
      if (!topMovie) return;

      // 1. Instantly update list document to clear releaseTime so no double triggers happen
      const listRef = doc(db, "lists", listId);
      await updateDoc(listRef, {
        releaseTime: null,
        lastReleasedMovieId: topMovie.id
      });

      // 2. Add to watched collection
      const watchedRef = doc(db, "lists", listId, "watched", topMovie.id);
      await setDoc(watchedRef, {
        title: topMovie.title,
        year: topMovie.year,
        description: topMovie.description,
        poster: topMovie.poster,
        director: topMovie.director || "",
        genres: topMovie.genres || [],
        trailerUrl: topMovie.trailerUrl || "",
        suggestedBy: topMovie.suggestedBy,
        suggestedById: topMovie.suggestedById,
        voterIds: topMovie.voterIds || [],
        watchedAt: serverTimestamp(),
        originalMovieId: topMovie.id
      });

      // 3. Delete from active movies
      const movieRef = doc(db, "lists", listId, "movies", topMovie.id);
      await deleteDoc(movieRef);

      console.log("Release transition successful for top movie:", topMovie.title);
    } catch (err) {
      console.error("Error during release transition:", err);
    }
  };

  // Live countdown ticker
  useEffect(() => {
    if (!activeList?.releaseTime) {
      setTimeLeft(null);
      return;
    }

    const checkTime = () => {
      const deadline = new Date(activeList.releaseTime!).getTime();
      const now = Date.now();
      const difference = deadline - now;

      if (difference <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, isFrozen: true, isOver: true });
        triggerReleaseTransition();
      } else {
        const totalHours = Math.floor(difference / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        const isFrozen = difference <= 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        setTimeLeft({ hours: totalHours, minutes, seconds, isFrozen, isOver: false });
      }
    };

    checkTime();
    const interval = setInterval(checkTime, 1000);

    return () => clearInterval(interval);
  }, [activeList?.releaseTime, movieSuggestions, activeList]);

  // Debounced Movie Search API query with browser-to-TMDB fallback for static hosting deployments
  useEffect(() => {
    if (movieQuery.trim().length < 2) {
      setMovieResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setSearchingMovies(true);
      
      // Determine if there is an Express backend based on current hosting context
      const isCloudRun = window.location.hostname.endsWith(".run.app");
      const isLocalhostBackend = window.location.hostname === "localhost" && window.location.port === "3000";
      const hasBackend = isCloudRun || isLocalhostBackend;

      if (!hasBackend) {
        // Direct browser TMDB search bypasses /api requests on static hosts (like Netlify) to avoid 404s
        try {
          const data = await fetchMoviesFromTMDB(movieQuery);
          setMovieResults(data);
        } catch (err) {
          console.error("Direct TMDB API fallback search failed:", err);
          setMovieResults([]);
        } finally {
          setSearchingMovies(false);
        }
        return;
      }

      try {
        const response = await fetch(`/api/movies/search?q=${encodeURIComponent(movieQuery)}`);
        const contentType = response.headers.get("content-type");
        if (response.ok && contentType && contentType.includes("application/json")) {
          const data = await response.json();
          setMovieResults(Array.isArray(data) ? data : []);
        } else {
          // If response not ok or not json (like Netlify's /* redirect), fall back to client-side TMDB call
          const data = await fetchMoviesFromTMDB(movieQuery);
          setMovieResults(data);
        }
      } catch (err) {
        console.warn("Express API failed, falling back to direct TMDB API browser search:", err);
        try {
          const data = await fetchMoviesFromTMDB(movieQuery);
          setMovieResults(data);
        } catch (fallbackErr) {
          console.error("Direct TMDB API fallback search also failed:", fallbackErr);
          setMovieResults([]);
        }
      } finally {
        setSearchingMovies(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [movieQuery]);

  // Auth Operations
  const handleGoogleLogin = async () => {
    try {
      setAuthLoading(true);
      setErrorMessage(null);
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.warn("signInWithPopup failed, trying redirect sign-in as fallback:", err);
      // Fallback automatically to signInWithRedirect for strict COOP environments (e.g. Netlify/iframes)
      try {
        await signInWithRedirect(auth, googleProvider);
      } catch (redirectErr: any) {
        console.error("Redirect login failed as well:", redirectErr);
        if (redirectErr.code === "auth/unauthorized-domain") {
          const currentHost = window.location.hostname;
          setErrorMessage(
            `Google Sign-In is blocked because this domain (${currentHost}) is not authorized. ` +
            `To fix this: Go to Firebase Console -> Authentication -> Settings -> Authorized domains, ` +
            `and add "${currentHost}" to the list of authorized domains.`
          );
        } else {
          setErrorMessage(`Could not sign in with Google: ${redirectErr.message || "Please try again."}`);
        }
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // Create List Operation
  const handleCreateList = async (e: FormEvent) => {
    e.preventDefault();
    if (!newListTitle.trim()) return;

    if (!user) {
      setErrorMessage("You must sign in with Google to create a collaborative list.");
      return;
    }

    setIsCreatingList(true);
    try {
      const listDoc = await addDoc(collection(db, "lists"), {
        title: newListTitle.trim(),
        description: newListDesc.trim(),
        creatorId: user.uid,
        creatorName: user.displayName || "Anonymous Creator",
        creatorEmail: user.email || "",
        createdAt: serverTimestamp()
      });

      setNewListTitle("");
      setNewListDesc("");
      
      // Navigate to list
      window.location.hash = `#/list/${listDoc.id}`;
    } catch (err) {
      console.error("Failed to create list:", err);
      setErrorMessage("Failed to create the room. Please check your network connection.");
    } finally {
      setIsCreatingList(false);
    }
  };

  // Add Suggestion Operation
  const handleAddMovieSuggestion = async () => {
    if (!selectedMovie || !currentRoute.listId) return;

    // Check if the selected movie is already in the watched list
    const isAlreadyWatched = watchedMovies.some(
      (m) => m.title.trim().toLowerCase() === selectedMovie.title.trim().toLowerCase() &&
             String(m.year) === String(selectedMovie.year)
    );
    if (isAlreadyWatched) {
      setErrorMessage(`"${selectedMovie.title}" is already in the watched list for this room and cannot be suggested again!`);
      return;
    }

    try {
      const voterId = user?.uid || sessionId;

      // If they haven't logged in (!user), they can only vote for ONE movie.
      // Since suggesting a movie automatically self-votes, let's clear their vote from all other movies.
      if (!user) {
        const otherMoviesVoted = movieSuggestions.filter((m) => m.voterIds?.includes(voterId));
        for (const otherMovie of otherMoviesVoted) {
          const otherMovieRef = doc(db, "lists", currentRoute.listId, "movies", otherMovie.id);
          await updateDoc(otherMovieRef, {
            voterIds: arrayRemove(voterId)
          });
        }
      }

      await addDoc(collection(db, "lists", currentRoute.listId, "movies"), {
        title: selectedMovie.title,
        year: selectedMovie.year,
        description: selectedMovie.description,
        poster: selectedMovie.poster,
        director: selectedMovie.director || "",
        genres: selectedMovie.genres || [],
        trailerUrl: selectedMovie.trailerUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent(selectedMovie.title + " " + selectedMovie.year + " official trailer")}`,
        suggestedBy: alias,
        suggestedById: voterId,
        createdAt: serverTimestamp(),
        voterIds: [voterId], // Automatic self vote for their own suggestion
        pros: [],
        cons: []
      });

      // Reset
      setSelectedMovie(null);
      setMovieQuery("");
      setMovieResults([]);
    } catch (err) {
      console.error("Failed to add movie:", err);
      setErrorMessage("Could not add suggestion to the list.");
    }
  };

  // Movie Update Operation (Edit Details)
  const handleUpdateMovieSuggestion = async (movieId: string) => {
    if (!currentRoute.listId || !editTitle.trim()) return;

    try {
      const movieRef = doc(db, "lists", currentRoute.listId, "movies", movieId);
      const parsedGenres = editGenresText
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean);

      await updateDoc(movieRef, {
        title: editTitle.trim(),
        year: editYear.trim(),
        director: editDirector.trim(),
        description: editDescription.trim(),
        genres: parsedGenres
      });

      setEditingMovieId(null);
    } catch (err) {
      console.error("Failed to update suggestion:", err);
      setErrorMessage("Could not update the movie details.");
    }
  };

  // Admin Action: Log a movie directly to Watched History
  const handleLogMovieAsWatched = async () => {
    if (!selectedMovie || !currentRoute.listId) return;

    try {
      const listId = currentRoute.listId;
      const watchedRef = collection(db, "lists", listId, "watched");
      
      await addDoc(watchedRef, {
        title: selectedMovie.title,
        year: selectedMovie.year,
        description: selectedMovie.description,
        poster: selectedMovie.poster,
        director: selectedMovie.director || "",
        genres: selectedMovie.genres || [],
        trailerUrl: selectedMovie.trailerUrl || "",
        suggestedBy: user?.displayName || "Admin",
        suggestedById: user?.uid || sessionId,
        voterIds: [],
        watchedAt: serverTimestamp()
      });

      // Reset
      setSelectedMovie(null);
      setMovieQuery("");
      setMovieResults([]);
    } catch (err) {
      console.error("Failed to log movie as watched:", err);
      setErrorMessage("Could not log the movie to watched history.");
    }
  };

  // Admin Action: Update watched movie details
  const handleUpdateWatchedMovie = async (movieId: string) => {
    if (!currentRoute.listId || !editTitle.trim()) return;

    try {
      const movieRef = doc(db, "lists", currentRoute.listId, "watched", movieId);
      const parsedGenres = editGenresText
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean);

      await updateDoc(movieRef, {
        title: editTitle.trim(),
        year: editYear.trim(),
        director: editDirector.trim(),
        description: editDescription.trim(),
        genres: parsedGenres
      });

      setEditingMovieId(null);
      setIsEditingWatched(false);
    } catch (err) {
      console.error("Failed to update watched movie:", err);
      setErrorMessage("Could not update the watched movie details.");
    }
  };

  // Admin Action: Delete a movie from Watched History
  const handleDeleteWatchedMovie = async (movieId: string) => {
    if (!currentRoute.listId) return;
    if (!window.confirm("Are you sure you want to remove this movie from the watched history?")) return;

    try {
      const movieRef = doc(db, "lists", currentRoute.listId, "watched", movieId);
      await deleteDoc(movieRef);
    } catch (err) {
      console.error("Failed to delete watched movie:", err);
      setErrorMessage("Could not remove the movie from watched history.");
    }
  };

  // Admin Action: Set Release Countdown
  const handleSetReleaseCountdown = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentRoute.listId || !countdownInput) return;

    const selectedTime = new Date(countdownInput).getTime();
    if (selectedTime <= Date.now()) {
      setErrorMessage("Release time must be in the future!");
      return;
    }

    try {
      const listRef = doc(db, "lists", currentRoute.listId);
      await updateDoc(listRef, {
        releaseTime: new Date(countdownInput).toISOString()
      });
      setCountdownInput("");
    } catch (err) {
      console.error("Failed to set release countdown:", err);
      setErrorMessage("Could not schedule the release countdown.");
    }
  };

  // Admin Action: Cancel Release Countdown
  const handleCancelReleaseCountdown = async () => {
    if (!currentRoute.listId) return;
    if (!window.confirm("Are you sure you want to cancel the scheduled release countdown? This will unfreeze voting.")) return;

    try {
      const listRef = doc(db, "lists", currentRoute.listId);
      await updateDoc(listRef, {
        releaseTime: null
      });
    } catch (err) {
      console.error("Failed to cancel release countdown:", err);
      setErrorMessage("Could not cancel the release countdown.");
    }
  };

  // Deleting List Room (only accessible if logged in user matches the creator)
  const handleDeleteListRoom = async (listId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this discussion and voting room?")) return;

    try {
      await deleteDoc(doc(db, "lists", listId));
      setRecentListIds((prev) => {
        const filtered = prev.filter((id) => id !== listId);
        localStorage.setItem("cinevote_recent_rooms", JSON.stringify(filtered));
        return filtered;
      });
      if (currentRoute.path === "list" && currentRoute.listId === listId) {
        window.location.hash = "";
      }
    } catch (err) {
      console.error("Failed to delete list room:", err);
      setErrorMessage("Could not delete list room.");
    }
  };

  // Admin Action: Save custom rules for the room
  const handleSaveRules = async () => {
    if (!currentRoute.listId) return;
    try {
      const listRef = doc(db, "lists", currentRoute.listId);
      await updateDoc(listRef, {
        rules: rulesInput.trim()
      });
      setIsEditingRules(false);
    } catch (err) {
      console.error("Failed to save rules:", err);
      setErrorMessage("Could not save the room rules.");
    }
  };

  // Admin Action: Add/Remove Votes manually
  const handleAdminAddVote = async (movie: MovieSuggestion) => {
    if (!currentRoute.listId) return;
    try {
      const movieRef = doc(db, "lists", currentRoute.listId, "movies", movie.id);
      const uniqueAdminVoteId = `admin_vote_${Math.random().toString(36).substring(2, 9)}`;
      await updateDoc(movieRef, {
        voterIds: arrayUnion(uniqueAdminVoteId)
      });
    } catch (err) {
      console.error("Admin add vote error:", err);
      setErrorMessage("Failed to add vote.");
    }
  };

  const handleAdminRemoveVote = async (movie: MovieSuggestion) => {
    if (!currentRoute.listId) return;
    if (!movie.voterIds || movie.voterIds.length === 0) return;
    
    try {
      const movieRef = doc(db, "lists", currentRoute.listId, "movies", movie.id);
      const adminVote = movie.voterIds.find(id => id.startsWith("admin_vote_"));
      const voteToRemove = adminVote || movie.voterIds[movie.voterIds.length - 1];
      
      await updateDoc(movieRef, {
        voterIds: arrayRemove(voteToRemove)
      });
    } catch (err) {
      console.error("Admin remove vote error:", err);
      setErrorMessage("Failed to remove vote.");
    }
  };

  // Suggestion Actions (Vote, Pros & Cons Argument)
  const handleToggleVote = async (movie: MovieSuggestion) => {
    if (!currentRoute.listId) return;

    const isTopMovie = sortedMovieSuggestions[0]?.id === movie.id;
    if (timeLeft?.isFrozen && isTopMovie) {
      setErrorMessage("Voting on the next movie selection is frozen!");
      return;
    }

    const voterId = user?.uid || sessionId;
    const hasVoted = movie.voterIds?.includes(voterId);

    try {
      const movieRef = doc(db, "lists", currentRoute.listId, "movies", movie.id);
      
      if (hasVoted) {
        // Just remove the vote
        await updateDoc(movieRef, {
          voterIds: arrayRemove(voterId)
        });
      } else {
        // If they haven't logged in (!user), enforce they can only vote for ONE movie
        if (!user) {
          const otherMoviesVoted = movieSuggestions.filter(
            (m) => m.id !== movie.id && m.voterIds?.includes(voterId)
          );
          for (const otherMovie of otherMoviesVoted) {
            const otherMovieRef = doc(db, "lists", currentRoute.listId, "movies", otherMovie.id);
            await updateDoc(otherMovieRef, {
              voterIds: arrayRemove(voterId)
            });
          }
        }

        // Add vote to the clicked movie
        await updateDoc(movieRef, {
          voterIds: arrayUnion(voterId)
        });
      }
    } catch (err) {
      console.error("Failed to toggle vote:", err);
    }
  };

  const handleAddArgument = async (movieId: string) => {
    const input = argumentInputs[movieId];
    if (!input || !input.text.trim() || !currentRoute.listId) return;

    try {
      const argument: Argument = {
        id: "arg_" + Math.random().toString(36).substring(2, 11) + Date.now(),
        text: input.text.trim(),
        author: alias,
        authorId: user?.uid || sessionId,
        createdAt: Date.now()
      };

      const movieRef = doc(db, "lists", currentRoute.listId, "movies", movieId);
      
      if (input.type === "pro") {
        await updateDoc(movieRef, {
          pros: arrayUnion(argument)
        });
      } else {
        await updateDoc(movieRef, {
          cons: arrayUnion(argument)
        });
      }

      // Clear input
      setArgumentInputs((prev) => ({
        ...prev,
        [movieId]: { type: "pro", text: "" }
      }));
    } catch (err) {
      console.error("Failed to add argument:", err);
    }
  };

  const handleDeleteArgument = async (movie: MovieSuggestion, argument: Argument, type: "pro" | "con") => {
    if (!currentRoute.listId) return;

    try {
      const movieRef = doc(db, "lists", currentRoute.listId, "movies", movie.id);
      if (type === "pro") {
        await updateDoc(movieRef, {
          pros: arrayRemove(argument)
        });
      } else {
        await updateDoc(movieRef, {
          cons: arrayRemove(argument)
        });
      }
    } catch (err) {
      console.error("Failed to delete argument:", err);
    }
  };

  const handleDeleteMovieSuggestion = async (movieId: string) => {
    if (!currentRoute.listId || !window.confirm("Are you sure you want to remove this movie suggestion?")) return;

    try {
      await deleteDoc(doc(db, "lists", currentRoute.listId, "movies", movieId));
    } catch (err) {
      console.error("Failed to delete suggestion:", err);
    }
  };

  // Helper utility to copy room url
  const copyInviteLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  // Handle changing alias name
  const handleSaveAlias = (e: FormEvent) => {
    e.preventDefault();
    if (!tempAlias.trim()) return;
    saveAlias(tempAlias.trim());
    setAlias(tempAlias.trim());
    setIsEditingAlias(false);
  };

  // Handle manually joining a list room ID
  const handleJoinRoom = (e: FormEvent) => {
    e.preventDefault();
    if (!joinRoomId.trim()) return;
    window.location.hash = `#/list/${joinRoomId.trim()}`;
    setJoinRoomId("");
  };

  // Simple sorting logic for suggestions (Sort by Vote descending, then by suggestion date)
  const sortedMovieSuggestions = [...movieSuggestions].sort((a, b) => {
    const votesDiff = (b.voterIds?.length || 0) - (a.voterIds?.length || 0);
    if (votesDiff !== 0) return votesDiff;
    // Fallback: newest suggestions first (using seconds if available, otherwise 0)
    const timeA = a.createdAt?.seconds || (a.createdAt as any)?.seconds || 0;
    const timeB = b.createdAt?.seconds || (b.createdAt as any)?.seconds || 0;
    return timeB - timeA;
  });

  const isAdminOfRoom = !!(activeList && user && activeList.creatorId === user.uid);

  return (
    <div id="cinevote_app" className="min-h-screen cinema-curtains-bg text-zinc-100 flex flex-col antialiased">
      {/* GLOBAL TOAST ERROR MESSAGE */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-rose-500/90 text-white font-medium px-6 py-3 rounded-full shadow-lg border border-rose-400 backdrop-blur-md flex items-center gap-3 text-sm"
          >
            <span>{errorMessage}</span>
            <button 
              onClick={() => setErrorMessage("")}
              className="hover:bg-rose-600 rounded-full p-1 transition-colors text-white"
            >
              <Plus className="w-4 h-4 rotate-45" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* COPIED TOAST */}
      <AnimatePresence>
        {copiedNotification && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 50 }}
            className="fixed bottom-8 right-8 z-50 bg-amber-500 text-black font-extrabold px-6 py-3 rounded-full shadow-lg border border-amber-400 flex items-center gap-2"
          >
            <Check className="w-5 h-5 text-black stroke-[3]" />
            <span>Invite Link Copied!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER / NAVIGATION BAR */}
      <nav id="navbar" className="sticky top-0 z-40 backdrop-blur-md bg-zinc-950/80 border-b border-zinc-800/80 shadow-lg transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="#" className="flex items-center gap-2 group">
              <div className="bg-amber-500 p-2 rounded-lg shadow-md shadow-amber-500/15 group-hover:scale-105 transition-transform flex items-center justify-center">
                <Film className="w-5 h-5 text-black stroke-[2.5]" />
              </div>
              <div>
                <span className="font-extrabold text-lg tracking-tight text-white font-sans">
                  Cine<span className="text-amber-500 marquee-glow font-black">vote</span>
                </span>
                <span className="hidden sm:inline-block ml-2 text-xs text-zinc-400 border-l border-zinc-800 pl-2 font-medium">
                  Interactive Movie Voting
                </span>
              </div>
            </a>
          </div>

          <div className="flex items-center gap-4">
            {/* ALIAS EDIT BAR */}
            <div className="relative flex items-center bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-300 shadow-md">
              <UserIcon className="w-3.5 h-3.5 text-amber-500 mr-2" />
              {isEditingAlias ? (
                <form onSubmit={handleSaveAlias} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tempAlias}
                    onChange={(e) => setTempAlias(e.target.value)}
                    className="bg-stone-950 text-amber-500 border border-amber-500/30 rounded px-1.5 py-0.5 focus:outline-none focus:border-amber-400 text-xs w-36 font-semibold"
                    autoFocus
                    maxLength={25}
                  />
                  <button type="submit" className="text-amber-400 hover:text-amber-300 font-extrabold">
                    Save
                  </button>
                  <button type="button" onClick={() => setIsEditingAlias(false)} className="text-zinc-500 hover:text-zinc-400">
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-2">
                  <span>Voting as: <strong className="text-amber-400 font-bold">{alias}</strong></span>
                  <button 
                    onClick={() => {
                      setTempAlias(alias);
                      setIsEditingAlias(true);
                    }}
                    className="text-amber-300 hover:text-amber-400 text-[10px] font-extrabold uppercase tracking-wider"
                  >
                    Change
                  </button>
                </div>
              )}
            </div>

            {/* AUTH / GOOGLE SIGN-IN BUTTON */}
            {authLoading ? (
              <div className="w-8 h-8 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin" />
            ) : user ? (
              <div className="flex items-center gap-3">
                <img 
                  src={user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`} 
                  alt={user.displayName || "User"} 
                  className="w-8 h-8 rounded-full border border-amber-500/40"
                />
                <button 
                  onClick={handleLogout}
                  title="Sign Out of Google"
                  className="p-2 text-zinc-400 hover:text-amber-400 hover:bg-zinc-900 rounded-lg transition-all"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button 
                onClick={handleGoogleLogin}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black border border-amber-400 shadow-md font-extrabold px-3 py-1.5 rounded-lg text-xs transition-all"
              >
                <Lock className="w-3.5 h-3.5 text-black" />
                Sign in with Google
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* MAIN SCREEN ROUTING */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {currentRoute.path === "dashboard" ? (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="space-y-10"
            >
              {/* HERO INTRO */}
              <div className="text-center space-y-4 max-w-3xl mx-auto py-6">
                <h1 className="text-4xl sm:text-5xl font-serif font-black tracking-widest text-amber-400 marquee-glow leading-none">
                  CINEVOTE MOVIE ROOMS <br/>
                  <span className="text-white uppercase tracking-wider">PLATFORM</span>
                </h1>
                <p className="text-amber-100/80 text-sm sm:text-base max-w-2xl mx-auto font-medium font-serif italic">
                  Create custom watchlists, propose movies, cast your votes, and discuss pros and cons in real-time with your group.
                </p>
              </div>

              {/* RED VELVET CORDS DIVIDER */}
              <div className="flex items-center justify-center gap-1 my-4">
                <div className="w-3 h-3 rounded-full bg-amber-400 border border-amber-500 shadow-md flex-shrink-0" />
                <div className="h-1.5 velvet-rope flex-1 max-w-xs rounded-full" />
                <div className="w-3 h-3 rounded-full bg-amber-400 border border-amber-500 shadow-md flex-shrink-0" />
              </div>

              {/* THREE-STEP WORKFLOW CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="ticket-stub border border-amber-500/20 p-6 rounded-2xl space-y-3 shadow-xl relative overflow-hidden group hover:scale-[1.02] transition-all duration-300">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-500/5 to-transparent rounded-full" />
                  <div className="w-10 h-10 bg-amber-500 text-black font-black rounded-xl flex items-center justify-center border border-amber-400 font-mono text-base shadow-md">
                    01
                  </div>
                  <h3 className="font-serif font-black text-amber-400 text-lg uppercase tracking-wider">Create a Room</h3>
                  <p className="text-zinc-300 text-xs leading-relaxed font-medium">
                    Log in with Google to create a private movie room for movie nights, watchlists, or voting.
                  </p>
                </div>
                <div className="ticket-stub border border-amber-500/20 p-6 rounded-2xl space-y-3 shadow-xl relative overflow-hidden group hover:scale-[1.02] transition-all duration-300">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-500/5 to-transparent rounded-full" />
                  <div className="w-10 h-10 bg-amber-500 text-black font-black rounded-xl flex items-center justify-center border border-amber-400 font-mono text-base shadow-md">
                    02
                  </div>
                  <h3 className="font-serif font-black text-amber-400 text-lg uppercase tracking-wider">Share the Link</h3>
                  <p className="text-zinc-300 text-xs leading-relaxed font-medium">
                    Share your unique movie room code with friends. No logins or accounts are required for guests to join and participate!
                  </p>
                </div>
                <div className="ticket-stub border border-amber-500/20 p-6 rounded-2xl space-y-3 shadow-xl relative overflow-hidden group hover:scale-[1.02] transition-all duration-300">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-500/5 to-transparent rounded-full" />
                  <div className="w-10 h-10 bg-amber-500 text-black font-black rounded-xl flex items-center justify-center border border-amber-400 font-mono text-base shadow-md">
                    03
                  </div>
                  <h3 className="font-serif font-black text-amber-400 text-lg uppercase tracking-wider">Vote & Discuss</h3>
                  <p className="text-zinc-300 text-xs leading-relaxed font-medium">
                    Propose movies with automatic TMDB details, cast votes in real-time, and discuss pros and cons together before watching.
                  </p>
                </div>
              </div>

              {/* TWO COLUMN INTERACTION PANEL */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-4">
                {/* LEFT COLUMN: Create and Join Rooms */}
                <div className="lg:col-span-5 space-y-6">
                  {/* JOIN DIRECTLY FORM */}
                  <div className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800 p-6 rounded-2xl shadow-2xl space-y-4">
                    <h2 className="font-serif font-black text-amber-400 text-lg flex items-center gap-2 uppercase tracking-wider">
                      <Ticket className="w-5 h-5 text-amber-500" />
                      Join with Room Code
                    </h2>
                    <form onSubmit={handleJoinRoom} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter 20-character Room ID"
                        value={joinRoomId}
                        onChange={(e) => setJoinRoomId(e.target.value)}
                        className="flex-1 bg-zinc-950 text-zinc-100 placeholder-zinc-600 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500/50 font-mono font-medium"
                      />
                      <button 
                        type="submit"
                        className="bg-amber-500 hover:bg-amber-600 text-black font-black px-4 py-2.5 rounded-xl text-sm transition-all shadow-md active:scale-95 border border-amber-400"
                      >
                        Enter
                      </button>
                    </form>
                  </div>

                  {/* CREATE NEW ROOM FORM */}
                  <div className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800 p-6 rounded-2xl shadow-2xl space-y-4 relative">
                    <h2 className="font-serif font-black text-amber-400 text-lg flex items-center gap-2 uppercase tracking-wider">
                      <Clapperboard className="w-5 h-5 text-amber-500" />
                      Create a Movie Room
                    </h2>

                    {!user ? (
                      <div className="bg-zinc-950 border border-zinc-800/80 p-6 rounded-xl text-center space-y-4">
                        <Lock className="w-8 h-8 text-amber-500 mx-auto" />
                        <div className="space-y-1">
                          <h4 className="font-serif font-black text-amber-400 text-sm uppercase tracking-wider">Authentication Required</h4>
                          <p className="text-zinc-400 text-xs font-medium">To create and manage custom collaborative movie rooms, please sign in via Google.</p>
                        </div>
                        <button 
                          onClick={handleGoogleLogin}
                          className="w-full bg-amber-500 hover:bg-amber-600 text-black border border-amber-400 font-black py-2.5 px-4 rounded-xl text-sm transition-all shadow-lg flex items-center justify-center gap-2"
                        >
                          <Lock className="w-4 h-4 stroke-[2.5]" />
                          Sign in with Google
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleCreateList} className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-amber-500 uppercase tracking-wider">Topic / Title</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Scary Movie Night for Halloween" 
                            value={newListTitle}
                            onChange={(e) => setNewListTitle(e.target.value)}
                            required
                            className="w-full bg-zinc-950 text-zinc-100 placeholder-zinc-600 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500/50 font-semibold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-amber-500 uppercase tracking-wider">Description / Invitation Question</label>
                          <textarea 
                            placeholder="e.g. Add your favorite psychological thrillers and vote on which one we should screen!" 
                            value={newListDesc}
                            onChange={(e) => setNewListDesc(e.target.value)}
                            rows={3}
                            className="w-full bg-zinc-950 text-zinc-100 placeholder-zinc-600 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500/50 resize-none font-medium"
                          />
                        </div>

                        <button 
                          type="submit"
                          disabled={isCreatingList}
                          className="w-full bg-amber-500 hover:bg-amber-600 text-black font-black py-3 px-4 rounded-xl text-sm transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border border-amber-400"
                        >
                          {isCreatingList ? "Setting up movie room..." : "Create Movie Room"}
                          <Plus className="w-4 h-4 stroke-[2.5]" />
                        </button>
                      </form>
                    )}
                  </div>
                </div>

                {/* RIGHT COLUMN: Active / Visited Lists */}
                <div className="lg:col-span-7 space-y-6">
                  {/* CREATED LISTS (IF LOGGED IN) */}
                  {user && (
                    <div className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800 p-6 rounded-2xl shadow-2xl space-y-4">
                      <h2 className="font-serif font-black text-amber-400 text-lg flex items-center gap-2 uppercase tracking-wider">
                        <Tv className="w-5 h-5 text-amber-500" />
                        Rooms You Created
                      </h2>
                      {myCreatedLists.length === 0 ? (
                        <div className="text-center py-8 bg-zinc-950 rounded-xl border border-dashed border-zinc-800 p-4">
                          <p className="text-zinc-400 text-xs font-semibold">You haven't created any movie rooms yet.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-zinc-800 max-h-72 overflow-y-auto pr-1">
                          {myCreatedLists.map((list) => (
                            <div key={list.id} className="py-3 flex items-center justify-between group first:pt-0 last:pb-0">
                              <div className="space-y-1 flex-1 pr-4">
                                <a 
                                  href={`#/list/${list.id}`}
                                  className="font-bold text-zinc-100 hover:text-amber-400 text-sm block transition-colors line-clamp-1"
                                >
                                  {list.title}
                                </a>
                                {list.description && (
                                  <p className="text-zinc-400 text-xs line-clamp-1">{list.description}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <a 
                                  href={`#/list/${list.id}`}
                                  className="bg-amber-500 hover:bg-amber-600 text-black font-black px-3 py-1 rounded-lg text-xs transition-all border border-amber-400"
                                >
                                  Enter
                                </a>
                                <button 
                                  onClick={() => handleDeleteListRoom(list.id)}
                                  className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-zinc-850 rounded-lg transition-all"
                                  title="Delete room"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* RECENTLY VISITED ROOMS */}
                  <div className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800 p-6 rounded-2xl shadow-2xl space-y-4">
                    <h2 className="font-serif font-black text-amber-400 text-lg flex items-center gap-2 uppercase tracking-wider">
                      <Users className="w-5 h-5 text-amber-500" />
                      Recently Visited Rooms
                    </h2>
                    {recentListsData.length === 0 ? (
                      <div className="text-center py-8 bg-zinc-950 rounded-xl border border-dashed border-zinc-800 p-4">
                        <p className="text-zinc-400 text-xs font-semibold">No active rooms in your history.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-1">
                        {recentListsData.map((list) => (
                          <div 
                            key={list.id} 
                            className="bg-zinc-900/30 border border-zinc-800 hover:border-amber-500/30 p-4 rounded-xl flex flex-col justify-between transition-all group shadow-md"
                          >
                            <div className="space-y-1.5">
                              <a 
                                href={`#/list/${list.id}`}
                                className="font-serif font-black text-amber-300 hover:text-amber-400 text-xs block transition-all line-clamp-1 uppercase tracking-wider"
                              >
                                {list.title}
                              </a>
                              {list.description && (
                                <p className="text-zinc-300 text-[11px] line-clamp-2 leading-relaxed font-medium">{list.description}</p>
                              )}
                            </div>
                            <div className="mt-3 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                              <span className="truncate max-w-[100px]">By {list.creatorName}</span>
                              <a 
                                href={`#/list/${list.id}`}
                                className="text-amber-400 hover:text-amber-300 font-extrabold font-mono"
                              >
                                ENTER &rarr;
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            /* INDIVIDUAL LIST DISCUSSION / VOTING ROOM */
            <motion.div 
              key="list-room"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="space-y-8"
            >
              {loadingActiveList ? (
                <div className="py-24 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full border-4 border-sky-500/20 border-t-sky-500 animate-spin mx-auto" />
                  <p className="text-slate-400 text-sm font-semibold animate-pulse">Loading collaborative movie slate...</p>
                </div>
              ) : activeList ? (
                 <div className="space-y-8">
                  {/* ROOM HEADER / ACTION LINE */}
                  <div className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800 p-6 rounded-2xl shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-amber-500/5 to-transparent rounded-full" />
                    
                    <div className="space-y-2 flex-1">
                      <button 
                        onClick={() => {
                          window.location.hash = "";
                        }}
                        className="inline-flex items-center gap-1.5 text-xs text-amber-300 hover:text-amber-100 transition-colors bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg font-bold"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Lobby
                      </button>
                      <h1 className="text-2xl sm:text-3xl font-serif font-black text-amber-400 tracking-wider leading-none pt-2 uppercase marquee-glow">
                        {activeList.title}
                      </h1>
                      {activeList.description && (
                        <p className="text-zinc-300 text-xs sm:text-sm max-w-3xl leading-relaxed font-medium">{activeList.description}</p>
                      )}
                      <div className="flex items-center gap-3 pt-1 text-[11px] text-zinc-400 font-semibold uppercase tracking-widest">
                        <span>Created by: <strong className="text-amber-300 font-bold">{activeList.creatorName}</strong></span>
                        <span>&bull;</span>
                        <span className="font-mono text-amber-500/80">{activeList.id}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto shrink-0 border-t md:border-t-0 pt-4 md:pt-0 border-zinc-800">
                      <button 
                        onClick={copyInviteLink}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-black font-black px-4 py-2.5 rounded-xl text-xs transition-all shadow-md active:scale-95 border border-amber-400"
                      >
                        <Share2 className="w-4 h-4 text-black" />
                        Copy Invite Link
                      </button>
                    </div>
                  </div>

                  {/* ROOM RULES PANEL */}
                  <div className="bg-zinc-900/40 border border-zinc-800 p-5 rounded-2xl shadow-xl space-y-3 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <h3 className="font-serif font-black text-amber-400 text-sm sm:text-base uppercase tracking-widest flex items-center gap-2">
                        <Clapperboard className="w-4 h-4 text-amber-500" />
                        Room Rules
                      </h3>
                      {isAdminOfRoom && (
                        <button
                          onClick={() => {
                            setIsEditingRules(!isEditingRules);
                          }}
                          className="text-xs text-amber-300 hover:text-amber-200 font-extrabold uppercase tracking-wider bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 px-2 py-1 rounded"
                        >
                          {isEditingRules ? "Cancel" : "Edit Rules"}
                        </button>
                      )}
                    </div>
                    
                    {isEditingRules ? (
                      <div className="space-y-3">
                        <textarea
                          value={rulesInput}
                          onChange={(e) => setRulesInput(e.target.value)}
                          placeholder="Write the rules for this room (e.g. Max 3 suggestions per guest, no horror movies...)"
                          rows={3}
                          className="w-full bg-zinc-950 text-zinc-100 placeholder-zinc-600 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500/50 resize-none font-semibold"
                        />
                        <div className="flex justify-end">
                          <button
                            onClick={handleSaveRules}
                            className="bg-amber-500 hover:bg-amber-600 text-black font-black px-4 py-2 rounded-xl text-xs border border-amber-400 shadow-md"
                          >
                            Save Rules
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-medium">
                        {activeList.rules ? activeList.rules : "No rules have been set for this movie room yet."}
                      </p>
                    )}
                  </div>

                  {/* LIVE TIMER CARD */}
                  {activeList.releaseTime && timeLeft && (
                    <div className={`border p-6 rounded-2xl shadow-xl relative overflow-hidden transition-all ${
                      timeLeft.isFrozen 
                        ? "bg-amber-950/40 border-amber-500/40 ring-1 ring-amber-400/20" 
                        : "bg-zinc-900/40 border-zinc-800"
                    }`}>
                      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-amber-500/10 to-transparent rounded-full" />
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {timeLeft.isFrozen ? (
                              <span className="inline-flex items-center gap-1 bg-amber-500 text-black text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full animate-pulse shadow-sm border border-amber-300">
                                <Lock className="w-3 h-3 stroke-[3]" />
                                Voting Locked on #1
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-amber-600 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm">
                                <Clock className="w-3 h-3 stroke-[3]" />
                                Countdown Active
                              </span>
                            )}
                            <span className="text-xs text-zinc-300 font-semibold">
                              Scheduled watch time: <strong className="text-amber-400 font-bold">{new Date(activeList.releaseTime).toLocaleString()}</strong>
                            </span>
                          </div>

                          <h3 className="font-serif font-black text-amber-300 text-base leading-snug uppercase tracking-wider">
                            {timeLeft.isFrozen 
                              ? "The voting has locked! The chosen movie is highlighted below." 
                              : "Voting locks 24 hours before the scheduled watch time."}
                          </h3>
                        </div>

                        {/* TIMER NUMBERS */}
                        <div className="flex items-center gap-4 shrink-0">
                          <div className="flex gap-2">
                            <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-center min-w-[50px] shadow-lg">
                              <span className="block font-serif font-black text-amber-400 text-xl tracking-wider">
                                {String(timeLeft.hours).padStart(2, '0')}
                              </span>
                              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Hrs</span>
                            </div>
                            <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-center min-w-[50px] shadow-lg">
                              <span className="block font-serif font-black text-amber-400 text-xl tracking-wider">
                                {String(timeLeft.minutes).padStart(2, '0')}
                              </span>
                              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Min</span>
                            </div>
                            <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-center min-w-[50px] shadow-lg">
                              <span className="block font-serif font-black text-amber-400 text-xl tracking-wider">
                                {String(timeLeft.seconds).padStart(2, '0')}
                              </span>
                              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Sec</span>
                            </div>
                          </div>

                          {isAdminOfRoom && (
                            <button
                              onClick={handleCancelReleaseCountdown}
                              className="bg-zinc-950 hover:bg-zinc-900 text-amber-400 hover:text-amber-300 border border-zinc-800 font-extrabold px-3 py-2 rounded-xl text-xs transition-all shadow-md"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ADMIN COUNTDOWN SCHEDULER PANEL */}
                  {!activeList.releaseTime && isAdminOfRoom && (
                    <div className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800 p-5 rounded-2xl shadow-xl space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <h4 className="font-serif font-black text-amber-400 text-sm flex items-center gap-2 uppercase tracking-wider">
                            <Clock className="w-4 h-4 text-amber-500" />
                            Schedule a Voting Deadline
                          </h4>
                          <p className="text-xs text-zinc-300 font-medium font-serif italic">
                            Schedule the voting deadline date & time. Voting will lock 24 hours before this deadline.
                          </p>
                        </div>
                      </div>
                      <form onSubmit={handleSetReleaseCountdown} className="flex flex-wrap items-center gap-3 pt-1">
                        <input
                          type="datetime-local"
                          required
                          value={countdownInput}
                          onChange={(e) => setCountdownInput(e.target.value)}
                          className="bg-zinc-950 text-zinc-100 border border-zinc-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500/50 font-semibold"
                        />
                        <button
                          type="submit"
                          className="bg-amber-500 hover:bg-amber-600 text-black font-black px-4 py-2 rounded-xl text-xs transition-all shadow-md border border-amber-400"
                        >
                          Start Countdown
                        </button>
                      </form>
                    </div>
                  )}

                  {/* ROOM MAIN TWO-COLUMN SPLIT */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* LEFT PANEL: Propose a Movie Suggestion & Watched History */}
                    <div className="lg:col-span-4 space-y-6">
                      <div className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800 p-6 rounded-2xl shadow-2xl space-y-4">
                        <h3 className="font-serif font-black text-amber-400 text-base flex items-center gap-2 uppercase tracking-widest">
                          <PlusCircle className="w-5 h-5 text-amber-500" />
                          Suggest a Movie
                        </h3>
                        <p className="text-xs text-stone-300 leading-relaxed font-medium font-serif italic">
                          Type a movie title below. We'll automatically search TMDB to load high-resolution posters and synopsis details!
                        </p>

                        {/* Search input with live autocomplete dropdown */}
                        <div className="space-y-1.5 relative">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500/60" />
                            <input
                              type="text"
                              placeholder="Search e.g. Interstellar, Casablanca..."
                              value={movieQuery}
                              onChange={(e) => {
                                setMovieQuery(e.target.value);
                                setShowSearchDropdown(true);
                              }}
                              onFocus={() => setShowSearchDropdown(true)}
                              className="w-full bg-stone-900 text-amber-100 placeholder-stone-500 border border-amber-500/20 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 font-semibold"
                            />
                            {searchingMovies && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-amber-500/20 border-t-amber-500 animate-spin rounded-full" />
                            )}
                          </div>

                          {/* Autocomplete dropdown results */}
                          <AnimatePresence>
                            {showSearchDropdown && movieResults.length > 0 && (
                              <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="absolute left-0 right-0 top-full mt-1.5 bg-stone-900 border border-amber-500/30 rounded-xl shadow-2xl max-h-64 overflow-y-auto z-30 divide-y divide-amber-500/10"
                              >
                                {movieResults.map((movie, index) => (
                                  <button
                                    key={index}
                                    onClick={() => {
                                      setSelectedMovie(movie);
                                      setShowSearchDropdown(false);
                                    }}
                                    className="w-full text-left p-3 hover:bg-stone-800 transition-colors flex items-start gap-3 group"
                                  >
                                    <img 
                                      src={movie.poster} 
                                      alt={movie.title} 
                                      className="w-9 h-12 object-cover rounded shadow border border-amber-500/20 shrink-0 bg-stone-950"
                                      referrerPolicy="no-referrer"
                                    />
                                    <div className="space-y-0.5">
                                      <h4 className="text-xs font-serif font-black text-amber-100 group-hover:text-amber-400 transition-colors line-clamp-1 uppercase tracking-wide">{movie.title}</h4>
                                      <span className="text-[10px] text-amber-400 font-extrabold">{movie.year} {movie.director ? `• Dir: ${movie.director}` : ''}</span>
                                      <p className="text-[10px] text-stone-400 line-clamp-1 font-medium font-serif italic">{movie.description}</p>
                                    </div>
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Selected Movie Preview Card */}
                        {selectedMovie && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-stone-900/60 border border-amber-500/20 p-4 rounded-xl space-y-3 shadow-inner"
                          >
                            <div className="flex gap-4">
                              <img 
                                src={selectedMovie.poster} 
                                alt={selectedMovie.title} 
                                className="w-16 h-24 object-cover rounded-lg shadow-md border border-amber-500/20 bg-stone-950 shrink-0"
                                referrerPolicy="no-referrer"
                              />
                              <div className="space-y-1 min-w-0 flex-1">
                                <h4 className="text-sm font-serif font-black text-amber-100 leading-tight uppercase tracking-wider line-clamp-2">{selectedMovie.title}</h4>
                                <div className="text-[10px] text-amber-400 font-bold">
                                  <span>{selectedMovie.year}</span>
                                  {selectedMovie.director && (
                                    <>
                                      <span className="mx-1">&bull;</span>
                                      <span>Dir: {selectedMovie.director}</span>
                                    </>
                                  )}
                                </div>
                                {selectedMovie.genres && selectedMovie.genres.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {selectedMovie.genres.slice(0, 2).map((g: string, i: number) => (
                                      <span key={i} className="bg-[#1c120c] border border-amber-500/20 text-[9px] text-amber-300 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                        {g}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <div className="pt-1.5">
                                  <a
                                    href={selectedMovie.trailerUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent(selectedMovie.title + " " + selectedMovie.year + " official trailer")}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-bold group"
                                  >
                                    <Tv className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                    <span>Preview Trailer</span>
                                  </a>
                                </div>
                              </div>
                            </div>
                            <p className="text-[11px] text-stone-300 leading-relaxed italic border-t border-amber-500/10 pt-2 font-medium font-serif">
                              "{selectedMovie.description}"
                            </p>
                            
                            {(() => {
                              const isAlreadyWatched = watchedMovies.some(
                                (m) => m.title.trim().toLowerCase() === selectedMovie.title.trim().toLowerCase() &&
                                       String(m.year) === String(selectedMovie.year)
                              );
                              return (
                                <>
                                  {isAlreadyWatched && (
                                    <div className="bg-rose-950/20 border border-rose-900/40 text-rose-400 p-2.5 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 mt-2">
                                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                      <span>This film has already been screened and is blocked.</span>
                                    </div>
                                  )}
                                  
                                  <div className="flex flex-col gap-2 border-t border-zinc-800 pt-3">
                                    {isAdminOfRoom ? (
                                      <div className="flex flex-col gap-2 w-full">
                                        <div className="flex gap-2 w-full">
                                          <button
                                            onClick={handleAddMovieSuggestion}
                                            disabled={isAlreadyWatched}
                                            className="flex-1 bg-amber-500 hover:bg-amber-600 text-black border border-amber-400 font-black py-2 px-3 rounded-lg text-xs transition-all flex items-center justify-center gap-1 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                            title={isAlreadyWatched ? "Already watched" : "Propose to watchlist"}
                                          >
                                            Propose
                                            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                                          </button>
                                          <button
                                            onClick={handleLogMovieAsWatched}
                                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2 px-3 rounded-lg text-xs transition-all flex items-center justify-center gap-1 shadow-md border border-emerald-500"
                                            title="Directly add to watched history"
                                          >
                                            Log Watched
                                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                          </button>
                                        </div>
                                        <button
                                          onClick={() => setSelectedMovie(null)}
                                          className="w-full bg-zinc-950 hover:bg-zinc-900 text-zinc-300 font-bold py-2 rounded-lg text-xs transition-colors border border-zinc-800"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex gap-2 w-full">
                                        <button
                                          onClick={handleAddMovieSuggestion}
                                          disabled={isAlreadyWatched}
                                          className="flex-1 bg-amber-500 hover:bg-amber-600 text-black border border-amber-400 font-black py-2 px-3 rounded-lg text-xs transition-all flex items-center justify-center gap-1 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                          Propose Selection
                                          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                                        </button>
                                        <button
                                          onClick={() => setSelectedMovie(null)}
                                          className="bg-zinc-950 hover:bg-zinc-900 text-zinc-300 font-bold px-3 py-2 rounded-lg text-xs transition-colors border border-zinc-800"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </>
                              );
                            })()}
                          </motion.div>
                        )}
                      </div>

                      {/* COMPACT WATCHED HISTORY ON MAIN ROOM SCREEN */}
                      <div className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800 p-5 rounded-2xl shadow-2xl space-y-4">
                        <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
                          <Ticket className="w-5 h-5 text-amber-500" />
                          <h3 className="font-serif font-black text-amber-400 text-sm uppercase tracking-widest flex-1">
                            Watched History
                          </h3>
                          <span className="bg-amber-500/20 text-amber-400 text-[10px] font-black font-mono px-2 py-0.5 rounded-full uppercase border border-amber-500/20">
                            {watchedMovies.length} Watched
                          </span>
                        </div>
                        
                        {watchedMovies.length === 0 ? (
                          <p className="text-zinc-400 text-xs italic font-medium font-serif">No movies have been watched yet in this room.</p>
                        ) : (
                          <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                            {watchedMovies.map((movie) => (
                              <div key={movie.id} className="flex gap-3 bg-zinc-950 p-2 rounded-xl border border-zinc-850 group relative hover:border-amber-500/30 transition-all">
                                <img
                                  src={movie.poster}
                                  alt={movie.title}
                                  className="w-10 h-14 object-cover rounded shadow-md bg-stone-950 flex-shrink-0"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="space-y-0.5 min-w-0 flex-1">
                                  <h4 className="font-serif font-black text-amber-100 text-xs truncate uppercase tracking-wider">{movie.title}</h4>
                                  <div className="text-[10px] text-amber-400/80 font-bold font-mono">
                                    <span>{movie.year}</span>
                                    {movie.director && <span className="truncate max-w-[100px] inline-block align-bottom"> • Dir: {movie.director}</span>}
                                  </div>
                                  <div className="text-[9px] text-zinc-400 font-medium truncate">
                                    Watched on: {movie.watchedAt ? new Date((movie.watchedAt.seconds || movie.watchedAt._seconds || 0) * 1000 || movie.watchedAt).toLocaleDateString() : 'Recently'}
                                  </div>
                                </div>
                                {isAdminOfRoom && (
                                  <button
                                    onClick={() => handleDeleteWatchedMovie(movie.id)}
                                    className="absolute top-2 right-2 p-1 text-zinc-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Delete from watched history"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* RIGHT PANEL: Dynamic Collaborative Suggestions and Debates */}
                    <div className="lg:col-span-8 space-y-6">
                      {/* TABS SELECTOR */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800 pb-4 gap-4">
                        <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                          <button
                            onClick={() => {
                              setActiveTab("active");
                              setEditingMovieId(null);
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                              activeTab === "active"
                                ? "bg-amber-500 text-black shadow-md"
                                : "text-amber-400 hover:text-amber-300"
                            }`}
                          >
                            <Vote className="w-4 h-4 text-current" />
                            Active Suggestions ({movieSuggestions.length})
                          </button>
                          <button
                            onClick={() => {
                              setActiveTab("watched");
                              setEditingMovieId(null);
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                              activeTab === "watched"
                                ? "bg-amber-500 text-black shadow-md"
                                : "text-amber-400 hover:text-amber-300"
                            }`}
                          >
                            <Check className="w-4 h-4 text-current" />
                            Full Archive ({watchedMovies.length})
                          </button>
                        </div>
                        <span className="text-[10px] bg-zinc-900/50 border border-zinc-800 text-amber-400 font-black font-mono px-2.5 py-1 rounded-full uppercase tracking-widest shadow-md self-start sm:self-auto">
                          Real-time Synced
                        </span>
                      </div>

                      {activeTab === "active" ? (
                        /* ACTIVE NOMINEES VIEW */
                        movieSuggestions.length === 0 ? (
                          <div className="text-center py-20 bg-zinc-900/30 rounded-2xl border border-dashed border-zinc-800 p-8 space-y-3 shadow-xl">
                            <Film className="w-10 h-10 text-amber-500/40 mx-auto" />
                            <h4 className="font-serif font-black text-amber-400 text-sm uppercase tracking-wider">No Movie Suggestions</h4>
                            <p className="text-zinc-400 text-xs max-w-sm mx-auto font-medium font-serif italic">
                              Be the first to search and suggest a movie above to get the voting rolling!
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-6">
                            <AnimatePresence>
                              {sortedMovieSuggestions.map((movie, index) => {
                                const voterId = user?.uid || sessionId;
                                const hasVoted = movie.voterIds?.includes(voterId);
                                const isOwner = movie.suggestedById === (user?.uid || sessionId) || activeList.creatorId === user?.uid;
                                
                                const isTopMovie = index === 0;
                                const isGoldHighlighted = !!(timeLeft?.isFrozen && isTopMovie);

                                return (
                                  <motion.div
                                    key={movie.id}
                                    layout
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className={`border rounded-2xl overflow-hidden transition-all flex flex-col relative ${
                                      isGoldHighlighted 
                                        ? "border-amber-400 bg-amber-950/40 ring-4 ring-amber-400/30 shadow-2xl" 
                                        : "bg-zinc-900/40 border-zinc-800 shadow-xl hover:border-zinc-700/60"
                                    }`}
                                  >
                                    {isGoldHighlighted && (
                                      <div className="bg-gradient-to-r from-amber-950/40 via-amber-600/20 to-amber-950/40 text-amber-100 font-serif font-black text-xs uppercase tracking-widest px-4 py-2 text-center border-b border-amber-400/50 flex items-center justify-center gap-2 shadow-inner">
                                        <Sparkles className="w-4 h-4 animate-pulse text-amber-300" />
                                        <span>Next Movie Selected</span>
                                        <Sparkles className="w-4 h-4 animate-pulse text-amber-300" />
                                      </div>
                                    )}

                                    {/* MOVIE BASIC HEADER DETAILS */}
                                    <div className="p-5 flex flex-col sm:flex-row gap-5 border-b border-zinc-800 bg-zinc-950/60">
                                      <img
                                        src={movie.poster}
                                        alt={movie.title}
                                        className="w-24 h-36 sm:w-20 sm:h-28 object-cover rounded-xl shadow-md border border-zinc-800 bg-zinc-950 shrink-0 mx-auto sm:mx-0"
                                        referrerPolicy="no-referrer"
                                      />
                                      <div className="space-y-1.5 flex-1 text-center sm:text-left min-w-0">
                                        {editingMovieId === movie.id ? (
                                          <div className="space-y-3 bg-zinc-900 p-4 rounded-xl border border-zinc-800 shadow-sm">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                              <div>
                                                <label className="block text-[9px] font-extrabold text-amber-400 uppercase tracking-wider mb-1">Movie Title</label>
                                                <input
                                                  type="text"
                                                  value={editTitle}
                                                  onChange={(e) => setEditTitle(e.target.value)}
                                                  className="w-full bg-zinc-950 text-zinc-100 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-amber-400 font-extrabold"
                                                />
                                              </div>
                                              <div>
                                                <label className="block text-[9px] font-extrabold text-amber-400 uppercase tracking-wider mb-1">Release Year</label>
                                                <input
                                                  type="text"
                                                  value={editYear}
                                                  onChange={(e) => setEditYear(e.target.value)}
                                                  className="w-full bg-zinc-950 text-zinc-100 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-amber-400 font-extrabold"
                                                />
                                              </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                              <div>
                                                <label className="block text-[9px] font-extrabold text-amber-400 uppercase tracking-wider mb-1">Director</label>
                                                <input
                                                  type="text"
                                                  value={editDirector}
                                                  onChange={(e) => setEditDirector(e.target.value)}
                                                  className="w-full bg-zinc-950 text-zinc-100 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-amber-400 font-extrabold"
                                                />
                                              </div>
                                              <div>
                                                <label className="block text-[9px] font-extrabold text-amber-400 uppercase tracking-wider mb-1">Genres (Comma separated)</label>
                                                <input
                                                  type="text"
                                                  value={editGenresText}
                                                  onChange={(e) => setEditGenresText(e.target.value)}
                                                  placeholder="e.g. Drama, Sci-Fi"
                                                  className="w-full bg-zinc-950 text-zinc-100 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-amber-400 font-extrabold"
                                                />
                                              </div>
                                            </div>

                                            <div>
                                              <label className="block text-[9px] font-extrabold text-amber-400 uppercase tracking-wider mb-1">Overview / Description</label>
                                              <textarea
                                                value={editDescription}
                                                onChange={(e) => setEditDescription(e.target.value)}
                                                rows={3}
                                                className="w-full bg-zinc-950 text-zinc-100 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-amber-400 font-medium"
                                              />
                                            </div>

                                            <div className="flex gap-2 pt-1 justify-end">
                                              <button
                                                onClick={() => handleUpdateMovieSuggestion(movie.id)}
                                                className="bg-amber-500 hover:bg-amber-600 text-black font-black px-3 py-1.5 rounded-lg text-[11px] transition-colors shadow-sm"
                                              >
                                                Save Details
                                              </button>
                                              <button
                                                onClick={() => setEditingMovieId(null)}
                                                className="bg-zinc-950 hover:bg-zinc-900 text-zinc-350 font-bold px-3 py-1.5 rounded-lg text-[11px] transition-colors border border-zinc-800"
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <>
                                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                              <div className="space-y-1 min-w-0 flex-1">
                                                <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                                                  <span className="font-mono text-[10px] text-amber-400 font-black uppercase bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                                    #{index + 1} Choice
                                                  </span>
                                                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                                                    Suggested by: {movie.suggestedBy}
                                                  </span>
                                                </div>
                                                <h3 className="text-lg sm:text-xl font-serif font-black text-amber-100 leading-tight uppercase tracking-wider truncate">
                                                  {movie.title} <span className="text-zinc-500 font-normal font-sans">({movie.year})</span>
                                                </h3>

                                                {/* Director, Genres & Trailer Link */}
                                                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-1 pt-1 pb-1 text-[11px] text-zinc-300 font-medium">
                                                  {movie.director && <span>Dir: {movie.director}</span>}
                                                  {movie.director && movie.genres && movie.genres.length > 0 && <span className="text-amber-500/30">&bull;</span>}
                                                  {movie.genres && movie.genres.length > 0 && (
                                                    <div className="flex flex-wrap gap-1">
                                                      {movie.genres.map((g: string, idx: number) => (
                                                        <span key={idx} className="bg-amber-500/10 border border-amber-500/10 text-amber-400 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
                                                          {g}
                                                        </span>
                                                      ))}
                                                    </div>
                                                  )}
                                                  <span className="text-amber-500/30">&bull;</span>
                                                  <a
                                                    href={movie.trailerUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title + " " + movie.year + " official trailer")}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 font-bold text-xs group"
                                                  >
                                                    <Tv className="w-3.5 h-3.5 text-amber-500 group-hover:scale-110 transition-transform" />
                                                    <span>Trailer Link</span>
                                                  </a>
                                                </div>
                                              </div>

                                              {/* VOTE TRIGGER BUTTON */}
                                              {isGoldHighlighted ? (
                                                <div
                                                  className="sm:self-start flex items-center justify-center gap-2 font-black text-xs px-4 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-md shrink-0 font-serif uppercase tracking-wider"
                                                  title="Voting is frozen for this choice"
                                                >
                                                  <Lock className="w-4 h-4 text-amber-400" />
                                                  <span>{movie.voterIds?.length || 0} Votes (Locked)</span>
                                                </div>
                                              ) : (
                                                <button
                                                  onClick={() => handleToggleVote(movie)}
                                                  className={`sm:self-start flex items-center justify-center gap-2 font-black text-xs px-4 py-2.5 rounded-xl border transition-all shadow-md active:scale-95 shrink-0 ${
                                                    hasVoted 
                                                      ? "bg-amber-500 text-black border-amber-400" 
                                                      : "bg-zinc-950 hover:bg-zinc-900 text-amber-300 border-zinc-800 hover:border-zinc-700"
                                                  }`}
                                                >
                                                  <Vote className={`w-4 h-4 ${hasVoted ? "animate-bounce text-black" : "text-amber-400"}`} />
                                                  <span>{movie.voterIds?.length || 0} Votes</span>
                                                </button>
                                              )}
                                            </div>

                                            <p className="text-zinc-300 text-xs leading-relaxed line-clamp-3 font-medium font-serif italic">
                                              {movie.description}
                                            </p>

                                            {/* AUTOMATIC TRAILER EMBED */}
                                            {(() => {
                                              const embedUrl = getYoutubeEmbedUrl(movie.trailerUrl);
                                              if (embedUrl) {
                                                return (
                                                  <div className="mt-3 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-inner relative aspect-video w-full max-w-2xl mx-auto">
                                                    <iframe
                                                      src={embedUrl}
                                                      title={`${movie.title} Trailer`}
                                                      className="w-full h-full absolute inset-0"
                                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                      allowFullScreen
                                                    />
                                                  </div>
                                                );
                                              }
                                              return null;
                                            })()}

                                            <div className="flex items-center justify-between pt-1 flex-wrap gap-2 border-t border-amber-500/10 mt-2">
                                              <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">
                                                ID: {movie.id}
                                              </span>
                                              {isOwner && (
                                                <div className="flex items-center gap-3">
                                                  <button
                                                    onClick={() => {
                                                      setEditingMovieId(movie.id);
                                                      setEditTitle(movie.title);
                                                      setEditYear(movie.year);
                                                      setEditDirector(movie.director || "");
                                                      setEditDescription(movie.description || "");
                                                      setEditGenresText((movie.genres || []).join(", "));
                                                    }}
                                                    className="text-stone-400 hover:text-amber-400 transition-colors p-1 flex items-center gap-1 text-[10px] font-extrabold uppercase"
                                                  >
                                                    <Sliders className="w-3.5 h-3.5" />
                                                    Edit Movie
                                                  </button>
                                                  <span className="text-stone-600">|</span>
                                                  <button
                                                    onClick={() => handleDeleteMovieSuggestion(movie.id)}
                                                    className="text-stone-400 hover:text-rose-400 transition-colors p-1 flex items-center gap-1 text-[10px] font-extrabold uppercase"
                                                  >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                    Remove Movie
                                                  </button>
                                                </div>
                                              )}
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    </div>

                                    {/* PROS & CONS TRICIDER ARGUMENTS VIEW */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-850 bg-zinc-950/20 border-t border-zinc-850">
                                      {/* PROS COLUMN (GREEN) */}
                                      <div className="p-4 space-y-3">
                                        <div className="flex items-center gap-1.5 text-emerald-400 font-extrabold text-xs uppercase tracking-wider">
                                          <Smile className="w-4 h-4" />
                                          <span>Pros / Arguments In Favor ({movie.pros?.length || 0})</span>
                                        </div>

                                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                          {(!movie.pros || movie.pros.length === 0) ? (
                                            <p className="text-[10px] text-zinc-500 italic font-medium">No pro arguments added yet.</p>
                                          ) : (
                                            movie.pros.map((pro) => (
                                              <div key={pro.id} className="bg-emerald-950/20 border border-emerald-900/30 p-2.5 rounded-lg space-y-1 relative group">
                                                <p className="text-zinc-200 text-xs leading-relaxed pr-6 font-medium">{pro.text}</p>
                                                <div className="flex items-center justify-between text-[9px] text-zinc-500 font-bold uppercase tracking-wider">
                                                  <span>&mdash; {pro.author}</span>
                                                  {(pro.authorId === (user?.uid || sessionId) || activeList.creatorId === user?.uid) && (
                                                    <button
                                                      onClick={() => handleDeleteArgument(movie, pro, "pro")}
                                                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 transition-opacity absolute top-2 right-2"
                                                      title="Delete argument"
                                                    >
                                                      <Trash2 className="w-3 h-3" />
                                                    </button>
                                                  )}
                                                </div>
                                              </div>
                                            ))
                                          )}
                                        </div>

                                        {/* Inline Add Pro Form */}
                                        <div className="flex items-center gap-2 pt-2 border-t border-zinc-850">
                                          <input
                                            type="text"
                                            placeholder="Why suggest this?"
                                            value={argumentInputs[movie.id]?.type === "pro" ? argumentInputs[movie.id].text : ""}
                                            onChange={(e) => setArgumentInputs((prev) => ({
                                              ...prev,
                                              [movie.id]: { type: "pro", text: e.target.value }
                                            }))}
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter") handleAddArgument(movie.id);
                                            }}
                                            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500/50 placeholder-zinc-500 font-medium"
                                          />
                                          <button
                                            onClick={() => {
                                              // Set type first then add
                                              setArgumentInputs((prev) => ({
                                                ...prev,
                                                [movie.id]: { type: "pro", text: prev[movie.id]?.text || "" }
                                              }));
                                              setTimeout(() => handleAddArgument(movie.id), 20);
                                            }}
                                            className="bg-emerald-950/30 hover:bg-emerald-900/40 border border-emerald-800 p-2 rounded-lg text-emerald-400 transition-all active:scale-95 shrink-0"
                                            title="Add pro argument"
                                          >
                                            <Plus className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>

                                      {/* CONS COLUMN (RED) */}
                                      <div className="p-4 space-y-3">
                                        <div className="flex items-center gap-1.5 text-rose-400 font-extrabold text-xs uppercase tracking-wider">
                                          <Frown className="w-4 h-4" />
                                          <span>Cons / Arguments Against ({movie.cons?.length || 0})</span>
                                        </div>

                                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                          {(!movie.cons || movie.cons.length === 0) ? (
                                            <p className="text-[10px] text-zinc-500 italic font-medium">No con arguments added yet.</p>
                                          ) : (
                                            movie.cons.map((con) => (
                                              <div key={con.id} className="bg-rose-950/20 border border-rose-900/30 p-2.5 rounded-lg space-y-1 relative group text-zinc-100">
                                                <p className="text-zinc-200 text-xs leading-relaxed pr-6 font-medium">{con.text}</p>
                                                <div className="flex items-center justify-between text-[9px] text-zinc-500 font-bold uppercase tracking-wider">
                                                  <span>&mdash; {con.author}</span>
                                                  {(con.authorId === (user?.uid || sessionId) || activeList.creatorId === user?.uid) && (
                                                    <button
                                                      onClick={() => handleDeleteArgument(movie, con, "con")}
                                                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 transition-opacity absolute top-2 right-2"
                                                      title="Delete argument"
                                                    >
                                                      <Trash2 className="w-3 h-3" />
                                                    </button>
                                                  )}
                                                </div>
                                              </div>
                                            ))
                                          )}
                                        </div>

                                        {/* Inline Add Con Form */}
                                        <div className="flex items-center gap-2 pt-2 border-t border-zinc-850">
                                          <input
                                            type="text"
                                            placeholder="Any reservations?"
                                            value={argumentInputs[movie.id]?.type === "con" ? argumentInputs[movie.id].text : ""}
                                            onChange={(e) => setArgumentInputs((prev) => ({
                                              ...prev,
                                              [movie.id]: { type: "con", text: e.target.value }
                                            }))}
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter") handleAddArgument(movie.id);
                                            }}
                                            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-rose-500/50 placeholder-zinc-500 font-medium"
                                          />
                                          <button
                                            onClick={() => {
                                              // Set type first then add
                                              setArgumentInputs((prev) => ({
                                                ...prev,
                                                [movie.id]: { type: "con", text: prev[movie.id]?.text || "" }
                                              }));
                                              setTimeout(() => handleAddArgument(movie.id), 20);
                                            }}
                                            className="bg-rose-950/30 hover:bg-rose-900/40 border border-rose-800 p-2 rounded-lg text-rose-400 transition-all active:scale-95 shrink-0"
                                            title="Add con argument"
                                          >
                                            <Plus className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </AnimatePresence>
                          </div>
                        )
                      ) : (
                        /* WATCHED HISTORY VIEW */
                        watchedMovies.length === 0 ? (
                          <div className="text-center py-20 bg-rose-950/20 rounded-2xl border border-dashed border-amber-500/20 p-8 space-y-3 shadow-xl">
                            <Check className="w-10 h-10 text-amber-500/40 mx-auto" />
                            <h4 className="font-serif font-black text-amber-400 text-sm uppercase tracking-wider">No Archive Logs Yet</h4>
                            <p className="text-stone-300 text-xs max-w-sm mx-auto font-medium font-serif italic">
                              Once a countdown finishes, the highest-voted movie is automatically moved and recorded inside this archive.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-6">
                            <AnimatePresence>
                              {watchedMovies.map((movie) => {
                                const isEditingThisWatched = editingMovieId === movie.id;
                                return (
                                  <motion.div
                                    key={movie.id}
                                    layout
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="bg-[#1c120c]/60 border border-amber-500/10 rounded-2xl overflow-hidden shadow-xl flex flex-col"
                                  >
                                    <div className="p-5 flex flex-col sm:flex-row gap-5">
                                      <img
                                        src={movie.poster}
                                        alt={movie.title}
                                        className="w-16 h-24 sm:w-20 sm:h-28 object-cover rounded-xl shadow-sm border border-amber-500/20 bg-stone-950 shrink-0 mx-auto sm:mx-0 sepia-[30%]"
                                        referrerPolicy="no-referrer"
                                      />
                                      <div className="space-y-1.5 flex-1 text-center sm:text-left min-w-0">
                                        {isEditingThisWatched ? (
                                          <div className="space-y-3 bg-stone-900 p-4 rounded-xl border border-amber-500/20 shadow-xs">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                              <div>
                                                <label className="block text-[9px] font-extrabold text-amber-400 uppercase tracking-wider mb-1">Movie Title</label>
                                                <input
                                                  type="text"
                                                  value={editTitle}
                                                  onChange={(e) => setEditTitle(e.target.value)}
                                                  className="w-full bg-stone-950 text-amber-100 border border-amber-500/20 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-amber-400 font-extrabold"
                                                />
                                              </div>
                                              <div>
                                                <label className="block text-[9px] font-extrabold text-amber-400 uppercase tracking-wider mb-1">Release Year</label>
                                                <input
                                                  type="text"
                                                  value={editYear}
                                                  onChange={(e) => setEditYear(e.target.value)}
                                                  className="w-full bg-stone-950 text-amber-100 border border-amber-500/20 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-amber-400 font-extrabold"
                                                />
                                              </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                              <div>
                                                <label className="block text-[9px] font-extrabold text-amber-400 uppercase tracking-wider mb-1">Director</label>
                                                <input
                                                  type="text"
                                                  value={editDirector}
                                                  onChange={(e) => setEditDirector(e.target.value)}
                                                  className="w-full bg-stone-950 text-amber-100 border border-amber-500/20 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-amber-400 font-extrabold"
                                                />
                                              </div>
                                              <div>
                                                <label className="block text-[9px] font-extrabold text-amber-400 uppercase tracking-wider mb-1">Genres (Comma separated)</label>
                                                <input
                                                  type="text"
                                                  value={editGenresText}
                                                  onChange={(e) => setEditGenresText(e.target.value)}
                                                  className="w-full bg-stone-950 text-amber-100 border border-amber-500/20 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-amber-400 font-extrabold"
                                                />
                                              </div>
                                            </div>

                                            <div>
                                              <label className="block text-[9px] font-extrabold text-amber-400 uppercase tracking-wider mb-1">Overview / Description</label>
                                              <textarea
                                                value={editDescription}
                                                onChange={(e) => setEditDescription(e.target.value)}
                                                rows={3}
                                                className="w-full bg-stone-950 text-amber-100 border border-amber-500/20 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-amber-400 font-medium"
                                              />
                                            </div>

                                            <div className="flex gap-2 pt-1 justify-end">
                                              <button
                                                onClick={() => handleUpdateWatchedMovie(movie.id)}
                                                className="bg-amber-500 hover:bg-amber-600 text-red-950 font-black px-3 py-1.5 rounded-lg text-[11px] transition-colors shadow-sm"
                                              >
                                                Save Watched Details
                                              </button>
                                              <button
                                                onClick={() => {
                                                  setEditingMovieId(null);
                                                  setIsEditingWatched(false);
                                                }}
                                                className="bg-stone-900 hover:bg-stone-800 text-stone-300 font-bold px-3 py-1.5 rounded-lg text-[11px] transition-colors"
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <>
                                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                              <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                                                  <span className="inline-flex items-center gap-1 font-mono text-[10px] text-amber-400 font-black uppercase bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                                    Screened
                                                  </span>
                                                  <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">
                                                    Originally suggested by: {movie.suggestedBy || "System"}
                                                  </span>
                                                </div>
                                                <h3 className="text-lg sm:text-xl font-serif font-black text-amber-100 leading-tight pt-1 uppercase tracking-wider truncate">
                                                  {movie.title} <span className="text-stone-400 font-normal font-sans">({movie.year})</span>
                                                </h3>

                                                {/* Details line */}
                                                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-1 pt-1 pb-1 text-[11px] text-stone-300 font-semibold">
                                                  {movie.director && <span>Dir: {movie.director}</span>}
                                                  {movie.director && movie.genres && movie.genres.length > 0 && <span className="text-amber-500/30">&bull;</span>}
                                                  {movie.genres && movie.genres.length > 0 && (
                                                    <div className="flex flex-wrap gap-1">
                                                      {movie.genres.map((g: string, idx: number) => (
                                                        <span key={idx} className="bg-amber-500/10 border border-amber-500/10 text-amber-400 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
                                                          {g}
                                                        </span>
                                                      ))}
                                                    </div>
                                                  )}
                                                  <span className="text-amber-500/30">&bull;</span>
                                                  <a
                                                    href={movie.trailerUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title + " " + movie.year + " official trailer")}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 font-bold text-xs group"
                                                  >
                                                    <Tv className="w-3.5 h-3.5 text-amber-500 group-hover:scale-110 transition-transform" />
                                                    <span>Trailer Link</span>
                                                  </a>
                                                </div>
                                              </div>

                                              {/* WINNING VOTE STATS BADGE */}
                                              <div className="bg-[#1c120c] border border-amber-500/20 rounded-xl px-4 py-2.5 text-center min-w-[70px] shadow-xs shrink-0 self-center">
                                                <span className="block font-mono font-black text-amber-400 text-base leading-none">
                                                  {movie.voterIds?.length || 0}
                                                </span>
                                                <span className="text-[9px] text-stone-400 font-bold uppercase tracking-wider">Votes</span>
                                              </div>
                                            </div>

                                            <p className="text-stone-300 text-xs leading-relaxed line-clamp-3 font-medium font-serif italic">
                                              {movie.description}
                                            </p>

                                            {/* AUTOMATIC TRAILER EMBED */}
                                            {(() => {
                                              const embedUrl = getYoutubeEmbedUrl(movie.trailerUrl);
                                              if (embedUrl) {
                                                return (
                                                  <div className="mt-3 overflow-hidden rounded-xl border border-amber-500/20 bg-stone-950 shadow-inner relative aspect-video w-full max-w-2xl mx-auto">
                                                    <iframe
                                                      src={embedUrl}
                                                      title={`${movie.title} Trailer`}
                                                      className="w-full h-full absolute inset-0"
                                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                      allowFullScreen
                                                    />
                                                  </div>
                                                );
                                              }
                                              return null;
                                            })()}

                                            <div className="flex items-center justify-between pt-1.5 border-t border-amber-500/10 flex-wrap gap-2 mt-2">
                                              <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider font-mono">
                                                Watched On: {movie.watchedAt ? new Date((movie.watchedAt.seconds || movie.watchedAt._seconds || movie.watchedAt) * 1000 || movie.watchedAt).toLocaleString() : "Recently"}
                                              </span>
                                              
                                              {isAdminOfRoom && (
                                                <div className="flex items-center gap-3">
                                                  <button
                                                    onClick={() => {
                                                      setEditingMovieId(movie.id);
                                                      setIsEditingWatched(true);
                                                      setEditTitle(movie.title);
                                                      setEditYear(movie.year);
                                                      setEditDirector(movie.director || "");
                                                      setEditDescription(movie.description || "");
                                                      setEditGenresText((movie.genres || []).join(", "));
                                                    }}
                                                    className="text-stone-400 hover:text-amber-400 transition-colors p-1 flex items-center gap-1 text-[10px] font-extrabold uppercase"
                                                  >
                                                    <Sliders className="w-3.5 h-3.5" />
                                                    Edit Watched
                                                  </button>
                                                  <span className="text-stone-600">|</span>
                                                  <button
                                                    onClick={() => handleDeleteWatchedMovie(movie.id)}
                                                    className="text-stone-400 hover:text-rose-400 transition-colors p-1 flex items-center gap-1 text-[10px] font-extrabold uppercase"
                                                  >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                    Remove Watched
                                                  </button>
                                                </div>
                                              )}
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </AnimatePresence>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-24 text-center space-y-4">
                  <p className="text-slate-500 text-sm font-bold">Active board metadata not loaded correctly.</p>
                  <button 
                    onClick={() => {
                      window.location.hash = "";
                    }}
                    className="bg-sky-600 hover:bg-sky-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs shadow-md"
                  >
                    Go Back to All Rooms
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-slate-500 text-xs font-semibold">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-sky-600" />
            <span>Cinevote &copy; 2026. Made for film buffs and cinephiles.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
