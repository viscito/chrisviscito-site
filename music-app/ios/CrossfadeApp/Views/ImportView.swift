import SwiftUI
import CrossfadeKit

/// R2 — import playlists from a linked service; imported playlists stay in sync.
struct ImportView: View {
    @EnvironmentObject var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var source: ServiceID = .spotify
    @State private var imported: Set<String> = ["sp-pl-1"]  // "Late Night Drive" already imported

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Eyebrow(text: "R2 · kept in sync")
                    Text("Imported playlists stay **linked to the source** — when the original changes, Crossfade updates too.")
                        .font(.caption).foregroundStyle(.secondary)
                    Picker("Source", selection: $source) {
                        ForEach(model.linkedServices) { c in Text(c.service.displayName).tag(c.service) }
                    }.pickerStyle(.segmented)
                }
                Section {
                    ForEach(mockPlaylists(for: source), id: \.id) { pl in
                        HStack(spacing: 12) {
                            RoundedRectangle(cornerRadius: 10).fill(.ultraThinMaterial).frame(width: 44, height: 44)
                                .overlay(Text(pl.title.prefix(1)).font(.headline).foregroundStyle(.white))
                            VStack(alignment: .leading, spacing: 2) {
                                Text(pl.title).font(.callout.weight(.semibold))
                                Text("\(pl.trackCount) songs · \(source.displayName)").font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            if imported.contains(pl.id) {
                                Label("Synced", systemImage: "arrow.triangle.2.circlepath")
                                    .font(.system(size: 11, weight: .semibold)).foregroundStyle(CrossfadeTheme.ok)
                            } else {
                                Button("Import") { imported.insert(pl.id) }
                                    .buttonStyle(.bordered).tint(CrossfadeTheme.violet).controlSize(.small)
                            }
                        }.padding(.vertical, 3)
                    }
                }
            }
            .navigationTitle("Import playlists")
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() } } }
        }
    }

    private func mockPlaylists(for service: ServiceID) -> [ProviderPlaylist] {
        switch service {
        case .spotify:
            return [ProviderPlaylist(id: "sp-pl-1", service: .spotify, title: "Late Night Drive", trackCount: 22),
                    ProviderPlaylist(id: "sp-pl-2", service: .spotify, title: "Gym Reset", trackCount: 31),
                    ProviderPlaylist(id: "sp-pl-3", service: .spotify, title: "Rainy Sunday", trackCount: 15)]
        default:
            return [ProviderPlaylist(id: "am-pl-1", service: service, title: "Heavy Rotation", trackCount: 40),
                    ProviderPlaylist(id: "am-pl-2", service: service, title: "Road Trip 2025", trackCount: 64)]
        }
    }
}
