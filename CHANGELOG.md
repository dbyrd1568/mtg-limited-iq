# MTG Limited IQ — Changelog

All notable changes to this project will be documented here.


## [1.2.2](https://github.com/dbyrd1568/mtg-limited-iq/compare/v1.2.1...v1.2.2) (2026-09-12)

### 🐛 Bug Fixes

* **scryfall:** check Scryfall on load to reveal new spoiler cards and update FRA count ([aa39604](https://github.com/dbyrd1568/mtg-limited-iq/commit/aa3960428b857054decf124979e69d660c1122b4))

## [1.2.1](https://github.com/dbyrd1568/mtg-limited-iq/compare/v1.2.0...v1.2.1) (2026-09-12)

### ✨ Features

* add Use Grade Average button at top of similar cards modal ([0a0bb0b](https://github.com/dbyrd1568/mtg-limited-iq/commit/0a0bb0b27abe71a8a41aa7b4ca8b16e2a8baa93e))

## [1.2.0](https://github.com/dbyrd1568/mtg-limited-iq/compare/v1.1.0...v1.2.0) (2026-09-12)

### ✨ Features

* add attack-triggered keyword mentor similarity signal and bump similarity cache to v21 ([d7800bd](https://github.com/dbyrd1568/mtg-limited-iq/commit/d7800bd374307f1850fbfd16375980caa389f491))
* add missing sets (TLA, TMT, FIN, EOE, SPM, ECL, MSH, MBC, FRA, TRK) and fix 17Lands badges — only TRK and FRA excluded ([f446fc3](https://github.com/dbyrd1568/mtg-limited-iq/commit/f446fc371c953275fc956efe8e47face370f0cbc))
* sync card filters (search, colors, rarities, roles) across Grading and Cards tabs ([2b42768](https://github.com/dbyrd1568/mtg-limited-iq/commit/2b42768943c66905dcba15654b17961a84096903))

### 🐛 Bug Fixes

* **17lands:** add Cloudflare Worker proxy and preloaded benchmark sets ([fba7049](https://github.com/dbyrd1568/mtg-limited-iq/commit/fba7049d28d23171bb2c4586c1cf6f9d1a468a47))
* add Cloudflare secret fallbacks in deploy workflow ([c3891d9](https://github.com/dbyrd1568/mtg-limited-iq/commit/c3891d91edc848d49a810f857fb8a984507251bc))
* add wrangler.toml with compatibility_date ([658186f](https://github.com/dbyrd1568/mtg-limited-iq/commit/658186f67b8a3d54bea08b5d0c46ed193c9d3fb6))
* pass --assets to wrangler deploy ([724d73d](https://github.com/dbyrd1568/mtg-limited-iq/commit/724d73d616924b5be8f70b718d02018dd5d0679d))
* remove asset binding for assets-only worker ([8740a2c](https://github.com/dbyrd1568/mtg-limited-iq/commit/8740a2c66df3749cddaf68be6df7838db7317baa))
* switch deploy workflow to cloudflare/pages-action@v1 ([d378e38](https://github.com/dbyrd1568/mtg-limited-iq/commit/d378e38881be59e602c0a1bbb9acbc26ab22c8b6))

### 🔧 Chores

* add GitHub Actions deploy workflow to Cloudflare Pages ([3c8ecac](https://github.com/dbyrd1568/mtg-limited-iq/commit/3c8ecacde663895214e8aa4cac85c1ed4ad422d8))
* add release-it, conventional commits, and husky commit-msg enforcement ([ba2079a](https://github.com/dbyrd1568/mtg-limited-iq/commit/ba2079a3bfa594b53bae6d92a7df1a8b1c7e420e))
* setup automated deploy on version bump ([a94af8b](https://github.com/dbyrd1568/mtg-limited-iq/commit/a94af8b8326b0bb3bcea04a95da69224ebce8e99))

## [1.1.1](https://github.com/devbyrd/mtg-limited-iq/compare/v1.1.0...v1.1.1) (2026-09-09)

### 🔧 Chores

* add release-it, conventional commits, and husky commit-msg enforcement ([ba2079a](https://github.com/devbyrd/mtg-limited-iq/commit/ba2079a3bfa594b53bae6d92a7df1a8b1c7e420e))
