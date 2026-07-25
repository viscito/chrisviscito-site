import SwiftUI
import CrossfadeKit

/// R2 (synced imports) + R4 (provider badges).
struct LibraryView: View {
    @EnvironmentObject var model: AppModel
    @State private var showImport = false

    var body: some View {
        NavigationStack {
            List {
                Section("Your playlists") {
                    ForEach(model.playlists) { pl in
                        NavigationLink(value: pl.id) {
                            PlaylistRow(playlist: pl)
                        }
                    }
                }
            }
            .navigationTitle("Library")
            .navigationDestination(for: UUID.self) { id in
                if let pl = model.playlists.first(where: { $0.id == id }) {
                    PlaylistDetailView(playlist: pl)
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showImport = true } label: { Label("Import", systemImage: "square.and.arrow.down") }
                }
            }
            .sheet(isPresented: $showImport) { ImportView() }
        }
    }
}

struct PlaylistRow: View {
    @EnvironmentObject var model: AppModel
    let playlist: Playlist
    var body: some View {
        HStack(spacing: 13) {
            RoundedRectangle(cornerRadius: 12)
                .fill(LinearGradient(colors: [CrossfadeTheme.violet.opacity(0.7), CrossfadeTheme.aqua.opacity(0.5)],
                                     startPoint: .topLeading, endPoint: .bottomTrailing))
                .frame(width: 54, height: 54)
                .overlay(Text(playlist.title.prefix(1)).font(.title3.bold()).foregroundStyle(.white))
            VStack(alignment: .leading, spacing: 3) {
                Text(playlist.title).font(.callout.weight(.semibold))
                HStack(spacing: 8) {
                    Text(playlist.detail ?? "").font(.caption).foregroundStyle(.secondary)
                    if playlist.isSynced {
                        Label("Synced", systemImage: "arrow.triangle.2.circlepath")
                            .font(.system(size: 10, weight: .semibold)).foregroundStyle(CrossfadeTheme.ok)
                    }
                }
            }
        }
    }
}

/// R4 — a mixed-service playlist; each track badged with its provider, blocked
/// tracks locked (R1).
struct PlaylistDetailView: View {
    @EnvironmentObject var model: AppModel
    let playlist: Playlist

    var body: some View {
        List {
            Section {
                Button {
                    Task { await model.play(playlist: playlist) }
                } label: {
                    Label("Play", systemImage: "play.fill").frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent).tint(CrossfadeTheme.violet)
                .listRowInsets(EdgeInsets())
            }
            Section {
                ForEach(rows, id: \.ref.id) { row in
                    TrackRow(title: row.ref.title, artist: row.ref.artist, service: row.ref.service,
                             durationMillis: row.ref.durationMillis, locked: row.locked) {
                        Task { await model.playSingle(row.ref) }
                    }
                }
            } header: {
                Eyebrow(text: "R4 · every track shows its source")
            }
        }
        .navigationTitle(playlist.title)
    }

    private var rows: [(ref: TrackRef, locked: Bool)] {
        let playable = Set(model.connections.filter { $0.canPlay }.map { $0.service })
        return MockData.queue(for: playlist, connections: model.connections)
            .map { ($0, !playable.contains($0.service)) }
    }
}
