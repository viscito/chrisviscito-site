import SwiftUI
import CrossfadeKit

/// R1 — manage links; a service can be linked without the required plan (browse/
/// search/import allowed, playback blocked).
struct SettingsView: View {
    @EnvironmentObject var model: AppModel

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(model.linkedServices) { c in
                        HStack(spacing: 13) {
                            ProviderBadge(service: c.service, size: 40)
                            VStack(alignment: .leading, spacing: 5) {
                                Text(c.service.displayName).font(.callout.weight(.semibold))
                                if c.canPlay {
                                    Label("Playable · \(c.planName ?? "Subscribed")", systemImage: "checkmark.seal.fill")
                                        .font(.caption).foregroundStyle(CrossfadeTheme.ok)
                                } else {
                                    Label("\(c.planName ?? "Free") · play-blocked", systemImage: "exclamationmark.triangle.fill")
                                        .font(.caption).foregroundStyle(CrossfadeTheme.warn)
                                }
                            }
                            Spacer()
                        }.padding(.vertical, 3)
                    }
                } header: {
                    Text("Linked services")
                } footer: {
                    Text("A service can be linked without its required plan — you can browse, search, and import, but playback stays blocked until you upgrade (R1).")
                }

                Section("Privacy") {
                    Text("Crossfade stores playlists and track references — never audio. Disconnecting a service deletes its stored tokens and cached library.")
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Settings")
        }
    }
}
