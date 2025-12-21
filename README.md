# 🧾 PAC Alias Tracker

A lightweight userscript for **Pokémon Auto Chess** that tracks **past player names (aliases)** per **profile ID** whenever you open someone’s profile in the lobby.

It helps you recognize players who frequently rename themselves, keep notes on known smurfs/alt names, and quickly search your stored alias history — without leaving the site.

---

## ✨ Features

- 🧠 **Automatic Alias Tracking**  
  Saves a player’s current name whenever you open their profile modal.

- 🆔 **ID-Based Matching (No Mixups)**  
  Names are stored under the player’s **profile/game-history ID** to avoid confusion.

- 📌 **Overlay Panel Next to the Profile**  
  A clean “PAC Aliases” panel appears beside the profile window.

- 🔍 **Global Alias Search**  
  Search across all saved names to find what ID(s) a name belongs to.

- 📋 **Copy to Clipboard**  
  Copy a player’s alias list (one name per line) with one click.

- 💾 **Export / Import (Merge) JSON**  
  Export your saved alias database and import/merge later (or share with friends).

- 🧹 **Clear Controls**  
  Clear aliases for the current player only or wipe all saved data.

- 🕶 **Stream-Safe ID Hiding (Click to Reveal)**  
  Player IDs are masked by default and only shown if you click them.

- 🔄 **SPA-Aware**  
  Works reliably with PAC navigation and re-renders when the profile modal changes.

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
| Refresh the panel | Click **↻** |
| Copy aliases | Click **Copy to clipboard** |
| Export all data | Click **Export JSON** |
| Import / merge data | Click **Import JSON** and paste your export |
| Clear current player | Click **Clear This Player** |
| Clear everything | Click **Clear ALL** |
| Reveal hidden ID | Click the masked **ID** (auto-hides again) |
| Reveal ID in search results | Click the masked ID next to a search hit |

---

## ⚙️ Customization

Open the script and adjust these values:

### Panel horizontal position (left/right offset)

```js
const PANEL_OUTSIDE_OFFSET_PX = 377;
```

### Panel vertical position

Inside `ensurePanelPosition(panel)`:

```js
panel.style.top = "-72px";
```

### Panel width

Inside `createPanel()`:

```js
min-width: 280px;
max-width: 360px;
```

---

## 🗂 Data Storage

- Stored locally in your browser using `localStorage`
- Key:

```js
pac_profile_aliases_v1
```

- No accounts, no servers, no syncing unless you export/import manually

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
