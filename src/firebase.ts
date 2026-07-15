import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC3d0VVqekNy80uvViRaoOOC2ARiEo-6pc",
  authDomain: "gen-lang-client-0096063843.firebaseapp.com",
  projectId: "gen-lang-client-0096063843",
  storageBucket: "gen-lang-client-0096063843.firebasestorage.app",
  messagingSenderId: "71288955750",
  appId: "1:71288955750:web:b12a449e4f877fe0839ea7"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
// Initialize Firestore using the specific databaseId from the applet configuration
export const db = getFirestore(app, "ai-studio-2c8cbe9c-679e-4aa8-aea7-bf3d89d72661");
