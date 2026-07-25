// swift-tools-version: 5.9
import PackageDescription

// CrossfadeKit — the platform-agnostic core of Crossfade.
//
// This package deliberately has NO dependency on SwiftUI, MusicKit, Combine, or
// any Apple-only framework, so the conductor model, data model, and matching
// engine can be built and unit-tested on any platform (including CI on Linux).
//
// The iOS app and the concrete service adapters (AppleMusicAdapter, MusicKit,
// SwiftUI views) live in ../CrossfadeApp and depend on this package.
let package = Package(
    name: "CrossfadeKit",
    products: [
        .library(name: "CrossfadeKit", targets: ["CrossfadeKit"])
    ],
    targets: [
        .target(name: "CrossfadeKit"),
        .testTarget(name: "CrossfadeKitTests", dependencies: ["CrossfadeKit"])
    ]
)
