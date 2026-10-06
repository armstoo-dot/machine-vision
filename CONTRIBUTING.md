# Contributing

Thanks for helping improve Machine Vision.

## Before opening a pull request

1. Create a focused branch from `main`.
2. Keep the interface on the AFL dark system: near-black ground, off-white text, mid-grey secondary. Colour belongs in the video, not the chrome.
3. Preserve local-only video processing. Do not add analytics, uploads or remote frame processing without an explicit product decision.
4. Run `pnpm build` and test upload, Tune, playback and export in a current Chromium browser.
5. Explain the user-facing reason for the change in the pull request.

Small, reviewable pull requests are preferred. For larger features, open an issue first so the interaction and scope can be discussed.
