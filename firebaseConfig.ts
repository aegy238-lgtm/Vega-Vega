import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Updated Firebase Configuration for ahmed-chat-eb4ec
const firebaseConfig = {
  apiKey: "AIzaSyB_Er2Sk6vGUP7K4gr6MZ7_QB7L0B8XU9I",
  authDomain: "ahmed-chat-eb4ec.firebaseapp.com",
  projectId: "ahmed-chat-eb4ec",
  storageBucket: "ahmed-chat-eb4ec.firebasestorage.app",
  messagingSenderId: "332694563568",
  appId: "1:332694563568:web:92b55b27a86dc4e6b67035"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);