import SwiftUI

@main
struct CrossfadeApp: App {
    @StateObject private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(model)
                .preferredColorScheme(.dark)   // committed "studio" look (see design docs)
                .tint(CrossfadeTheme.violet)
        }
    }
}

/// App palette, mirroring the prototype's tokens.
enum CrossfadeTheme {
    static let violet = Color(red: 0.545, green: 0.482, blue: 1.0)   // #8B7BFF
    static let aqua   = Color(red: 0.129, green: 0.827, blue: 0.769) // #21D3C4
    static let ok     = Color(red: 0.216, green: 0.788, blue: 0.545)
    static let warn   = Color(red: 0.961, green: 0.694, blue: 0.239)
    static let no     = Color(red: 1.0, green: 0.42, blue: 0.42)
    static let screen = Color(red: 0.059, green: 0.071, blue: 0.094)
    static let surface = Color(red: 0.086, green: 0.102, blue: 0.133)
}
