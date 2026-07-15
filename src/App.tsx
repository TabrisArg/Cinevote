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
  Tv
} from "lucide-react";
import { db, auth, googleProvider } from "./firebase";
import { signInWithPopup, signOut, User } from "firebase/auth";
import { 
  collection, 
  doc, 
  addDoc, 
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
  const [loadingActiveList, setLoadingActiveList] = useState(false);

  // Movie Search State (Suggestion Form)
  const [movieQuery, setMovieQuery] = useState("");
  const [movieResults, setMovieResults] = useState<any[]>([]);
  const [searchingMovies, setSearchingMovies] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<any | null>(null);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Argument input map (movieId -> pro/con text)
  const [argumentInputs, setArgumentInputs] = useState<{ [key: string]: { type: "pro" | "con"; text: string } }>({});

  // UI Notification Toasts
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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
            return [...filtered, listObj].sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);
          });
        }
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

    return () => {
      unsubList();
      unsubMovies();
    };
  }, [currentRoute.path, currentRoute.listId]);

  // Debounced Movie Search API query
  useEffect(() => {
    if (movieQuery.trim().length < 2) {
      setMovieResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setSearchingMovies(true);
      try {
        const response = await fetch(`/api/movies/search?q=${encodeURIComponent(movieQuery)}`);
        if (response.ok) {
          const data = await response.json();
          setMovieResults(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Error searching movies:", err);
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
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Google Login failed:", err);
      setErrorMessage("Could not sign in with Google. Please try again.");
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

    try {
      await addDoc(collection(db, "lists", currentRoute.listId, "movies"), {
        title: selectedMovie.title,
        year: selectedMovie.year,
        description: selectedMovie.description,
        poster: selectedMovie.poster,
        director: selectedMovie.director || "",
        genres: selectedMovie.genres || [],
        trailerUrl: selectedMovie.trailerUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent(selectedMovie.title + " " + selectedMovie.year + " official trailer")}`,
        suggestedBy: alias,
        suggestedById: user?.uid || sessionId,
        createdAt: serverTimestamp(),
        voterIds: [user?.uid || sessionId], // Automatic self vote for their own suggestion
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

  // Suggestion Actions (Vote, Pros & Cons Argument)
  const handleToggleVote = async (movie: MovieSuggestion) => {
    if (!currentRoute.listId) return;
    const voterId = user?.uid || sessionId;
    const hasVoted = movie.voterIds.includes(voterId);

    try {
      const movieRef = doc(db, "lists", currentRoute.listId, "movies", movie.id);
      await updateDoc(movieRef, {
        voterIds: hasVoted ? arrayRemove(voterId) : arrayUnion(voterId)
      });
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
    // Fallback: newest suggestions first
    return 0;
  });

  return (
    <div id="cinevote_app" className="min-h-screen bg-slate-50 text-slate-800 flex flex-col antialiased">
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
            className="fixed bottom-8 right-8 z-50 bg-sky-600 text-white font-extrabold px-6 py-3 rounded-full shadow-lg border border-sky-500 flex items-center gap-2"
          >
            <Check className="w-5 h-5" />
            <span>Invite Link Copied!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER / NAVIGATION BAR */}
      <nav id="navbar" className="sticky top-0 z-40 backdrop-blur-md bg-white/90 border-b border-slate-200/80 shadow-xs transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="#" className="flex items-center gap-2 group">
              <div className="bg-sky-500 p-2 rounded-lg shadow-md shadow-sky-500/15 group-hover:scale-105 transition-transform flex items-center justify-center">
                <Film className="w-5 h-5 text-white stroke-[2.5]" />
              </div>
              <div>
                <span className="font-extrabold text-lg tracking-tight text-slate-900 font-sans">
                  Cine<span className="text-sky-600">vote</span>
                </span>
                <span className="hidden sm:inline-block ml-2 text-xs text-slate-500 border-l border-slate-200 pl-2 font-medium">
                  Interactive Movie Voting
                </span>
              </div>
            </a>
          </div>

          <div className="flex items-center gap-4">
            {/* ALIAS EDIT BAR */}
            <div className="relative flex items-center bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 shadow-xs">
              <UserIcon className="w-3.5 h-3.5 text-sky-600 mr-2" />
              {isEditingAlias ? (
                <form onSubmit={handleSaveAlias} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tempAlias}
                    onChange={(e) => setTempAlias(e.target.value)}
                    className="bg-white text-slate-950 border border-slate-300 rounded px-1.5 py-0.5 focus:outline-none focus:border-sky-500 text-xs w-36 font-semibold"
                    autoFocus
                    maxLength={25}
                  />
                  <button type="submit" className="text-emerald-600 hover:text-emerald-500 font-bold">
                    Save
                  </button>
                  <button type="button" onClick={() => setIsEditingAlias(false)} className="text-slate-500 hover:text-slate-600">
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-2">
                  <span>Voting as: <strong className="text-slate-900 font-bold">{alias}</strong></span>
                  <button 
                    onClick={() => {
                      setTempAlias(alias);
                      setIsEditingAlias(true);
                    }}
                    className="text-sky-600 hover:text-sky-700 text-[10px] font-extrabold uppercase tracking-wider"
                  >
                    Change
                  </button>
                </div>
              )}
            </div>

            {/* AUTH / GOOGLE SIGN-IN BUTTON */}
            {authLoading ? (
              <div className="w-8 h-8 rounded-full border-2 border-sky-500/20 border-t-sky-500 animate-spin" />
            ) : user ? (
              <div className="flex items-center gap-3">
                <img 
                  src={user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`} 
                  alt={user.displayName || "User"} 
                  className="w-8 h-8 rounded-full border border-sky-500/40"
                />
                <button 
                  onClick={handleLogout}
                  title="Sign Out of Google"
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button 
                onClick={handleGoogleLogin}
                className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-xs font-semibold px-3 py-1.5 rounded-lg text-xs transition-all"
              >
                <Lock className="w-3.5 h-3.5 text-sky-600" />
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
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="inline-flex items-center gap-2 bg-sky-50 border border-sky-200 text-sky-600 font-bold text-xs px-4 py-1.5 rounded-full uppercase tracking-wider mb-2"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Real-time Movie Recommendation & Debate
                </motion.div>
                <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 leading-none">
                  Make Smarter Movie Choices <br/>
                  <span className="bg-gradient-to-r from-sky-500 via-sky-600 to-sky-700 bg-clip-text text-transparent">Together</span>.
                </h1>
                <p className="text-slate-600 text-base sm:text-lg max-w-2xl mx-auto font-medium">
                  Inspired by Tricider, Cinevote is the ultimate collaborative workspace to propose film suggestions, vote on rankings, and debate with Pros & Cons in real-time.
                </p>
              </div>

              {/* THREE-STEP WORKFLOW CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white border border-slate-200/80 p-6 rounded-2xl space-y-3 shadow-xs relative overflow-hidden group hover:shadow-md transition-all">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-sky-500/5 to-transparent rounded-full" />
                  <div className="w-10 h-10 bg-sky-50 rounded-xl flex items-center justify-center border border-sky-100 font-bold text-sky-600 text-base">
                    1
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-base">Create a List</h3>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    Log in with Google to boot up a dedicated voting board for family film nights, genre rankings, or holiday watchlist ideas.
                  </p>
                </div>
                <div className="bg-white border border-slate-200/80 p-6 rounded-2xl space-y-3 shadow-xs relative overflow-hidden group hover:shadow-md transition-all">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-sky-500/5 to-transparent rounded-full" />
                  <div className="w-10 h-10 bg-sky-50 rounded-xl flex items-center justify-center border border-sky-100 font-bold text-sky-600 text-base">
                    2
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-base">Invite with a Link</h3>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    Share your list room code or URL with friends. No registration, login, or installs are needed for others to participate.
                  </p>
                </div>
                <div className="bg-white border border-slate-200/80 p-6 rounded-2xl space-y-3 shadow-xs relative overflow-hidden group hover:shadow-md transition-all">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-sky-500/5 to-transparent rounded-full" />
                  <div className="w-10 h-10 bg-sky-50 rounded-xl flex items-center justify-center border border-sky-100 font-bold text-sky-600 text-base">
                    3
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-base">Search, Vote & Debate</h3>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    Use our live database search to suggest movies with auto-loaded poster artwork and plotlines, upvote favorites, and write Pros/Cons.
                  </p>
                </div>
              </div>

              {/* TWO COLUMN INTERACTION PANEL */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-4">
                {/* LEFT COLUMN: Create and Join Rooms */}
                <div className="lg:col-span-5 space-y-6">
                  {/* JOIN DIRECTLY FORM */}
                  <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs space-y-4">
                    <h2 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                      <Link2 className="w-5 h-5 text-sky-600" />
                      Join an Existing Room
                    </h2>
                    <form onSubmit={handleJoinRoom} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter 20-character Room ID"
                        value={joinRoomId}
                        onChange={(e) => setJoinRoomId(e.target.value)}
                        className="flex-1 bg-slate-50 text-slate-900 placeholder-slate-400 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-sky-500 font-mono"
                      />
                      <button 
                        type="submit"
                        className="bg-sky-600 hover:bg-sky-700 text-white font-extrabold px-4 py-2.5 rounded-xl text-sm transition-all shadow-md shadow-sky-500/10 active:scale-95"
                      >
                        Join
                      </button>
                    </form>
                  </div>

                  {/* CREATE NEW ROOM FORM */}
                  <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs space-y-4 relative">
                    <h2 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                      <PlusCircle className="w-5 h-5 text-sky-600" />
                      Create a Movie Discussion
                    </h2>

                    {!user ? (
                      <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl text-center space-y-4">
                        <Lock className="w-8 h-8 text-sky-600 mx-auto" />
                        <div className="space-y-1">
                          <h4 className="font-bold text-slate-900 text-sm">Google Authentication Required</h4>
                          <p className="text-slate-500 text-xs font-medium">To create and manage custom collaborative lists, please authenticate your session using Google.</p>
                        </div>
                        <button 
                          onClick={handleGoogleLogin}
                          className="w-full bg-sky-600 hover:bg-sky-700 text-white font-extrabold py-2.5 px-4 rounded-xl text-sm transition-all shadow-lg shadow-sky-500/10 flex items-center justify-center gap-2"
                        >
                          <Lock className="w-4 h-4 stroke-[2.5]" />
                          Sign in with Google
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleCreateList} className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Topic / Title</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Scary Movie Night for Halloween" 
                            value={newListTitle}
                            onChange={(e) => setNewListTitle(e.target.value)}
                            required
                            className="w-full bg-slate-50 text-slate-900 placeholder-slate-400 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-sky-500 font-semibold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Description / Invitation Question</label>
                          <textarea 
                            placeholder="e.g. Add your favorite psychological thrillers and vote on which one we should screen!" 
                            value={newListDesc}
                            onChange={(e) => setNewListDesc(e.target.value)}
                            rows={3}
                            className="w-full bg-slate-50 text-slate-900 placeholder-slate-400 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-sky-500 resize-none"
                          />
                        </div>

                        <button 
                          type="submit"
                          disabled={isCreatingList}
                          className="w-full bg-sky-600 hover:bg-sky-700 text-white font-extrabold py-3 px-4 rounded-xl text-sm transition-all shadow-lg shadow-sky-500/15 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isCreatingList ? "Setting up discussion..." : "Launch Voting Room"}
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
                    <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs space-y-4">
                      <h2 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                        <Tv className="w-5 h-5 text-sky-600" />
                        Rooms You Created
                      </h2>
                      {myCreatedLists.length === 0 ? (
                        <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 p-4">
                          <p className="text-slate-500 text-xs font-semibold">You haven't launched any discussion boards yet.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto pr-1">
                          {myCreatedLists.map((list) => (
                            <div key={list.id} className="py-3 flex items-center justify-between group first:pt-0 last:pb-0">
                              <div className="space-y-1 flex-1 pr-4">
                                <a 
                                  href={`#/list/${list.id}`}
                                  className="font-bold text-slate-800 hover:text-sky-600 text-sm block transition-colors line-clamp-1"
                                >
                                  {list.title}
                                </a>
                                {list.description && (
                                  <p className="text-slate-500 text-xs line-clamp-1">{list.description}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <a 
                                  href={`#/list/${list.id}`}
                                  className="bg-slate-100 hover:bg-sky-500 hover:text-white text-slate-700 font-bold px-3 py-1 rounded-lg text-xs transition-all"
                                >
                                  Open
                                </a>
                                <button 
                                  onClick={() => handleDeleteListRoom(list.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
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
                  <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs space-y-4">
                    <h2 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                      <Users className="w-5 h-5 text-sky-600" />
                      Recently Visited Rooms
                    </h2>
                    {recentListsData.length === 0 ? (
                      <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 p-4">
                        <p className="text-slate-500 text-xs font-semibold">No recently active rooms in your session history.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-1">
                        {recentListsData.map((list) => (
                          <div 
                            key={list.id} 
                            className="bg-slate-50 border border-slate-200 hover:border-sky-300 p-4 rounded-xl flex flex-col justify-between transition-all group shadow-xs"
                          >
                            <div className="space-y-1.5">
                              <a 
                                href={`#/list/${list.id}`}
                                className="font-extrabold text-slate-850 hover:text-sky-600 text-xs block transition-all line-clamp-1"
                              >
                                {list.title}
                              </a>
                              {list.description && (
                                <p className="text-slate-500 text-[11px] line-clamp-2 leading-relaxed font-medium">{list.description}</p>
                              )}
                            </div>
                            <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                              <span>By {list.creatorName}</span>
                              <a 
                                href={`#/list/${list.id}`}
                                className="text-sky-600 hover:text-sky-700 font-extrabold"
                              >
                                Join Room &rarr;
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
                  <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-sky-500/5 to-transparent rounded-full" />
                    
                    <div className="space-y-2 flex-1">
                      <button 
                        onClick={() => {
                          window.location.hash = "";
                        }}
                        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg font-bold"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        All Rooms
                      </button>
                      <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none pt-2">
                        {activeList.title}
                      </h1>
                      {activeList.description && (
                        <p className="text-slate-600 text-xs sm:text-sm max-w-3xl leading-relaxed font-medium">{activeList.description}</p>
                      )}
                      <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                        <span>Created by: <strong className="text-slate-700 font-bold">{activeList.creatorName}</strong></span>
                        <span>&bull;</span>
                        <span className="font-mono">{activeList.id}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto shrink-0 border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
                      <button 
                        onClick={copyInviteLink}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-extrabold px-4 py-2.5 rounded-xl text-xs transition-all shadow-xs active:scale-95 border border-slate-200"
                      >
                        <Share2 className="w-4 h-4 text-sky-600" />
                        Copy Invite Link
                      </button>
                    </div>
                  </div>

                  {/* ROOM MAIN TWO-COLUMN SPLIT */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* LEFT PANEL: Propose a Movie Suggestion (Floating Sticky style) */}
                    <div className="lg:col-span-4 space-y-6">
                      <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs space-y-4 sticky top-24">
                        <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                          <PlusCircle className="w-5 h-5 text-sky-600" />
                          Suggest a Movie
                        </h3>
                        <p className="text-xs text-slate-500 leading-relaxed font-medium">
                          Type a movie title below. We'll automatically search our movie database to pull its cover art and plot summary instantly!
                        </p>

                        {/* Search input with live autocomplete dropdown */}
                        <div className="space-y-1.5 relative">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Search e.g. Interstellar, Joker..."
                              value={movieQuery}
                              onChange={(e) => {
                                setMovieQuery(e.target.value);
                                setShowSearchDropdown(true);
                              }}
                              onFocus={() => setShowSearchDropdown(true)}
                              className="w-full bg-slate-50 text-slate-900 placeholder-slate-400 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-sky-500"
                            />
                            {searchingMovies && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-sky-500/20 border-t-sky-500 animate-spin rounded-full" />
                            )}
                          </div>

                          {/* Autocomplete dropdown results */}
                          <AnimatePresence>
                            {showSearchDropdown && movieResults.length > 0 && (
                              <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto z-30 divide-y divide-slate-100"
                              >
                                {movieResults.map((movie, index) => (
                                  <button
                                    key={index}
                                    onClick={() => {
                                      setSelectedMovie(movie);
                                      setShowSearchDropdown(false);
                                    }}
                                    className="w-full text-left p-3 hover:bg-slate-50 transition-colors flex items-start gap-3 group"
                                  >
                                    <img 
                                      src={movie.poster} 
                                      alt={movie.title} 
                                      className="w-9 h-12 object-cover rounded shadow border border-slate-200 shrink-0 bg-slate-50"
                                      referrerPolicy="no-referrer"
                                    />
                                    <div className="space-y-0.5">
                                      <h4 className="text-xs font-extrabold text-slate-800 group-hover:text-sky-600 transition-colors line-clamp-1">{movie.title}</h4>
                                      <span className="text-[10px] text-sky-600 font-extrabold">{movie.year} {movie.director ? `• Dir: ${movie.director}` : ''}</span>
                                      <p className="text-[10px] text-slate-500 line-clamp-1 font-medium">{movie.description}</p>
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
                            className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3 shadow-inner"
                          >
                            <div className="flex gap-4">
                              <img 
                                src={selectedMovie.poster} 
                                alt={selectedMovie.title} 
                                className="w-16 h-24 object-cover rounded-lg shadow-md border border-slate-200 bg-white shrink-0"
                                referrerPolicy="no-referrer"
                              />
                              <div className="space-y-1">
                                <h4 className="text-sm font-extrabold text-slate-900 leading-tight">{selectedMovie.title}</h4>
                                <div className="text-[10px] text-sky-600 font-bold">
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
                                    {selectedMovie.genres.map((g: string, i: number) => (
                                      <span key={i} className="bg-white border border-slate-200 text-[9px] text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
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
                                    className="inline-flex items-center gap-1.5 text-xs text-sky-600 hover:text-sky-750 font-bold group"
                                  >
                                    <Tv className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                    <span>Preview Trailer</span>
                                  </a>
                                </div>
                              </div>
                            </div>
                            <p className="text-[11px] text-slate-600 leading-relaxed italic border-t border-slate-200/60 pt-2 font-medium">
                              "{selectedMovie.description}"
                            </p>
                            <div className="flex gap-2 border-t border-slate-200/60 pt-3">
                              <button
                                onClick={handleAddMovieSuggestion}
                                className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-extrabold py-2 px-3 rounded-lg text-xs transition-all flex items-center justify-center gap-1 shadow-md"
                              >
                                Propose Selection
                                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                              </button>
                              <button
                                onClick={() => setSelectedMovie(null)}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-750 font-bold px-3 py-2 rounded-lg text-xs transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </div>

                    {/* RIGHT PANEL: Dynamic Collaborative Suggestions and Debates */}
                    <div className="lg:col-span-8 space-y-6">
                      <div className="flex items-center justify-between">
                        <h2 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                          <Vote className="w-5 h-5 text-sky-600" />
                          Ranked Movie Candidates ({movieSuggestions.length})
                        </h2>
                        <span className="text-[10px] bg-white border border-slate-200 text-slate-500 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-xs">
                          Real-time Sorting
                        </span>
                      </div>

                      {movieSuggestions.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200 p-8 space-y-3 shadow-xs">
                          <Film className="w-10 h-10 text-slate-400 mx-auto" />
                          <h4 className="font-extrabold text-slate-800 text-sm">No Suggestions Yet</h4>
                          <p className="text-slate-500 text-xs max-w-sm mx-auto font-medium">
                            Be the first to search and add a movie recommendation to get the discussion rolling!
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <AnimatePresence>
                            {sortedMovieSuggestions.map((movie, index) => {
                              const voterId = user?.uid || sessionId;
                              const hasVoted = movie.voterIds?.includes(voterId);
                              const isOwner = movie.suggestedById === (user?.uid || sessionId) || activeList.creatorId === user?.uid;

                              return (
                                <motion.div
                                  key={movie.id}
                                  layout
                                  initial={{ opacity: 0, y: 20 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col"
                                >
                                  {/* MOVIE BASIC HEADER DETAILS */}
                                  <div className="p-5 flex flex-col sm:flex-row gap-5 border-b border-slate-100 bg-slate-50">
                                    <img
                                      src={movie.poster}
                                      alt={movie.title}
                                      className="w-24 h-36 sm:w-20 sm:h-28 object-cover rounded-xl shadow-md border border-slate-200 bg-white shrink-0 mx-auto sm:mx-0"
                                      referrerPolicy="no-referrer"
                                    />
                                    <div className="space-y-1.5 flex-1 text-center sm:text-left">
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="space-y-0.5">
                                          <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                                            <span className="font-mono text-xs text-sky-600 font-extrabold uppercase bg-sky-50 px-2 py-0.5 rounded border border-sky-100">
                                              #{index + 1} Candidate
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                              Suggested by: {movie.suggestedBy}
                                            </span>
                                          </div>
                                          <h3 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                                            {movie.title} <span className="text-slate-500 font-semibold">({movie.year})</span>
                                          </h3>

                                          {/* Director, Genres & Trailer Link */}
                                          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-1 pt-1 pb-1 text-[11px] text-slate-500 font-medium">
                                            {movie.director && <span>Dir: {movie.director}</span>}
                                            {movie.director && movie.genres && movie.genres.length > 0 && <span className="text-slate-300">&bull;</span>}
                                            {movie.genres && movie.genres.length > 0 && (
                                              <div className="flex flex-wrap gap-1">
                                                {movie.genres.map((g: string, idx: number) => (
                                                  <span key={idx} className="bg-slate-200/60 text-slate-600 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
                                                    {g}
                                                  </span>
                                                ))}
                                              </div>
                                            )}
                                            <span className="text-slate-300">&bull;</span>
                                            <a
                                              href={movie.trailerUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title + " " + movie.year + " official trailer")}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-750 font-bold text-xs group"
                                            >
                                              <Tv className="w-3.5 h-3.5 text-sky-600 group-hover:scale-110 transition-transform" />
                                              <span>Watch Trailer</span>
                                            </a>
                                          </div>
                                        </div>

                                        {/* VOTE TRIGGER BUTTON */}
                                        <button
                                          onClick={() => handleToggleVote(movie)}
                                          className={`sm:self-start flex items-center justify-center gap-2 font-black text-xs px-4 py-2 rounded-xl border transition-all shadow-md active:scale-95 ${
                                            hasVoted 
                                              ? "bg-sky-600 text-white border-sky-500 shadow-sky-500/10" 
                                              : "bg-white text-slate-700 border-slate-200 hover:border-sky-500"
                                          }`}
                                        >
                                          <Vote className={`w-4 h-4 ${hasVoted ? "animate-bounce text-white" : "text-sky-600"}`} />
                                          <span>{movie.voterIds?.length || 0} Votes</span>
                                        </button>
                                      </div>

                                      <p className="text-slate-600 text-xs leading-relaxed line-clamp-3 font-medium">
                                        {movie.description}
                                      </p>

                                      <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                          ID: {movie.id}
                                        </span>
                                        {isOwner && (
                                          <button
                                            onClick={() => handleDeleteMovieSuggestion(movie.id)}
                                            className="text-slate-400 hover:text-rose-600 transition-colors p-1 flex items-center gap-1 text-[10px] font-extrabold uppercase"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            Remove Movie
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* PROS & CONS TRICIDER ARGUMENTS VIEW */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100 bg-slate-50/50">
                                    {/* PROS COLUMN (GREEN) */}
                                    <div className="p-4 space-y-3">
                                      <div className="flex items-center gap-1.5 text-emerald-600 font-extrabold text-xs uppercase tracking-wider">
                                        <Smile className="w-4 h-4" />
                                        <span>Pros / Arguments In Favor ({movie.pros?.length || 0})</span>
                                      </div>

                                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                        {(!movie.pros || movie.pros.length === 0) ? (
                                          <p className="text-[10px] text-slate-500 italic font-medium">No pro arguments added yet.</p>
                                        ) : (
                                          movie.pros.map((pro) => (
                                            <div key={pro.id} className="bg-emerald-50 border border-emerald-100 p-2.5 rounded-lg space-y-1 relative group">
                                              <p className="text-slate-700 text-xs leading-relaxed pr-6 font-medium">{pro.text}</p>
                                              <div className="flex items-center justify-between text-[9px] text-slate-500 font-bold uppercase tracking-wider">
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
                                      <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
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
                                          className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 placeholder-slate-400 font-medium"
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
                                          className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 p-2 rounded-lg text-emerald-600 transition-all active:scale-95 shrink-0"
                                          title="Add pro argument"
                                        >
                                          <Plus className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* CONS COLUMN (RED) */}
                                    <div className="p-4 space-y-3">
                                      <div className="flex items-center gap-1.5 text-rose-600 font-extrabold text-xs uppercase tracking-wider">
                                        <Frown className="w-4 h-4" />
                                        <span>Cons / Arguments Against ({movie.cons?.length || 0})</span>
                                      </div>

                                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                        {(!movie.cons || movie.cons.length === 0) ? (
                                          <p className="text-[10px] text-slate-500 italic font-medium">No con arguments added yet.</p>
                                        ) : (
                                          movie.cons.map((con) => (
                                            <div key={con.id} className="bg-rose-50 border border-rose-100 p-2.5 rounded-lg space-y-1 relative group">
                                              <p className="text-slate-700 text-xs leading-relaxed pr-6 font-medium">{con.text}</p>
                                              <div className="flex items-center justify-between text-[9px] text-slate-500 font-bold uppercase tracking-wider">
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
                                      <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
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
                                          className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-rose-500 placeholder-slate-400 font-medium"
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
                                          className="bg-rose-50 hover:bg-rose-100 border border-rose-200 p-2 rounded-lg text-rose-600 transition-all active:scale-95 shrink-0"
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
          <div className="flex gap-4">
            <span>Powered by Gemini 3.5 &amp; Firebase</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
