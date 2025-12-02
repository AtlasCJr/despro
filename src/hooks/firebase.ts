// firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// --- Your Firebase web app config ---
// You can get these values from your Firebase Console → Project Settings → SDK setup
const firebaseConfig = {
  apiKey: "AIzaSyCz2PYIMqntdxSuC4psNu72z4TxrnIvPJs",
  authDomain: "despro-23ec9.firebaseapp.com",
  projectId: "despro-23ec9",
  storageBucket: "despro-23ec9.firebasestorage.app",
  messagingSenderId: "900020801702",
  appId: "1:900020801702:web:1e900648f6f97da5ffe467",
  measurementId: "G-HY8MGBQX16"
};

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);

// --- Get Firestore instance ---
export const db = getFirestore(app);
