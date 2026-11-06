# Personal Twitter

Upstream sources stay unchanged. `personal/scripts/build.mjs` builds an MV3
extension with guarded storage hooks, Nix overrides and text-only tweets.
`master` mirrors `insin/control-panel-for-twitter:master`; `personal` owns this
layer. The extension has its own stable public manifest key and ID; never change
`identity.json` during an upgrade. It contains no private key.

## Develop

Requires Node 24 and Playwriter. On Cata, the Home Manager module supplies:

```sh
twitter-personal-dev          # test, build, reload, watch
# Or from this repository:
node personal/scripts/dev.mjs --once
node personal/scripts/dev.mjs --build-only
```

The fork default branch is `personal`; `master` remains an upstream mirror.

The stable runtime directory is `~/.local/share/twitter-personal`; the config is
`~/.config/twitter-personal/config.json`. Optional environment overrides:
`TWITTER_PERSONAL_OUTPUT`, `TWITTER_PERSONAL_CONFIG`, `TWITTER_PERSONAL_CDP`.
Desktop Chromium's CDP endpoint is `127.0.0.1:9226`. The watcher owns an extensions
tab and a Twitter test tab; other tabs are not reloaded. Ctrl-C stops watching.
A failed check/build is reported; fix the issue and save to retry. Each reload also runs the DOM regression fixtures. A successful
reload prints a page snapshot and browser logs; inspect these before continuing.
Run browser regression fixtures explicitly with a Playwriter session:

```js
const tests = await import('file:///home/denis/github.com/denismaciel/control-panel-for-twitter/personal/tests/browser.mjs')
console.log(await tests.run({context}))
```

`twitter-personal-reset` restores the Nix-pinned build. Reload the extension and
Twitter afterwards (or restart Chromium). A Home Manager activation also restores
the pinned build. Development changes are deliberately not permanent deployment.

## Preferences

```json
{"settings":{"textOnly":true},"upstreamSettings":{"hideGrokNav":true}}
```

Nix-declared keys override saved browser preferences without replacing them.
Removing a declaration restores the saved preference, or upstream's default.
Undeclared preferences remain editable. Managed controls are marked in options.
Unknown keys/types/enum values fail the build against upstream `types.d.ts`;
runtime platform and mutable per-tweet state cannot be declared.

Text-only mode hides tweet media and replaces preview cards with text links.
Authors, avatars, timestamps, text, quoted text, composer and actions remain.
Media-only tweets retain a Show media button. Revealing is per rendered tweet;
it resets on navigation or DOM recycling. Hidden video playback is paused;
this is a presentation feature, not a network/download blocker.

## Installation and rollback

Back up the store extension preferences before enabling this fork. Cata removes
the store registration during the Nix switch; the saved backup is
`~/.local/state/twitter-personal/store-preferences.json`. On a manual installation,
disable the store version and leave it installed. Copy preferences once through the two extension
options pages' `chrome.storage.local` APIs if desired, never by editing Chrome's
profile files. Cata's Nix launcher loads the stable directory. Mac Chrome requires
one-time Developer mode → Load unpacked for that directory (the command-line
load flag is unavailable in branded Chrome). Use the same public manifest key.

To roll back: stop the watcher, disable Personal, set `twitterExperience.enable`
to false in Nix and rebuild. Restart Chromium to reinstall the store version,
restore its saved preferences via the options page storage API, and reload Twitter. To roll back a fork version, revert the source pin in dotfiles,
activate Home Manager, and reload the extension. No Twitter account data changes.

## Upstream updates

Keep a clean checkout. Do not reset `personal` to upstream or use GitHub's
force-sync on that branch. Fetch both remotes; review upstream changes, then:

```sh
git fetch upstream master
git fetch origin
git switch personal
git merge --ff-only origin/personal
git switch -c update/upstream-YYYY-MM-DD
git merge --no-edit upstream/master
node --test personal/tests/*.test.mjs
node personal/scripts/build.mjs
```

Run the browser fixtures and live checks (Home, thread, profile, scrolling,
Show/Hide media, disabling and restarting). Build guards intentionally fail if
upstream changes storage calls, script loading, or preference types. Review those
changes and update the adapter deliberately; do not just increase expected counts.
Push the update branch and open a PR **against personal in this fork**. Once
verified, merge it, fast-forward the mirror with
`git push origin upstream/master:master`, then bump the immutable revision and
hash in dotfiles and rebuild. Never push to the upstream repository.
