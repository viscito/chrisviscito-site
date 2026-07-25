import SwiftUI
import CrossfadeKit

struct RootView: View {
    @EnvironmentObject var model: AppModel
    @State private var showNowPlaying = false

    var body: some View {
        ZStack(alignment: .bottom) {
            TabView {
                LibraryView().tabItem { Label("Library", systemImage: "square.stack") }
                SearchView().tabItem { Label("Search", systemImage: "magnifyingglass") }
                SupportedServicesView().tabItem { Label("Services", systemImage: "circle.grid.2x1") }
                SettingsView().tabItem { Label("Settings", systemImage: "gearshape") }
            }
            if model.snapshot.nowPlaying != nil {
                MiniPlayer(onTap: { showNowPlaying = true })
                    .padding(.horizontal, 8)
                    .padding(.bottom, 52) // sit above the tab bar
            }
        }
        .sheet(isPresented: $showNowPlaying) { NowPlayingView() }
    }
}

struct MiniPlayer: View {
    @EnvironmentObject var model: AppModel
    var onTap: () -> Void

    var body: some View {
        let now = model.snapshot.nowPlaying
        HStack(spacing: 11) {
            RoundedRectangle(cornerRadius: 9).fill(.ultraThinMaterial).frame(width: 38, height: 38)
                .overlay { if let s = now?.service { ProviderBadge(service: s, size: 18) } }
            VStack(alignment: .leading, spacing: 1) {
                Text(now?.title ?? "—").font(.subheadline.weight(.semibold)).lineLimit(1)
                Text(now?.artist ?? "").font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer()
            Button {
                Task { await model.togglePlayPause() }
            } label: {
                Image(systemName: model.snapshot.isPlaying ? "pause.fill" : "play.fill").font(.title3)
            }.buttonStyle(.plain)
        }
        .padding(9)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 15).strokeBorder(.white.opacity(0.12)))
        .contentShape(Rectangle())
        .onTapGesture(perform: onTap)
    }
}
