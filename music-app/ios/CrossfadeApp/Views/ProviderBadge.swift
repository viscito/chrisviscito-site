import SwiftUI
import CrossfadeKit

/// The per-provider identifying badge (R4). Stylized brand colors, not official
/// logos — matches the prototype and keeps trademark risk out of the skeleton.
struct ProviderBadge: View {
    let service: ServiceID
    var size: CGFloat = 22
    var showsName: Bool = false

    var body: some View {
        HStack(spacing: 7) {
            RoundedRectangle(cornerRadius: size * 0.3, style: .continuous)
                .fill(background)
                .frame(width: size, height: size)
                .overlay(Text(glyph).font(.system(size: size * 0.55, weight: .heavy)).foregroundStyle(.white))
                .overlay(RoundedRectangle(cornerRadius: size * 0.3).strokeBorder(.white.opacity(0.14)))
            if showsName {
                Text(service.displayName).font(.footnote.weight(.medium)).foregroundStyle(.secondary)
            }
        }
        .accessibilityLabel(service.displayName)
    }

    private var glyph: String {
        switch service {
        case .appleMusic:   return "♪"
        case .spotify:      return "≋"
        case .amazonMusic:  return "a"
        case .youTubeMusic: return "▷"
        case .pandora:      return "P"
        }
    }

    private var background: LinearGradient {
        let colors: [Color]
        switch service {
        case .appleMusic:   colors = [Color(red: 0.984, green: 0.361, blue: 0.455), Color(red: 0.980, green: 0.141, blue: 0.235)]
        case .spotify:      colors = [Color(red: 0.114, green: 0.725, blue: 0.329)]
        case .amazonMusic:  colors = [Color(red: 0.145, green: 0.753, blue: 0.835)]
        case .youTubeMusic: colors = [Color(red: 1.0, green: 0.231, blue: 0.188)]
        case .pandora:      colors = [Color(red: 0.294, green: 0.424, blue: 0.941)]
        }
        let full = colors.count == 1 ? [colors[0], colors[0]] : colors
        return LinearGradient(colors: full, startPoint: .topLeading, endPoint: .bottomTrailing)
    }
}

/// A small status pill for the R5 services browser.
struct StatusPill: View {
    let status: SupportStatus
    var body: some View {
        HStack(spacing: 5) {
            Circle().fill(color).frame(width: 7, height: 7)
            Text(status.label).font(.system(size: 11, weight: .semibold, design: .monospaced))
        }
        .padding(.horizontal, 8).padding(.vertical, 4)
        .background(color.opacity(0.14), in: Capsule())
        .foregroundStyle(color)
    }
    private var color: Color {
        switch status {
        case .live: return CrossfadeTheme.ok
        case .comingNext: return CrossfadeTheme.violet
        case .investigating: return CrossfadeTheme.warn
        case .notSupported: return CrossfadeTheme.no
        }
    }
}
