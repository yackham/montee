import SwiftUI
import WatchKit
import HealthKit

// Montée sur Apple Watch : le score au poignet, point par point.
@main
struct MonteeWatchApp: App {
    @WKApplicationDelegateAdaptor(WatchAppDelegate.self) var appDelegate
    init() { PhoneLink.shared.start() }
    var body: some Scene {
        WindowGroup { RootView().appBackground() }
    }
}

/// 3.55 : l'iPhone ouvre Montée sur la montre pour l'échauffement guidé (HKHealthStore.startWatchApp)
final class WatchAppDelegate: NSObject, WKApplicationDelegate {
    func handle(_ workoutConfiguration: HKWorkoutConfiguration) {
        // L'adversaire arrive par message juste après : on démarre tout de suite, il se complète ensuite
        DispatchQueue.main.async { PhoneLink.startGuidedWarmup(oid: nil) }
    }
}
