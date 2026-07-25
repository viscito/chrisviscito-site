# Crossfade — iOS skeleton

A Swift skeleton that turns the architecture docs into compiling structure. It is
split in two, exactly along the seam in [`../ARCHITECTURE.md`](../ARCHITECTURE.md):

```
ios/
├── CrossfadeKit/     ← platform-agnostic core (SwiftPM, no Apple frameworks)
│   └── Sources/CrossfadeKit/
│       ├── Model/        UnifiedTrack, TrackMapping, Playlist, ServiceConnection, ServiceID
│       ├── Playback/     TrackRef, PlaybackAdapter (protocol), PlaybackCoordinator (the conductor)
│       ├── Services/     MusicServiceClient (protocol) + DTOs
│       ├── Matching/     MatchingEngine (ISRC-first, fuzzy fallback)
│       ├── Sync/         PlaylistSyncEngine + UnifiedTrackCatalog (R2)
│       ├── Catalog/      SupportedServices (the R5 registry)
│       └── Mock/         MockData, MockPlaybackAdapter
│   └── Tests/            MatchingEngineTests, PlaybackCoordinatorTests
│
└── CrossfadeApp/     ← iOS layer (SwiftUI + MusicKit), depends on CrossfadeKit
    ├── App/             CrossfadeApp (@main), AppModel
    ├── Playback/        AppleMusicAdapter (MusicKit, Mode A)
    ├── Services/        AppleMusicClient (Apple Music API via MusicKit)
    └── Views/           Root, Library, Search, SupportedServices, Settings, Import, NowPlaying (+ crossfader)
```

## Why the split

`CrossfadeKit` has **no dependency on SwiftUI, MusicKit, or Combine**, so the
conductor, data model, and matching engine build and unit-test on any platform —
including CI. Adding a service is a new `PlaybackAdapter` + `MusicServiceClient` in
the app layer; the core never changes. This is the adapter abstraction from
ARCHITECTURE.md §4, made real.

## Where each requirement lives

| Req | In code |
|---|---|
| **R1** provider requirements | `ServiceConnection.canPlay`, `PlaybackAdapter.playabilityBlock`, coordinator skip logic, `SettingsView` |
| **R2** import, kept in sync | `Playlist.importedFrom`, `PlaylistSyncEngine` + `UnifiedTrackCatalog` (`Sync/`), `ImportView` |
| **R3** cross-platform search | `MusicServiceClient.search`, `MatchingEngine.unify`, `SearchView` |
| **R4** provider on every track | `TrackRef.service`, `ProviderBadge`, `TrackRow` |
| **R5** supported-services browser | `SupportedServices` registry, `SupportedServicesView` |
| Conductor / handoff | `PlaybackCoordinator`, `CrossfaderView` |

## Build & test the core (no Xcode needed)

```bash
cd CrossfadeKit
swift test        # runs MatchingEngineTests + PlaybackCoordinatorTests
```

## Run the app

The app runs against **mock adapters by default**, so it works in the simulator
with no entitlements. To try real Apple Music playback:

1. Create an iOS App target in Xcode; add the `CrossfadeApp/` sources and the
   `CrossfadeKit` package (File ▸ Add Package Dependencies ▸ Add Local).
2. Signing & Capabilities ▸ **+ MusicKit**.
3. Info.plist ▸ **NSAppleMusicUsageDescription** (a short why-string).
4. In `AppModel.init`, pass `useRealAppleMusic: true`.
5. Mint the Apple Music **developer token server-side** from your `.p8` key for the
   catalog *API* (never ship the key). MusicKit handles user-scoped auth on device.

## Honest limits of the skeleton

- `AppleMusicAdapter` end-of-track detection polls player state; production should
  also observe `queue.currentEntry`.
- `PlaylistSyncEngine` implements the R2 reconciliation (source-authoritative for
  imported items, preserving user-added `.local` items). It is one-way with local
  preservation; true two-way sync / conflict resolution is still future work. The
  scheduling that *drives* sync runs (backend job) is specced but not built here.
- Views are functional, not final visual design — the [prototype](../prototype/)
  is the source of truth for look and feel.
