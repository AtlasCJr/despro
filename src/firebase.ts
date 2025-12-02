import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCz2PYIMqntdxSuC4psNu72z4TxrnIvPJs",
  authDomain: "despro-23ec9.firebaseapp.com",
  projectId: "despro-23ec9",
  storageBucket: "despro-23ec9.firebasestorage.app",
  messagingSenderId: "900020801702",
  appId: "1:900020801702:web:1e900648f6f97da5ffe467",
  measurementId: "G-HY8MGBQX16"
};

// Only initialize once
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);