import SwiftUI
import CrossfadeKit

func mmss(_ millis: Int) -> String {
    let s = millis / 1000
    return String(format: "%d:%02d", s / 60, s % 60)
}

/// A track row with its provider badge (R4) and, when relevant, a play-blocked
/// lock (R1).
struct TrackRow: View {
    let title: String
    let artist: String
    let service: ServiceID
    let durationMillis: Int
    var locked: Bool = false
    var subtitleSuffix: String? = nil
    var onTap: (() -> Void)? = nil

    var body: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 9).fill(.ultraThinMaterial).frame(width: 46, height: 46)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.callout.weight(.semibold)).lineLimit(1)
                Text(artist + (subtitleSuffix.map { " · \($0)" } ?? ""))
                    .font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer()
            ProviderBadge(service: service, size: 22)
            if locked {
                Image(systemName: "lock.fill").font(.caption2).foregroundStyle(CrossfadeTheme.warn)
                    .accessibilityLabel("Playback needs the paid plan")
            }
            Text(mmss(durationMillis)).font(.caption2.monospaced()).foregroundStyle(.tertiary)
        }
        .padding(.vertical, 5)
        .contentShape(Rectangle())
        .opacity(locked ? 0.62 : 1)
        .onTapGesture { onTap?() }
    }
}

struct Eyebrow: View {
    let text: String
    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 11, weight: .semibold, design: .monospaced))
            .tracking(1.4)
            .foregroundStyle(CrossfadeTheme.violet)
    }
}
