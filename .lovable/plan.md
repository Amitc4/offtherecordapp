## Diagnosis

The edge function logs show the exact cause, repeated on every attempt:

```
Spotify /me failed 403 — The user is not registered for this application.
Please check your settings on https://developer.spotify.com/dashboard.
```

This is **not a bug in the code**. The Spotify OAuth flow itself succeeds (the token exchange returns 200), but the very next call — `GET https://api.spotify.com/v1/me` — is rejected by Spotify with `403`.

That specific 403 message only comes from Spotify when the Spotify app is in **Development Mode** and the signed-in Spotify user's email is **not** on the app's allowlist. In Development Mode, Spotify limits access to up to 25 explicitly listed users; everyone else gets this exact error even after they approve the consent screen.

The client ID / client secret currently stored (`c4a629ab…` / `e1e49af8…`) are being accepted (otherwise token exchange would fail, not `/me`), so the credentials themselves are fine. The redirect URI is also fine (otherwise consent would 400 before reaching this step). The blocker is purely the Spotify Dashboard "User Management" list.

## What needs to change (no code changes)

All fixes happen in the Spotify Developer Dashboard for the app whose Client ID is `c4a629ab6d3f4e31b1d04be033d18ce8`:

1. Open https://developer.spotify.com/dashboard → select this app → **Settings**.
2. In **User Management**, add every Spotify account email that should be able to connect (yours and any tester's). The email must match the email on the person's Spotify account, not their Off The Record login.
3. Confirm **Redirect URIs** include both:
   - `https://offtherecordapp.lovable.app/spotify/callback`
   - `https://id-preview--cb001185-69e1-4b05-b54d-b8f03a2f28aa.lovable.app/spotify/callback`
   - `http://localhost:8080/spotify/callback` (only if testing locally)
4. Save. Retry the connect flow — no need to redeploy anything.

To remove the 25-user limit permanently, request **Extension / Production mode** from the same Settings page ("Extended Quota Mode"). Spotify approves this in a few days once they see the app's privacy policy and terms of service URLs.

## Optional code polish (only if you want it)

The 403 error message the app currently shows is already tailored for this case, but the toast in the UI only shows it during the initial `exchange`. If you'd like, I can:
- Surface the same "add your email to the Spotify allowlist" hint on the Discover screen when the **Recommended** feed hits the same 403 later.
- Add a small "Reconnect Spotify" button on the Profile screen that clears stale tokens if the user was removed from the allowlist.

Say the word if you want either of those; otherwise the Dashboard change alone will fix the connection.

## Verification

After adding your Spotify email in the Dashboard:
1. Sign out and back into Spotify in the browser (so Spotify re-issues consent for the allowlisted account).
2. Tap **Connect Spotify** on the Profile screen.
3. Expect a "Spotify connected as {name}!" toast and no more 403 in the edge function logs.
