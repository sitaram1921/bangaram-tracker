// ═══════════════════════════════════════════════════════════
// FIREBASE CONFIGURATION
// ═══════════════════════════════════════════════════════════

const firebaseConfig = {
  apiKey: "AIzaSyAJdUQILmjZnEJ7N773hJ-IoacSCYc-gp4",
  authDomain: "tracker-bea1e.firebaseapp.com",
  databaseURL: "https://tracker-bea1e-default-rtdb.firebaseio.com",
  projectId: "tracker-bea1e",
  storageBucket: "tracker-bea1e.firebasestorage.app",
  messagingSenderId: "651002694905",
  appId: "1:651002694905:web:d9dd4a8ae1d5375e836628",
  measurementId: "G-F0425XR84F"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Fixed DB root — single personal app, no auth needed
const DB_ROOT = 'tracker';

// Database paths
const DB_PATHS = {
  habits: 'habits',
  completions: 'completions',
  streaks: 'streaks',
};
