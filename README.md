# 👁️ CivicEye — Civic Issue Reporting & Accountability Web App

> **AI-Powered Civic Issue Reporting, Automated Dispatch, and Municipal Accountability Platform** built for high-impact hackathon demonstration.

---

## 🎙️ Presenting CivicEye (Live Hackathon Demo Mode)

CivicEye includes a purpose-built **Presenter Suite** accessible at `/demo` (Admin-only, or via the **"🎙️ Launch Demo Mode"** button in `/admin`). It runs 8 pre-planned scenarios through the **REAL application engines** (real Gemini multimodal calls, real Firestore writes, real assignment algorithms, real perceptual image hashing, and real rating adjustments).

```
Projector Shortcut: Press 'P' anywhere on /demo to toggle High-Contrast Presenter Mode!
```

### 📋 Pre-Presentation Setup Checklist
1. **Verify Environment**: Ensure `.env` has valid Firebase credentials and `VITE_GEMINI_KEY`.
2. **Start Dev Server**: Run `npm run dev -- --host` and navigate to `http://localhost:5173/demo`.
3. **Log in as Admin**: Use `admin@demo.com` (`Demo@1234`) or click **"Login as Admin"** in the Demo Role Switcher.
4. **Inspect the Demo Checklist**: The top health checklist checks:
   - Firebase Connected (Green)
   - Gemini Key Configured (Green)
   - Demo Accounts Exist (Green)
   - Seed Reports Loaded (Green)
   - Demo Photos Present (Shows yellow banner if missing, with automatic canvas fallback)
   - Firestore Demo Writes Permitted (Green)
   - Browser Geolocation & Microphone Permissions
   *If accounts or seed reports are missing, click **"⚡ Fix What You Can"** to automatically regenerate them.*

---

### 📷 Required Demo Photos (`public/demo-images/`)

Place these 8 standard JPEG files inside `public/demo-images/`:

| Filename | Purpose | Scenario Used |
|---|---|---|
| `pothole_before.jpg` | Severe asphalt pothole on traffic road | Scenario 1, 2, 5 |
| `pothole_after.jpg` | Same location, cleanly patched with fresh asphalt | Scenario 1 |
| `fake_fix_other_place.jpg` | Completely different street / clean road | Scenario 2 (Anti-Cheat) |
| `garbage_before.jpg` | Overflowing garbage dumpster on sidewalk | Scenario 3 |
| `garbage_after_partial.jpg` | Partly cleared garbage (borderline 60% confidence) | Scenario 3 (Citizen Confirmation) |
| `waterleak_before.jpg` | Burst water distribution pipe flooding road | Scenario 4 (Escalation) |
| `streetlight_before.jpg` | Dark non-functioning sodium vapor streetlights | Scenario 6 (Explorer) |
| `drain_before.jpg` | Collapsed storm drainage trench hazard | Scenario 7 (Hindi Voice) |

> [!NOTE]
> **Automatic Canvas Fallback**: If you do not have these photos ready, CivicEye **automatically generates crisp, labeled canvas placeholder graphics** (`MISSING: pothole_after.jpg`) so every demo scenario still executes and renders cleanly without errors.

---

### ⏱️ 4-Minute Presentation Script (The Judge Playlist)

Click **"✨ 4-Min Playlist"** on `/demo` (or run Scenarios 1, 2, 4, 6, 8 in order):

#### **0:00 – 1:00: Scenario 1 — "Report to Resolved" (The Happy Path)**
- **Narrator**: "Watch a citizen defect report flow from mobile photo to verified municipal repair in real-time."
- **Step 1**: Citizen submits `pothole_before.jpg`. Gemini 2.0 Flash classifies defect as `pothole`, Severity 7/10, Urgency `HIGH`, Department `public_works`.
- **Step 2**: Auto-dispatch engine matches eligible Zone 1 officers and assigns **Rajesh Kumar (Roads Lead)** with a strict 72-hour countdown timer.
- **Step 3**: Rajesh uploads `pothole_after.jpg`. Gemini multimodal verification compares landmarks in both photos, confirming `Same Location: YES` and `Issue Resolved: YES` (88% confidence).
- **Step 4**: Ticket flips to `Resolved`. Rajesh is awarded a $+0.3$ on-time rating bonus, his streak increments, and a green marker appears live on the map.

#### **1:00 – 1:45: Scenario 2 — "Fake Fix Caught" (Anti-Cheat & Visual Rejection)**
- **Narrator**: "What if a dishonest contractor submits a photo of a clean road from a completely different neighborhood?"
- **Step 1**: Report created for a severe road pothole.
- **Step 2**: Officer submits `fake_fix_other_place.jpg`.
- **Step 3**: Gemini vision and anti-cheat detect landmark mismatch: `same_location: false`, confidence 18%.
- **Step 4**: Auto-resolution is blocked. Ticket remains `in_progress`, explanation is logged, and **zero rating bonus** is awarded.

#### **1:45 – 2:30: Scenario 4 — "Missed Deadline & SLA Escalation Audit"**
- **Narrator**: "Field crews cannot ignore tickets. Our automated escalation engine audits statutory deadlines."
- **Step 1**: A critical water leak ticket is created with a deadline already expired by 12 hours.
- **Step 2**: The Overdue Audit routine detects the breach, applies a $-0.5$ penalty, resets the streak, and escalates to **Level 1**.
- **Step 3**: Advancing by 24 hours triggers **Level 2 Auto-Reassignment**, reallocating the ticket to an officer with open capacity.
- **Step 4 (Idempotency Proof)**: Running the audit a second time does **nothing**. Show the narrator log proving zero duplicate penalties.

#### **2:30 – 3:15: Scenario 6 — "Area Explorer & Hyperlocal Circle"**
- **Narrator**: "Citizens can explore real-time municipal health anywhere in their city with a single tap."
- **Step 1**: Click on the map drops a 500-meter radius Area Explorer circle.
- **Step 2**: Panel ranks nearby reports by distance, active vs resolved counts, and average resolution speed.
- **Step 3**: Toggles "My Reports" for the demo citizen identity.

#### **3:15 – 4:00: Scenario 8 — "Officer Accountability & Restrictive Guard"**
- **Narrator**: "Underperforming officers are held accountable by automated safety rails."
- **Step 1**: Show the Public Leaderboard celebrating high-rating officers (4.8+).
- **Step 2**: Reveal Officer 8 (Deepa Nair, rating 2.3). The system displays a red **RESTRICTED** badge and mathematically blocks her from receiving high-urgency or critical hazard dispatches.
- **Wrap-up**: Point to the **Impact Snapshot** panel: zero paid infrastructure, real-time AI verification, and fraud prevention for municipal governance.

---

### 🛡️ Wi-Fi Dropout & Rate-Limit Protection (Safe Mode)

During a live presentation, venue Wi-Fi can drop or API keys can hit quotas:

1. **8-Second Auto-Fallback**: If a live Gemini call takes longer than 8 seconds or fails due to network loss, CivicEye **automatically catches the error, falls back to pre-recorded JSON responses, and tags the step with `[CACHED RESULT]`**. The presentation never freezes.
2. **Safe Mode Toggle**: Press **`S`** (or click **"🛡️ Safe Mode: ON"**) to run 100% offline using the built-in cache (`src/demo/cachedResponses.json`).
3. **Record Responses**: Click **"💾 Record Cache"** before presenting to refresh the Firestore cache with fresh live Gemini calls.

---

### ⌨️ Presenter Keyboard Shortcuts

| Key | Action |
|---|---|
| **Right Arrow (`→`)** | Advance to next scenario step (Manual mode) |
| **Left Arrow (`←`)** | View previous step result |
| **`R`** | Reset active scenario demo data |
| **`S`** | Toggle Safe Mode (Cached vs Live Gemini) |
| **`P`** | Toggle Projector Presenter Mode (hides navbar, high contrast, enlarged fonts) |
| **`Esc`** | Exit Presenter Mode |
| **`?`** | Toggle on-screen keyboard shortcut cheat sheet |

---

### 📝 Manual Steps to Do Before Judges Arrive
1. Ensure your browser is running with full screen (`F11`).
2. Allow browser **Location** and **Microphone** permissions when prompted on the Demo page.
3. If you want custom photos for your city, place the 8 JPG files in `public/demo-images/`. Otherwise, the built-in canvas placeholders work seamlessly!

---

## 🌟 Key Features & "Wow Moments"

- **📸 Instant AI Triage (Gemini 2.0 Flash)**: Citizen uploads a photo and clicks "Analyze with AI". Gemini inspects the defect, evaluates public safety/traffic obstruction hazards, assigns severity (1-10) and urgency (critical/high/medium/low), predicts repair days, and routes it to the correct department.
- **🗺️ Interactive Map & Area Explorer**: Built with Leaflet & OpenStreetMap tiles. Clicking anywhere drops an Area Explorer circle (250m to 2km) with live reports ranked by distance, resolution times, and heatmap intensity.
- **🛡️ 50-Meter Duplicate Detection**: Automatically discovers existing open tickets within 50 meters of the pin and gives citizens a 1-click **Upvote (+1)** option to escalate community priority without cluttering field queues.
- **🎙️ Indian Multilingual Voice Notes**: Web Speech API integration with native **English (India, en-IN)** and **हिन्दी (Hindi, hi-IN)** toggles.
- **🔍 Anti-Cheat & Dual-Image AI Verification**:
  - Rejects duplicate before-photos via 64-bit perceptual image hashing.
  - Flags proof submitted more than 100 meters away from the report coordinates.
  - Gemini visual inspection compares Before vs After photos to verify genuine repairs before marking resolved.
- **⭐ Officer Rating & Consecutive Streak Engine**: Officers earn $+0.3$ for early resolutions, $+0.5$ for fast critical repairs, and $+0.2$ for every 3-ticket on-time streak. Drop below 3.0 triggers Flagged warnings; drop below 2.5 restricts critical dispatches.
- **🚨 3-Tier Automated Escalation & Overdue Engine**:
  - **Level 1**: Missed deadline penalty and status escalation.
  - **Level 2 (+24h)**: Automated dispatch to reallocate ticket to another department officer with capacity.
  - **Level 3 (+48h)**: Critical failure alert routed directly to the Municipal Commissioner.
  - **48h Citizen Auto-Accept**: Borderline AI fixes automatically resolve if the citizen does not object within 48 hours.
- **📊 Public Transparency Dashboard**: Real-time officer leaderboard, department turnaround metrics, and Recharts analytics (30-day intake vs resolution velocity, defects by category).

---

## 🛠️ Zero-Paid-Service Architecture & Tech Stack

| Layer | Technology | Cost / Plan |
|---|---|---|
| **Frontend Framework** | React 18 + Vite | Open Source |
| **Styling** | Tailwind CSS + Headless Badges | Open Source |
| **Routing** | React Router v6 | Open Source |
| **Authentication** | Firebase Authentication (Email/Password) | Free Spark Plan |
| **Database** | Cloud Firestore (Client SDK only) | Free Spark Plan |
| **Multimodal AI** | Gemini 2.0 Flash via `@google/genai` | Free Tier |
| **Maps & Geospatial** | Leaflet + React-Leaflet + Leaflet.heat | Open Source (OSM) |
| **Reverse Geocoding** | OpenStreetMap Nominatim (Cached & Throttled 1 req/sec) | Free |
| **Charts** | Recharts (Area, Bar) | Open Source |
| **Speech Recognition** | Browser Web Speech API (`en-IN`, `hi-IN`) | Native Browser API |

> [!IMPORTANT]
> **Zero Paid Service Guarantee**: Does NOT use Firebase Storage (photos compressed to $<900$ KB and stored as base64 in Firestore), Cloud Functions (all logic runs cleanly in `src/lib/`), FCM, or Google Maps API.

---

## 🚀 Setup & Installation

### 1. Clone & Install Dependencies
```bash
git clone <repository-url>
cd civiceye
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your Firebase and Gemini credentials:
```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:...

VITE_GEMINI_KEY=your_gemini_api_key
VITE_GEMINI_MODEL=gemini-3.8-flash
VITE_SEED_ENABLED=true
```

> [!TIP]
> **Gemini Active Model**: Check your current supported model names in [Google AI Studio](https://aistudio.google.com/). CivicEye defaults to `gemini-3.8-flash` via `VITE_GEMINI_MODEL`. If any model is deprecated or returns a 404, CivicEye automatically cascades through the fallback list (`gemini-3.8-flash` → `gemini-3.7-flash` → `gemini-3.6-flash` → `gemini-3.5-flash`), remembers the first working model, and switches to Safe Mode cached responses if all models are exhausted.

### 3. Firebase Console Configuration (One-Time)
1. **Enable Authentication**:
   - Go to **Firebase Console** -> **Authentication** -> **Sign-in method**.
   - Enable **Email/Password**.
2. **Enable Firestore Database**:
   - Go to **Firestore Database** -> **Create database** (Test mode or publish rules below):
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         allow read: if true;
         allow write: if request.auth != null;
       }
       match /reports/{reportId} {
         allow read: if true;
         allow create, update, delete: if request.auth != null;
       }
       match /ratings_log/{logId} {
         allow read: if true;
         allow write: if request.auth != null;
       }
     }
   }
   ```

### 4. Run Development Server
```bash
npm run dev
```
Open **http://localhost:5173/**.

---

## 🔑 Demo Accounts Reference

All demo accounts share the uniform password: **`Demo@1234`**

| Role | Email | Description / Focus |
|---|---|---|
| **Admin** | `admin@demo.com` | Municipal Commissioner (Global oversight, reassignment, review queue) |
| **Officer 1** | `officer1@demo.com` | Rajesh Kumar — Roads Lead (Rating 4.8, 6-ticket streak) |
| **Officer 2** | `officer2@demo.com` | Anita Sharma — Pavement Inspector (Public Works, Zone 2) |
| **Officer 3** | `officer3@demo.com` | Vikram Singh — Water Supply (Water Board, Zone 1) |
| **Officer 4** | `officer4@demo.com` | Pooja Patel — Drainage Engineer (Water Board, Zone 3) |
| **Officer 5** | `officer5@demo.com` | Suresh Menon — Grid Supervisor (Electrical, Rating 4.9) |
| **Officer 6** | `officer6@demo.com` | Kavita Reddy — Lighting Ops (**Rating 2.8 — Flagged Warning demo**) |
| **Officer 7** | `officer7@demo.com` | Manoj Joshi — Sanitation Chief (Sanitation, Zone 2) |
| **Officer 8** | `officer8@demo.com` | Deepa Nair — Waste Mgmt (**Rating 2.3 — Restricted from Critical demo**) |
| **Citizen 1** | `citizen1@demo.com` | Aarav Mehta (Active reports & confirmation prompts) |
| **Citizen 2** | `citizen2@demo.com` | Priya Iyer (Resolved report review) |
| **Citizen 3** | `citizen3@demo.com` | Rohan Gupta |

---

## ⏱️ 4-Minute Hackathon Demo Script

### **Minute 0:00 – 0:45: The Citizen Problem & AI "Wow Moment"**
1. **Open `http://localhost:5173/`**: Show the hero Leaflet map populated with live colored issue markers across the city.
2. **Log in as `citizen1@demo.com`** and click **📝 Report Issue**.
3. **Upload an image** of a road pothole or electrical wire. Point out the compression badge showing instant reduction to $<900$ KB.
4. **Click the gradient "✨ Analyze with AI" button**:
   - Highlight the animated blue laser scanner beam.
   - Show how Gemini automatically classifies the defect, estimates fix days, tags safety risks, calculates severity, and sets the urgency badge.
5. **Demonstrate Voice Notes**: Toggle between **English (IN)** and **हिन्दी (Hindi)** and speak: *"Water pipe burst near main gate"*. Show immediate transcription.
6. **Drop Pin on Map**: Click to adjust the coordinates and watch Nominatim reverse-geocode the street address in real time.
7. **Submit Ticket**: Click **🚀 Submit & Dispatch Officer**. Show toast confirming auto-assignment to the best-rated eligible officer.

### **Minute 0:45 – 1:45: Duplicate Detection & Area Explorer**
1. **Duplicate Detection Demonstration**:
   - Go back to `/report` and pick the same defect category at the same location.
   - Click submit: The **"Similar Report Already Exists"** dialog pops up!
   - Show the **👍 Upvote (+1)** button which increases ticket priority without creating redundant work orders.
2. **Area Explorer**:
   - Return to the map at `/`. Click anywhere on the map to drop the blue dashed circle.
   - Adjust the radius selector (**250m &bull; 500m &bull; 1km &bull; 2km**).
   - Point out the side panel listing nearby issues sorted by distance, with average resolution times.
   - Toggle the **🔥 Heatmap** button to reveal high-density problem clusters weighted by severity.

### **Minute 1:45 – 2:45: Officer Accountability & Anti-Cheat Verification**
1. **Switch Login to `officer1@demo.com`** and open **🛠️ My Tasks** (`/officer`).
2. **Officer Profile Card**: Show the 4.8 rating, 6-ticket streak, and active task count (2/10).
3. **Live Countdown Timers**: Show color-coded countdown badges (Green $>72$h, Amber $<24$h, Red Pulsing `🚨 OVERDUE`).
4. **Click "✓ Accept Task"**: Status flips to *In Progress*.
5. **Click "📸 Mark Resolved (Proof)"**:
   - First, upload the *same* photo as before: Show how the anti-cheat engine flags `anti_cheat_reused_before_photo` and blocks dishonest auto-approvals.
   - Next, upload the genuine "after" repair photo.
   - Click **Submit & Verify Work**: Gemini compares landmarks and pavement patterns in both photos, confirms the repair, marks the ticket *Resolved*, increments the officer's on-time streak, and logs a $+0.3$ rating bonus!

### **Minute 2:45 – 3:30: Escalation Engine & Admin Oversight**
1. **Switch Login to `admin@demo.com`** and open **⚙️ Admin** (`/admin`).
2. **Show the Escalation Header Banner**:
   - Point out Level 1 (Overdue), Level 2 (Auto-Reassigned after 24h), and Level 3 (Critical Municipal Failure).
3. **Click "⚡ Run Overdue Check"**:
   - Demonstrates the automated idempotent maintenance script running deadline penalties, streak resets, and 48-hour citizen auto-accepts.
4. **Flagged Officers Directory**: Point out Officer 6 (Rating 2.8 - Flagged) and Officer 8 (Rating 2.3 - Restricted from receiving Critical tasks).
5. **Verification Review Queue**: Show side-by-side Before/After comparisons with Gemini's visual analysis commentary and 1-click Approve / Reject overrides.

### **Minute 3:30 – 4:00: Public Transparency & Wrap-Up**
1. **Navigate to `http://localhost:5173/dashboard`** (Log out to demonstrate no login is needed).
2. **Showcase the Charts**:
   - 30-Day intake vs resolution velocity area chart.
   - Category breakdown and departmental turnaround speed.
   - Top 10 Officer Leaderboard honoring the city's highest-performing field crews.
3. **Conclusion**: Summarize that CivicEye connects citizens, field officers, and administrators with zero paid infrastructure—making civic accountability real-time, automated, and cheat-proof.

---

## 📁 Source Code Structure

```
civiceye/
├── src/
│   ├── components/
│   │   ├── AdminOverdueBanner.jsx       # Header widget with "Run Overdue Check"
│   │   ├── AdminReviewQueue.jsx         # Side-by-side proof photo verification
│   │   ├── CitizenConfirmationModal.jsx # Citizen 1-5 star repair rating
│   │   ├── CountdownTimer.jsx           # Live deadline countdown with overdue badge
│   │   ├── LocationPickerMap.jsx        # GPS auto-locate & Leaflet CircleMarker pin drop
│   │   ├── OfficerRatingCard.jsx        # Profile score, streak, active load & logs
│   │   ├── ReportCard.jsx               # Compact list card with distance & upvotes
│   │   ├── ReportDetailView.jsx         # 4-step timeline, full AI notes & review prompt
│   │   ├── StatusBadge.jsx              # Status, urgency, severity & escalation badges
│   │   └── VoiceNoteRecorder.jsx        # Web Speech API recorder (en-IN, hi-IN)
│   ├── contexts/
│   │   ├── AuthContext.jsx              # Firebase Auth state & Firestore user profile
│   │   └── ToastContext.jsx             # App-wide notification toasts
│   ├── lib/
│   │   ├── assign.js                    # Auto-assignment matching dept, zone & load
│   │   ├── duplicateCheck.js            # 50m radius duplicate detection & upvoting
│   │   ├── escalation.js                # Levels 1-3 escalation & overdue engine
│   │   ├── firebase.js                  # Firebase Client SDK initialization
│   │   ├── gemini.js                    # Gemini 2.0 Flash triage & visual audit
│   │   ├── geoUtils.js                  # Haversine distance & Nominatim rate-limiter
│   │   ├── imageUtils.js                # Canvas compression (<900KB) & perceptual hashing
│   │   ├── rating.js                    # Officer rating deltas, streaks & penalties
│   │   └── seedData.js                  # 25 realistic reports & demo accounts spec
│   ├── pages/
│   │   ├── AdminPanel.jsx               # Municipal command center & reassignment
│   │   ├── LoginPage.jsx                # Role-based redirect login
│   │   ├── MapPage.jsx                  # Hero map, area explorer & heatmap
│   │   ├── MyReportsPage.jsx            # Citizen ticket tracker
│   │   ├── OfficerDashboard.jsx         # Field tasks feed & resolution proof upload
│   │   ├── PublicDashboard.jsx          # Public transparency analytics & leaderboard
│   │   ├── ReportPage.jsx               # Citizen photo submission & AI scanning
│   │   ├── SeedPage.jsx                 # Idempotent demo data seeder (/seed)
│   │   └── SignupPage.jsx               # Citizen self-registration
│   ├── config.js                        # Tunable constants, thresholds & map coordinates
│   └── index.css                        # Tailwind directives & custom CSS animations
├── .env.example                         # Environment variables template
├── package.json                         # Dependencies & scripts
└── vite.config.js                       # Vite bundler configuration
```
