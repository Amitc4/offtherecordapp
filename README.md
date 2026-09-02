<div align="center">

# 🎵 Off The Record

**AI-Powered Vinyl Marketplace & Objective Condition Grading**

[![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript_5-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite_5-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_3-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Lovable_Cloud-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Discogs](https://img.shields.io/badge/Discogs_API-333333?style=for-the-badge&logo=discogs&logoColor=white)](https://www.discogs.com/developers)
[![Spotify](https://img.shields.io/badge/Spotify_API-1ED760?style=for-the-badge&logo=spotify&logoColor=white)](https://developer.spotify.com/)

<p align="center">
  <img src="./assets/off-the-record-logo.png" alt="Off The Record Logo" width="180"/>
</p>

*Buying second-hand vinyl online is a gamble when relying solely on subjective seller grading.  
Off The Record uses computer vision and multimodal AI to inspect vinyl surfaces objectively, automate wishlist matching, and facilitate secure peer-to-peer trades.*

---
</div>

## 📌 Key Highlights

* **Objective Vinyl Grading:** Inspects surface photos, classifies optical hairline scratches and groove wear, and maps results to Goldmine standards.
* **Wishlist Easy Match:** Instant background alerts notify collectors when targeted pressings are listed near them in their preferred condition.
* **Powered by Spotify:** Syncs listening trends to suggest authentic, cataloged vinyl available for trade.
* **Peer-to-Peer Trading:** Real-time messaging, condition transparency, and trade negotiation built directly into the app shell.

---

## 🔬 Vinyl Grading Pipeline (Goldmine Standard Mapping)

Our multi-step inspection pipeline scores optical surface defects out of 100 and maps them directly to standardized collector conditions:

| Visual Score (%) | Goldmine Grade | Condition Summary |
| :--- | :--- | :--- |
| **98% – 100%** | **M (Mint)** | Absolutely flawless, unplayed, zero visible hairlines or sleeve friction under direct light. |
| **90% – 97%** | **NM (Near Mint)** | Nearly perfect; at most 1–2 microscopic paper scuffs that do not affect playback. |
| **80% – 89%** | **VG+ (Very Good Plus)** | Clean vinyl; minor cosmetic hairlines that do not degrade listening. |
| **65% – 79%** | **VG (Very Good)** | Noticeable light scratches and minor surface noise during playback. |
| **50% – 64%** | **G / G+ (Good Plus)** | Visible groove wear; surface noise present throughout but plays through without skipping. |
| **0% – 49%** | **P / F (Poor / Fair)** | Severe wear, warping, or deep scratches prone to sticking and skipping. |

---

## 🏗 Architecture Overview

```
src/
├── main.tsx                  # Entry point — mounts <App/> into #root
├── App.tsx                   # Provider hierarchy + routing
├── pages/
│   ├── Index.tsx             # Auth gate: loading → login → home
│   ├── LoginPage.tsx         # Email/password sign-up & sign-in
│   ├── HomePage.tsx          # Tab shell (Collection, Wishlist, Discover, Chats, Profile, Admin)
│   ├── DiscogsCallback.tsx   # OAuth callback for Discogs account linking
│   └── NotFound.tsx          # 404 fallback
├── components/
│   ├── screens/              # Full-screen tab content
│   │   ├── CollectionScreen  # User's vinyl records (CRUD, photos, AI grading)
│   │   ├── WishlistScreen    # Records the user wants to find
│   │   ├── DiscoverScreen    # Browse other users' for-sale records
│   │   ├── ChatsScreen       # Messaging + trade offers
│   │   ├── ProfileScreen     # User info, friends, Discogs link
│   │   └── AdminScreen       # User management (admin-only)
│   ├── ui/                   # shadcn/ui primitives (Button, Dialog, Sheet, etc.)
│   └── *.tsx                 # Feature components (dialogs, sheets, cards)
├── hooks/
│   ├── useAuth.tsx           # Auth context (sign-up, sign-in, sign-out, session)
│   ├── useAccessibility.tsx  # Persisted a11y prefs (font size, contrast, animations)
│   ├── useDiscogs.tsx        # Discogs API integration (search, import, link)
│   ├── useLocation.tsx       # Browser geolocation with caching
│   ├── useNotifications.tsx  # Notification polling & management
│   └── use-mobile.tsx        # Responsive breakpoint detection
├── integrations/supabase/
│   ├── client.ts             # Auto-generated Supabase client (DO NOT EDIT)
│   └── types.ts              # Auto-generated DB types (DO NOT EDIT)
├── lib/utils.ts              # Tailwind `cn()` helper
└── index.css                 # Design tokens (CSS variables) + Tailwind base
```

---

## 🔄 Data Flow

```
User Action
  → React Component (useState / React Query)
    → Supabase JS Client (query / mutation)
      → Lovable Cloud (Postgres + RLS policies)
        → Edge Functions (Discogs OAuth / Multimodal AI Grading)
          → Response
            → React state update → UI re-render
```

### Key Data Paths

| Flow | Tables Involved | Description |
| :--- | :--- | :--- |
| **Auth** | `auth.users`, `profiles` | Profile auto-created on first sign-up |
| **Collection** | `user_records`, `record_photos` | Up to 4 photos per record with Vinyl grading scan inspection |
| **Wishlist** | `user_wishlist`, `notifications` | Automatic matches dispatch alerts |
| **Trading** | `chats`, `chat_messages`, `trade_offers`, `trade_offer_items` | Realtime-enabled P2P negotiations |
| **Social** | `friends`, `user_blocks`, `user_reports`, `user_reviews` | Community trust scores and review system |
| **Admin** | `user_roles`, `admin_requests`, `profiles.account_status` | Role-gated via `has_role()` |

---

## 🔐 Security & Access Control

* **Row-Level Security (RLS):** Strict RLS on every table — users can only access their own records unless explicitly exposed to the marketplace.
* **Role-Based Access Control:** Managed through `user_roles` with `has_role()` PostgreSQL function (`SECURITY DEFINER`). Supported roles: `user`, `admin`, `main_admin`.
* **Edge Functions for Sensitive Operations:** Discogs OAuth token exchanges, Vinyl grading runs, and administrative actions execute server-side.

---

## 🎨 Design System & Decisions

* **Design Tokens:** Tailwind CSS v3 with semantic HSL tokens defined in `index.css` (`:root` variables) driving dark and light consistency.
* **Component Library:** Customized `shadcn/ui` primitives managed via `components.json`.
* **Single-Page Tab Shell:** `HomePage.tsx` coordinates tab state locally with Framer Motion transitions for native mobile responsiveness.
* **Auth Gate Pattern:** `Index.tsx` acts as a top-level gate switching directly between login and home without nested wrapper delays.
* **PWA & Native Support:** Integrated `vite-plugin-pwa` with static asset caching and `capacitor.config.ts` for iOS/Android builds.

---

## 📦 Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | React 18 + TypeScript 5 |
| **Build Tool** | Vite 5 |
| **Styling & UI** | Tailwind CSS 3, shadcn/ui, Lucide Icons |
| **State Management** | TanStack Query (React Query) + React Context |
| **Backend & Database** | Lovable Cloud (PostgreSQL, Supabase Auth & Storage, Edge Functions) |
| **Animation** | Framer Motion |
| **Mobile & PWA** | Capacitor, vite-plugin-pwa |

---

## 👥 Project Credits

* **Academic Institution:** The Academic College of Tel Aviv-Yaffo (MTA)
* **Project Number:** 15001229
* **Mentor:** Amir Kirsh
* **Authors:** Ido Raphaeli & Amit Chen
