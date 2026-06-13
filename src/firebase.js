import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Credenciales fijas de respaldo en caso de que las variables de entorno no estén disponibles (ej. en GitHub Actions)
const REAL_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCzpAB9kN4-y_bW0PTB59HJpn4BWyHS0wU",
  authDomain: "inventario-cbcdb.firebaseapp.com",
  projectId: "inventario-cbcdb",
  storageBucket: "inventario-cbcdb.firebasestorage.app",
  messagingSenderId: "517245697244",
  appId: "1:517245697244:web:698cd43fea2962b74b8819"
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || REAL_FIREBASE_CONFIG.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || REAL_FIREBASE_CONFIG.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || REAL_FIREBASE_CONFIG.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || REAL_FIREBASE_CONFIG.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || REAL_FIREBASE_CONFIG.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || REAL_FIREBASE_CONFIG.appId
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore and export
export const db = getFirestore(app);

// Initialize Auth and export
export const auth = getAuth(app);

// Initialize Storage and export
export const storage = getStorage(app);

// Flag indicating Firebase is fully configured
export const isFirebaseConfigured = true;
