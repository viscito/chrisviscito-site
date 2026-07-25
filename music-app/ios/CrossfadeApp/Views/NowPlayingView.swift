import SwiftUI
import CrossfadeKit

struct NowPlayingView: View {
    @EnvironmentObject var model: AppModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        let snap = model.snapshot
        let now = snap.nowPlaying
        VStack(spacing: 0) {
            Capsule().fill(.white.opacity(0.2)).frame(width: 38, height: 5).padding(.top, 10)
            ScrollView {
                VStack(alignment: .leading, spacing: 6) {
                    RoundedRectangle(cornerRadius: 22)
                        .fill(LinearGradient(colors: [CrossfadeTheme.violet.opacity(0.7), CrossfadeTheme.surface],
                                             startPoint: .topLeading, endPoint: .bottomTrailing))
                        .aspectRatio(1, contentMode: .fit)
                        .overlay { if let s = now?.service { ProviderBadge(service: s, size: 64) } }
                        .padding(.vertical, 12)

                    Text(now?.title ?? "Nothing playing").font(.title2.weight(.bold))
                    Text(now?.artist ?? "").font(.body).foregroundStyle(.secondary)

                    if let s = now?.service {
                        Label("Playing from \(s.displayName)", systemImage: "dot.radiowaves.left.and.right")
                            .font(.caption.monospaced()).foregroundStyle(.secondary)
                            .padding(.top, 6)
                    }

                    // transport
                    HStack(spacing: 40) {
                        Button { Task { await model.previous() } } label: { Image(systemName: "backward.fill").font(.title) }
                        Button { Task { await model.togglePlayPause() } } label: {
                            Image(systemName: snap.isPlaying ? "pause.circle.fill" : "play.circle.fill")
                                .font(.system(size: 64))
                        }
                        Button { Task { await model.next() } } label: { Image(systemName: "forward.fill").font(.title) }
                    }
                    .frame(maxWidth: .infinity).foregroundStyle(.primary).padding(.top, 18)

                    if let s = snap.upNext, let n = snap.nowPlaying {
                        CrossfaderView(current: n.service, next: s.service, handoffPending: snap.handoffPending)
                            .padding(.top, 22)
                    }

                    if let skip = snap.lastSkip {
                        Text("Skipped “\(skip.ref.title)” — \(reason(skip.reason))")
                            .font(.caption).foregroundStyle(CrossfadeTheme.warn).padding(.top, 12)
                    }

                    Text("Audio is sourced from each track's own service. Crossfade conducts the handoff so you never leave the app.")
                        .font(.caption2).foregroundStyle(.tertiary).multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity).padding(.top, 16)
                }
                .padding(.horizontal, 22)
            }
        }
        .background(CrossfadeTheme.screen.ignoresSafeArea())
        .presentationDragIndicator(.hidden)
    }

    private func reason(_ b: PlayabilityBlock) -> String {
        switch b {
        case .notSubscribed: return "you're not subscribed to that service"
        case .notAuthorized: return "the service isn't linked"
        case .unavailableInRegion: return "it's unavailable in your region"
        case .leavesApp: return "it would open another app"
        }
    }
}

/// The signature element: visualizes the cross-service handoff (the conductor).
struct CrossfaderView: View {
    let current: ServiceID
    let next: ServiceID
    let handoffPending: Bool
    @State private var pos: CGFloat = 0.68

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Eyebrow(text: "Crossfade · handoff")
                Spacer()
                Text("\(Int(pos * 100))% → \(next.displayName)")
                    .font(.system(size: 11, design: .monospaced)).foregroundStyle(.tertiary)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(LinearGradient(colors: [CrossfadeTheme.violet, CrossfadeTheme.aqua],
                                             startPoint: .leading, endPoint: .trailing))
                        .frame(height: 6).opacity(0.85)
                        .padding(.horizontal, 22)
                    HStack {
                        ProviderBadge(service: current, size: 26)
                        Spacer()
                        ProviderBadge(service: next, size: 26)
                    }
                    Circle().fill(.white)
                        .frame(width: 26, height: 26)
                        .overlay(Circle().strokeBorder(CrossfadeTheme.screen, lineWidth: 3))
                        .shadow(color: CrossfadeTheme.violet.opacity(0.5), radius: 6)
                        .position(x: max(22, min(geo.size.width - 22, geo.size.width * pos)), y: 17)
                        .gesture(DragGesture().onChanged { v in
                            pos = min(0.94, max(0.06, v.location.x / geo.size.width))
                        })
                }
            }
            .frame(height: 34)
            HStack {
                Text("Now: ").foregroundStyle(.secondary) + Text(current.displayName).bold()
                Spacer()
                Text("Up next: ").foregroundStyle(.secondary) + Text(next.displayName).bold()
            }.font(.caption)
        }
        .padding(15)
        .background(CrossfadeTheme.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(.white.opacity(0.15)))
    }
}
