import Foundation
import HealthKit

/// Séance « Tennis » dans Santé / Forme : écran allumé pendant le match, cardio, calories, anneaux.
final class Workout: NSObject, ObservableObject, HKWorkoutSessionDelegate, HKLiveWorkoutBuilderDelegate {
    static let shared = Workout()
    let store = HKHealthStore()
    var session: HKWorkoutSession?
    var builder: HKLiveWorkoutBuilder?
    @Published var bpm: Double = 0
    @Published var avg: Double = 0
    @Published var maxBpm: Double = 0
    @Published var kcal: Double = 0
    @Published var running = false

    func authorize(_ done: @escaping () -> Void) {
        guard HKHealthStore.isHealthDataAvailable() else { done(); return }
        let share: Set<HKSampleType> = [HKObjectType.workoutType()]
        var read: Set<HKObjectType> = [HKObjectType.workoutType()]
        if let hr = HKObjectType.quantityType(forIdentifier: .heartRate) { read.insert(hr) }
        if let en = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) { read.insert(en) }
        if let dob = HKObjectType.characteristicType(forIdentifier: .dateOfBirth) { read.insert(dob) }
        store.requestAuthorization(toShare: share, read: read) { _, _ in DispatchQueue.main.async { done() } }
    }

    func start() {
        guard session == nil, HKHealthStore.isHealthDataAvailable() else { return }
        let c = HKWorkoutConfiguration()
        c.activityType = .tennis
        c.locationType = .unknown
        do {
            let s = try HKWorkoutSession(healthStore: store, configuration: c)
            let b = s.associatedWorkoutBuilder()
            b.dataSource = HKLiveWorkoutDataSource(healthStore: store, workoutConfiguration: c)
            s.delegate = self
            b.delegate = self
            session = s
            builder = b
            bpm = 0; avg = 0; maxBpm = 0; kcal = 0
            let now = Date()
            s.startActivity(with: now)
            b.beginCollection(withStart: now) { _, _ in }
            running = true
        } catch {
            session = nil; builder = nil
        }
    }

    func pause() { session?.pause() }
    func resume() { session?.resume() }

    /// Fréquence cardiaque max estimée : 220 − âge (date de naissance de Santé), sinon 190
    var maxHR: Double {
        if let c = try? store.dateOfBirthComponents(), let y = c.year {
            let age = Calendar.current.component(.year, from: Date()) - y
            if age > 8 && age < 100 { return Double(220 - age) }
        }
        return 190
    }

    /// Termine la séance ; save = false pour un match annulé (rien dans Santé).
    /// done reçoit l'identifiant de la séance Santé (pour éviter le doublon côté iPhone)
    func end(save: Bool = true, done: ((String?) -> Void)? = nil) {
        guard let s = session else { done?(nil); return }
        let b = builder
        s.end()
        running = false
        b?.endCollection(withEnd: Date()) { _, _ in
            if save {
                b?.finishWorkout { wk, _ in DispatchQueue.main.async { done?(wk?.uuid.uuidString) } }
            } else {
                b?.discardWorkout()
                DispatchQueue.main.async { done?(nil) }
            }
        }
        session = nil
        builder = nil
    }

    // MARK: HKWorkoutSessionDelegate
    func workoutSession(_ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState, from fromState: HKWorkoutSessionState, date: Date) {}
    func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {}

    // MARK: HKLiveWorkoutBuilderDelegate
    func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}
    func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
        for t in collectedTypes {
            guard let q = t as? HKQuantityType, let st = workoutBuilder.statistics(for: q) else { continue }
            if q.identifier == HKQuantityTypeIdentifier.heartRate.rawValue {
                let u = HKUnit.count().unitDivided(by: .minute())
                let now = st.mostRecentQuantity()?.doubleValue(for: u) ?? 0
                let a = st.averageQuantity()?.doubleValue(for: u) ?? 0
                let m = st.maximumQuantity()?.doubleValue(for: u) ?? 0
                DispatchQueue.main.async { self.bpm = now; self.avg = a; self.maxBpm = m }
            } else if q.identifier == HKQuantityTypeIdentifier.activeEnergyBurned.rawValue {
                let k = st.sumQuantity()?.doubleValue(for: .kilocalorie()) ?? 0
                DispatchQueue.main.async { self.kcal = k }
            }
        }
    }
}
