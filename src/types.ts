export interface VotingList {
  id: string;
  title: string;
  description: string;
  creatorId: string;
  creatorName: string;
  creatorEmail?: string;
  createdAt: any; // Firestore Timestamp
}

export interface Argument {
  id: string;
  text: string;
  author: string;
  authorId: string;
  createdAt: number; // timestamp
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
  pros: Argument[];
  cons: Argument[];
  director?: string;
  genres?: string[];
  trailerUrl?: string;
}
