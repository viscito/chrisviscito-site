import SwiftUI
import CrossfadeKit

/// R5 — browse the top 5 US services and each one's support status, driven by the
/// `SupportedServices` registry in CrossfadeKit.
struct SupportedServicesView: View {
    var body: some View {
        NavigationStack {
            List {
                Section {
                    Eyebrow(text: "R5 · top 5 US services")
                    Text("Support depends on whether a service lets playback stay **inside Crossfade** (the in-app-first policy).")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Section {
                    ForEach(SupportedServices.all) { d in
                        HStack(alignment: .top, spacing: 13) {
                            ProviderBadge(service: d.service, size: 44)
                            VStack(alignment: .leading, spacing: 5) {
                                HStack { Text(d.service.displayName).font(.callout.weight(.semibold)); Spacer(); StatusPill(status: d.status) }
                                Text(d.note).font(.caption).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                                Text("Requires \(d.requirement)").font(.caption2.monospaced()).foregroundStyle(.tertiary)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
            .navigationTitle("Supported services")
        }
    }
}
