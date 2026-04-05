# Off The Record — Vinyl Trading App

A mobile-first vinyl record trading platform built with React, TypeScript, and Lovable Cloud.

## 🏗 Architecture Overview

```
src/
├── main.tsx                  # Entry point — mounts <App /> into #root
├── App.tsx                   # Provider hierarchy + routing
├── pages/
│   ├── Index.tsx             # Auth gate: loading → login → home
│   ├── LoginPage.tsx         # Email/password sign-up & sign-in
│   ├── HomePage.tsx          # Tab shell (Collection, Wishlist, Discover, Chats, Profile, Admin)
│   ├── DiscogsCallback.tsx   # OAuth callback for Discogs account linking
│   └── NotFound.tsx          # 404 fallback
├── components/
│   ├── screens/              # Full-screen tab content
│   │   ├── CollectionScreen  # User's vinyl records (CRUD, photos, grading)
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

## 🔄 Data Flow

```
User Action
  → React Component (useState / useEffect)
    → Supabase JS Client (query / mutation)
      → Lovable Cloud (Postgres + RLS policies)
        → Response
          → React state update → UI re-render
```

### Key data paths

| Flow | Tables involved | Notes |
|------|----------------|-------|
| Auth | `auth.users`, `profiles` | Profile auto-created on first sign-up |
| Collection | `user_records`, `record_photos` | Up to 4 photos per record |
| Wishlist | `user_wishlist` | Matches notify via `notifications` |
| Trading | `chats`, `chat_messages`, `trade_offers`, `trade_offer_items` | Realtime-enabled |
| Social | `friends`, `user_blocks`, `user_reports`, `user_reviews` | |
| Admin | `user_roles`, `admin_requests`, `profiles.account_status` | Role-gated via `has_role()` |

## 🔐 Security Model

- **Row-Level Security (RLS)** on every table — users can only access their own data unless explicitly shared.
- **Role-based access** via `user_roles` table + `has_role()` Postgres function (SECURITY DEFINER).
- Roles: `user`, `admin`, `main_admin`.
- Admin status is checked server-side, never from client storage.

## 🎨 Design System

- **Tailwind CSS v3** with semantic HSL tokens defined in `index.css` (`:root` variables).
- **shadcn/ui** components in `src/components/ui/` — customised via `components.json`.
- All colours use CSS variables (`--primary`, `--background`, etc.) for theme consistency.
- Mobile-first layout: `max-w-md` centred container with fixed bottom nav.

## 🛠 Key Design Decisions

1. **Single-page tab shell** — `HomePage.tsx` manages tabs via local state instead of URL routes. This gives native-app feel with Framer Motion transitions.

2. **Auth gate pattern** — `Index.tsx` renders login or home based on auth state. No protected route wrappers needed.

3. **Edge functions for sensitive ops** — Discogs OAuth, AI grading, and admin user management run server-side to protect secrets.

4. **PWA support** — Service worker via `vite-plugin-pwa` with offline caching for fonts and static assets.

5. **Capacitor-ready** — `capacitor.config.ts` present for native mobile builds (iOS/Android).

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript 5 |
| Build | Vite 5 |
| Styling | Tailwind CSS 3 + shadcn/ui |
| State | React Query + React Context |
| Backend | Lovable Cloud (Postgres, Auth, Storage, Edge Functions) |
| Animation | Framer Motion |
| PWA | vite-plugin-pwa |
| Mobile | Capacitor |

## 🚀 Local Development

```sh
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
npm install
npm run dev
```

The dev server runs at `http://localhost:8080`.
