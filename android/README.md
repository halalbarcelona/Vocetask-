# Aura Task — Android (Play Store) packaging

Aura Task ships as a PWA, and Android has an official, Google-supported way
to wrap a PWA as a real Play Store app with no code rewrite: a **Trusted Web
Activity (TWA)** — a thin native shell that launches the live site
full-screen, no browser address bar. This folder holds everything that
config needs.

## What's already done

- **`twa-manifest.json`** — the complete TWA config: package id
  (`com.halalbarcelona.auratask`), colors, icons, and the `startUrl`, all
  pulled from the real deployed app. This is the one file
  [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) (Google's
  official CLI for this) needs.
- **A signing keystore was generated and sent to you directly** (not
  committed here — a signing key must never be in a public repo). If you
  don't have it anymore, see "Lost the keystore?" below.
- **Digital Asset Links** were added to `halalbarcelona.github.io`'s
  `.well-known/assetlinks.json` (on branch `claude/vocetask-repo-review-64t6kb`
  in that repo — **it needs to reach `main` before this works**, since that's
  what Chrome actually checks against). This is what lets Chrome trust the
  Android app as genuinely belonging to your site, so it opens with no
  address bar instead of falling back to a browser tab.

## What's NOT done, and why

I could not actually compile and sign the `.aab` file from this sandbox.
Building requires downloading Android SDK components from
`dl.google.com`, and that domain is blocked at the network level in this
environment (confirmed directly — same class of restriction that's blocked
reaching Supabase and the live site directly elsewhere in this project).
This isn't a shortcut or a guess — running Bubblewrap's own build command
here reproducibly fails at the exact step where it needs to download SDK
components. This last step needs to happen somewhere with normal internet
access: your own computer, or a CI runner (GitHub Actions' `ubuntu-latest`
runners have unrestricted internet and work fine for this).

## How to finish it (5–10 minutes, once, on a machine with normal internet)

1. Install Node.js if you don't have it, then:
   ```
   npm install -g @bubblewrap/cli
   ```
2. Copy your keystore file into this folder and name it `android.keystore`
   (it's git-ignored on purpose — never commit it).
3. From this `android/` folder, run:
   ```
   bubblewrap build
   ```
   First run: it'll offer to install a JDK and the Android SDK for you —
   say yes to both, it handles everything. It'll ask for your keystore
   password (the one in the file I sent you).
4. That produces `app-release-bundle.aab` — this is the exact file you
   upload to Play Console under Production → Create new release.

## Play Store submission itself

This is the one part that genuinely has to be you — Google requires a real
person to hold the developer account:
1. Create a Google Play Console account at
   https://play.google.com/console (one-time $25 fee, identity
   verification required — usually a day or two to clear).
2. Create a new app, fill in the store listing (screenshots, description,
   privacy policy — Aura Task's Privacy page can serve as that, at
   `https://halalbarcelona.github.io/Vocetask-/privacy`).
3. Upload the `.aab` from step 4 above under Production (or Internal
   testing first, to try it yourself before a public release).
4. Complete the content rating questionnaire and data safety form —
   straightforward for this app: no ads, no third-party trackers, only the
   task/account data described in the Privacy page.

## Lost the keystore?

You cannot recover it — that's the nature of a signing key. If this happens
before your first Play Store upload, it's not a disaster: delete
`aura-task-release.keystore` from wherever you saved it, generate a new one
(`keytool -genkeypair -v -keystore android.keystore -alias aura-task
-keyalg RSA -keysize 2048 -validity 10000`), get its SHA-256 fingerprint
(`keytool -list -v -keystore android.keystore -alias aura-task`), and
update `.well-known/assetlinks.json` in the halalbarcelona.github.io repo
with the new fingerprint. If you've *already* published to Play Store with
the lost key, Google's Play App Signing / key upgrade process is the way
out — search "Play Console lost upload key" for their current steps.
