# 🧾 PAC Alias Tracker

A lightweight userscript for **Pokémon Auto Chess** that tracks **past player names (aliases)** per **profile ID** whenever you open someone’s profile in the lobby.

It helps you recognize players who frequently rename themselves, keep your own preferred “main name” for them, and quickly search your stored alias history — without leaving the site.

---

## ✨ Features

- 🧠 **Automatic Alias Tracking**  
  Saves the current player name every time you open their profile.

- 🆔 **ID-Based Matching (No Mixups)**  
  Aliases are stored under the player’s **game-history ID**, ensuring accuracy even if names are reused.

- 🔁 **Recency-Based Alias Ordering**  
  If a player reuses an old name, it is automatically moved to the **top** of the alias list.  
  Your main names will never be pushed out as long as they’re reused occasionally.

- ⭐ **Editable Main Name**  
  Save the name you personally know a player by.  
  After saving, the field becomes read-only until you click **Edit**, so it is clear what is currently stored.

- 📌 **Draggable Overlay Panel**  
  Drag the **PAC Aliases** panel anywhere you want.  
  The position is remembered automatically.

- ♻️ **Reset Position Button**  
  Instantly snap the panel back to its default position.

- 🔍 **Global Alias Search**  
  Search across all saved aliases and main names.

- 👤 **Clickable Saved Profiles**  
  Search results open the saved alias profile inside the PAC Aliases panel, showing that player’s main name, latest known name, and full alias list.

- 📋 **Copy to Clipboard**  
  Copy a player’s alias list (one name per line) with a single click.

- 💾 **Export / Import (Merge) JSON**  
  Export your entire alias database or merge data from another browser or friend.

- 🧹 **Clear Controls**  
  Clear aliases for the current player only or wipe everything.

- 🔄 **SPA-Aware & Efficient**  
  Works reliably with PAC’s single-page navigation and only runs while the profile modal is open.

---

## 📦 Installation

### 1. Install a Userscript Manager

- **Tampermonkey** (recommended): https://www.tampermonkey.net/  
- Violentmonkey: https://violentmonkey.github.io/

---

### 2. Install the Script

1. Open your userscript manager  
2. Create a **new script**  
3. Paste the contents of `pac-alias-tracker.js`  
4. Save  
5. Go to your browser extensions and make sure that you allow user scripts for Tampermonkey/Violentmonkey and activate developer mode.

---

### 3. Use It In-Game

1. Go to https://pokemon-auto-chess.com  
2. In the lobby, open any player profile (click a name / leaderboard profile)  
3. The **PAC Aliases** panel appears next to the profile modal  
4. Open more profiles over time to build your alias history automatically

---

## 🛠 Controls

| Action | How |
|------|----|
| Move panel | Drag the panel header |
| Reset the panel position | **⟲** |
| Refresh the panel | Click **↻** |
| Add or change main name | Click **Edit**, enter a name, then **Save** |
| Clear main name | Click **Edit**, then **Clear** |
| View a saved search result | Search a name, then click a result |
| Return to the open PAC profile | Click **Current** after viewing a saved search result |
| Copy aliases to clipboard | Click **Copy** |
| Export all data | Click **Export JSON** |
| Import / merge data | Click **Import JSON** and paste your export |
| Clear current player | Click **Clear This Player** |
| Clear everything | Click **Clear ALL** |

---

## 🗂 Data Storage

- Stored locally in your browser using `localStorage`
- Key:

```js
pac_profile_aliases_v1
```

- No accounts, no servers, no syncing unless you export/import manually
- Each stored profile can contain:
  - `names`: automatically tracked alias history
  - `mainName`: your manually chosen display name
  - `lastSeen`: local timestamp used for sorting/search relevance

---

## 🔒 Safety & Performance

- ✅ Read-only (does not modify gameplay)
- ✅ No network requests
- ✅ Runs fully client-side
- ✅ Only activates when the profile modal is open

---

## 📜 License

MIT License

---

## ❤️ Credits

Created by **Cinn**  
For the Pokémon Auto Chess community.

PRs and improvements welcome 🚀
