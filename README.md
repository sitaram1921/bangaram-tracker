# 🎯 Habit Tracker with Firebase

A modern, modular habit tracking application with real-time database sync, trend visualization, and weekly history tracking.

## 📁 Project Structure

```
Tracker/
├── index.html           # Clean HTML structure (imports all modules)
├── styles.css           # All CSS styles (kept separate for easy updates)
├── config.js            # Firebase configuration
├── utils.js             # Date utilities and helper functions
├── db.js                # Database management (Firebase + LocalStorage sync)
├── ui.js                # UI rendering functions
├── trends.js            # Trends visualization & statistics
├── app.js               # Main application initialization
└── README.md            # This file
```

## ✨ Features

- ✅ **Daily Habit Tracking** - Check off habits as you complete them
- 📊 **Trend Visualization** - View completion rates with Chart.js
- 📅 **Weekly Navigation** - Browse through weeks of history
- 💾 **Firebase Sync** - Cloud database with automatic sync
- 📴 **Offline Support** - Works offline, syncs when back online
- 🎨 **Customizable Habits** - Choose emoji icons and colors
- 🔥 **Streak Tracking** - Visual feedback for consecutive days
- 📱 **Responsive Design** - Works on desktop and mobile

## 🚀 Quick Start

### 1. Set Up Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use an existing one)
3. Enable **Realtime Database**:
   - Go to Build → Realtime Database
   - Click "Create Database"
   - Start in test mode (or configure security rules later)
4. Get your config credentials:
   - Go to Project Settings → Service Accounts
   - Copy your Firebase config

### 2. Configure the App

Edit **config.js** and replace the placeholder values:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 3. Run Locally

Just open `index.html` in your browser (or use a local server for best results).

## 📝 File Descriptions

### **index.html**
- Clean HTML with semantic structure
- Loads all CSS and JavaScript modules
- No inline styles or scripts for better maintainability

### **styles.css**
- All visual styling (dark theme by default)
- CSS variables for easy theming
- Responsive design breakpoints
- Animations and transitions

### **config.js**
- Firebase initialization
- Device ID generation for multi-device sync
- Database path constants

### **utils.js**
- Date formatting and conversion functions
- Week calculation helpers
- Trend date range utilities
- Toast notification function
- HTML escaping for security

### **db.js**
- `HabitDB` class for database operations
- LocalStorage as primary storage
- Firebase sync on top
- Online/offline detection
- Habit CRUD operations
- Streak calculation

### **ui.js**
- Rendering functions for all components
- Habit card generation (check and water types)
- Weekly grid rendering
- Modal management for adding habits
- Edit mode toggle
- Week navigation

### **trends.js**
- Chart.js visualization
- Trend calculation over different time periods (4w, 12w, all-time)
- Statistics cards (completion rate, overall rate, best streak)
- Dynamic filter switching

### **app.js**
- App initialization
- Event listeners setup
- Keyboard shortcuts (E for edit mode, Esc to close modal)
- Auto-sync on tab focus

## 🔧 How to Extend

### Add a New Habit Type
In `ui.js`, add a new card maker function like `makeCustomCard()` and update `renderGrid()`.

### Customize Colors & Emojis
Edit the `COLORS` and `EMOJIS` arrays in `ui.js`:

```javascript
const COLORS = ['#FF5252', '#FF7043', ...]; // Add your colors
const EMOJIS = ['🏋️', '🏃', ...];           // Add your emojis
```

### Change the Theme
Update CSS variables in `styles.css`:

```css
:root {
  --bg: #080808;           /* Background color */
  --surface: #111111;      /* Card background */
  --text: #f2f2f2;         /* Text color */
  /* ... more variables ... */
}
```

### Add More Statistics
Edit `trends.js`'s `renderStats()` function to calculate and display new metrics.

## 📊 Data Structure

### Completions Object
```javascript
{
  "2026-05-15": {
    "exercise": true,
    "water": 6,
    "food": true
  }
}
```

### Habits Array
```javascript
[
  {
    id: "exercise",
    name: "Exercise",
    emoji: "🏋️",
    color: "#FF5252",
    type: "check"
  },
  {
    id: "water",
    name: "Water",
    emoji: "💧",
    color: "#26C6DA",
    type: "water",
    goal: 8
  }
]
```

## 🔐 Firebase Security

For production, update your Realtime Database rules:

```json
{
  "rules": {
    ".read": true,
    ".write": "auth.uid != null"
  }
}
```

Or for a specific user:
```json
{
  "rules": {
    "$uid": {
      ".read": "$uid === auth.uid",
      ".write": "$uid === auth.uid"
    }
  }
}
```

## 🛠️ Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## 📦 Dependencies

- **Firebase Realtime Database** (10.7.0) - Cloud storage
- **Chart.js** (latest) - Trend visualization
- **No other npm packages needed!**

## 📱 Keyboard Shortcuts

- **E** - Toggle edit mode
- **Esc** - Close add habit modal

## 🐛 Troubleshooting

**Firebase not syncing?**
- Check your config in `config.js`
- Verify Firebase rules allow read/write
- Check browser console for errors

**Data not persisting?**
- Data is cached in localStorage and should persist offline
- Check browser storage quota

**Charts not showing?**
- Make sure Chart.js CDN loads (check Network tab)
- Wait for trends to have enough data points

## 🎨 Customization Tips

1. **Change default habits**: Edit in `db.js`'s `loadDefaults()` function
2. **Modify colors**: Update `COLORS` array in `ui.js`
3. **Add new habit types**: Create new card type in `ui.js` and update `renderGrid()`
4. **Adjust trend ranges**: Edit `getTrendDateRange()` in `utils.js`

## 📄 License

Free to use and modify!

---

**Happy Habit Tracking! 🚀**
