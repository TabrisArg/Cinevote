export interface RepeatingSchedule {
  selectedDays: number[]; // 0=Sunday, 1=Monday, etc.
  frequencyValue: number;
  frequencyUnit: "weeks" | "months" | "years";
  startDate: string;
}

export interface VotingList {
  id: string;
  title: string;
  description: string;
  creatorId: string;
  creatorName: string;
  creatorEmail?: string;
  createdAt: any; // Firestore Timestamp
  releaseTime?: string; // ISO string representing scheduled release countdown
  lastReleasedMovieId?: string;
  rules?: string;
  repeatingSchedule?: RepeatingSchedule;
  coOwners?: string[];
}

export interface Argument {
  id: string;
  text: string;
  author: string;
  authorId: string;
  createdAt: number; // timestamp
}

export interface VoteHistoryItem {
  voterId: string;
  name: string;
  timestamp: number;
}

export interface MovieSuggestion {
  id: string;
  listId: string;
  title: string;
  year: string | number;
  description: string;
  poster: string;
  suggestedBy: string;
  suggestedById: string;
  createdAt: any; // Firestore Timestamp
  voterIds: string[]; // array of session/user IDs
  votersHistory?: VoteHistoryItem[];
  pros: Argument[];
  cons: Argument[];
  director?: string;
  genres?: string[];
  trailerUrl?: string;
  tmdbId?: string | number;
}
