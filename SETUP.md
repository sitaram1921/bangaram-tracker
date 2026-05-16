# Quick Setup Guide

## 5-Minute Setup

### Step 1: Get Firebase Credentials (2 min)

1. Visit https://console.firebase.google.com/
2. Click **"Create a Project"** and name it (e.g., "Habit Tracker")
3. Skip Google Analytics (optional)
4. Once created, go to **⚙️ Project Settings** (top left)
5. Under **"Your apps"**, click **"Add app"** → **Web**
6. Copy your config object that looks like:
   ```javascript
   {
     apiKey: "ABC123...",
     authDomain: "project-id.firebaseapp.com",
     databaseURL: "https://project-id-default-rtdb.firebaseio.com",
     projectId: "project-id",
     storageBucket: "project-id.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123def456"
   }
   ```

### Step 2: Enable Realtime Database (1 min)

1. In Firebase Console, go to **Build → Realtime Database**
2. Click **"Create Database"**
3. Choose region (closest to you)
4. Start in **"Test Mode"** (for now)
5. Click **"Enable"**

### Step 3: Update config.js (1 min)

1. Open `config.js` in your editor
2. Replace the placeholder values with your Firebase config:
   ```javascript
   const firebaseConfig = {
     apiKey: "PASTE_YOUR_API_KEY",
     authDomain: "PASTE_YOUR_AUTH_DOMAIN",
     databaseURL: "PASTE_YOUR_DATABASE_URL",
     projectId: "PASTE_YOUR_PROJECT_ID",
     storageBucket: "PASTE_YOUR_STORAGE_BUCKET",
     messagingSenderId: "PASTE_YOUR_MESSAGING_SENDER_ID",
     appId: "PASTE_YOUR_APP_ID"
   };
   ```

### Step 4: Open the App (1 min)

1. Open `index.html` in your browser
2. ✅ Done! Start tracking habits!

## 📱 Install as PWA App (for your girlfriend)

### iPhone (iOS)
1. Open the app link in **Safari**
2. Tap the **Share button** (bottom right)
3. Scroll down and tap **"Add to Home Screen"**
4. Choose a name (default: "Habit Tracker")
5. Tap **"Add"**
6. ✅ App is now on her home screen like a native app!

### Android
1. Open the app link in **Chrome** (or any Chromium browser)
2. Tap the **menu button** (⋮ three dots, top right)
3. Tap **"Install app"** or **"Add to Home screen"**
4. Confirm the installation
5. ✅ App is now on her home screen!

### Desktop (Windows/Mac/Linux)
1. Open the app in **Chrome** or **Edge**
2. Click the **install icon** in the address bar (or menu → "Install Habit Tracker")
3. Follow the prompts
4. ✅ App works like a desktop application!

## 🎉 Features
- **Installable** - Works like a native app
- **Offline** - Full functionality without internet
- **Syncs** - Automatically syncs when online
- **Fast** - Caches everything for instant loading
- **No App Store** - No approval needed, share a link!

---

| File | Purpose |
|------|---------|
| `index.html` | Main HTML page (clean & modular) |
| `styles.css` | All styling |
| `config.js` | **← UPDATE THIS with Firebase credentials** |
| `utils.js` | Helper functions |
| `db.js` | Database & storage logic |
| `ui.js` | Rendering & user interface |
| `trends.js` | Charts & statistics |
| `app.js` | App initialization |

## Testing Without Firebase (Optional)

The app has **offline support**! Even without Firebase config:
1. Leave `config.js` with placeholder values
2. Open the app
3. Everything works with just LocalStorage (no cloud sync)

To enable Firebase later, just update `config.js`.

## Common Issues

**"Firebase is not defined" error?**
- Make sure you have internet (Firebase scripts load from CDN)
- Check browser console for more details

**Data not showing up?**
- Check localStorage is enabled in your browser
- Try opening DevTools → Application → LocalStorage

**Can't add habits?**
- Check browser console for JavaScript errors
- Make sure all .js files are in the same folder as index.html

## Next Steps

1. ✅ Add your first habit with the + button
2. ✅ Check off habits as you complete them
3. ✅ Navigate to different weeks with arrow buttons
4. ✅ View trends to see your progress
5. ✅ Edit habits with the pencil icon (bottom right)

## Firebase Security Rules (For Production)

When you're ready to deploy, update your database rules in Firebase Console (Database → Rules):

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

⚠️ This allows anyone to read/write. For production, use authentication!

---

**Need help?** Check README.md for more details!
