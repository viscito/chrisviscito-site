import SwiftUI
import CrossfadeKit

/// R3 (search across every linked platform) + R1 (play-blocked results flagged).
struct SearchView: View {
    @EnvironmentObject var model: AppModel
    @State private var query = "midnight"

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Eyebrow(text: "R3 · one search, every platform")
                    Text("Results fan out to your \(model.linkedServices.count) linked services, are merged by recording, and anything you can't play is flagged — not hidden.")
                        .font(.caption).foregroundStyle(.secondary)
                    HStack(spacing: 8) {
                        ForEach(model.linkedServices) { c in ProviderBadge(service: c.service, size: 20, showsName: true) }
                    }
                }
                Section {
                    ForEach(results, id: \.ref.id) { row in
                        TrackRow(title: row.ref.title, artist: row.ref.artist, service: row.ref.service,
                                 durationMillis: row.ref.durationMillis, locked: row.locked,
                                 subtitleSuffix: row.dupe ? "also on Apple Music" : nil) {
                            if !row.locked { Task { await model.playSingle(row.ref) } }
                        }
                    }
                }
            }
            .navigationTitle("Search")
            .searchable(text: $query, prompt: "Search across all your services")
        }
    }

    // Mock, deduped result set illustrating R3 fan-out + R1 locks.
    private var results: [(ref: TrackRef, locked: Bool, dupe: Bool)] {
        func ref(_ s: ServiceID, _ t: String, _ a: String, _ d: Int) -> TrackRef {
            TrackRef(unifiedTrackID: UUID(), service: s, providerTrackID: t,
                     mode: SupportedServices.descriptor(for: s)?.playbackMode ?? .inApp,
                     title: t, artist: a, durationMillis: d)
        }
        let playable = Set(model.connections.filter { $0.canPlay }.map { $0.service })
        let raw: [(TrackRef, Bool)] = [
            (ref(.appleMusic, "Midnight Signal", "Sable Court", 222_000), true),
            (ref(.appleMusic, "Midnight City Lights", "Aster Vale", 208_000), false),
            (ref(.spotify, "Midnight in Motion", "The Wavelengths", 250_000), false),
            (ref(.appleMusic, "Past Midnight", "Marlow", 185_000), false)
        ]
        return raw.map { ($0.0, !playable.contains($0.0.service), $0.1) }
    }
}
