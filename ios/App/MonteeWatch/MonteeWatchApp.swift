import SwiftUI

// Montée sur Apple Watch : le score au poignet, point par point.
@main
struct MonteeWatchApp: App {
    init() { PhoneLink.shared.start() }
    var body: some Scene {
        WindowGroup { RootView().appBackground() }
    }
}
