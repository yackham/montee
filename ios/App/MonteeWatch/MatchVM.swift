import Foundation
import WatchKit
import WidgetKit

/// Préparation du match (retenue d'une fois sur l'autre)
final class Draft: ObservableObject {
    static let shared = Draft()
    @Published var hom: Bool { didSet { UserDefaults.standard.set(hom, forKey: "montee.hom") } }
    @Published var fmt: String { didSet { UserDefaults.standard.set(fmt, forKey: "montee.fmt") } }
    /// 3.34 : façon de compter : false = simple (Moi / Lui), true = avancé (gestes, fautes, aces)
    @Published var adv: Bool { didSet { UserDefaults.standard.set(adv, forKey: "montee.adv") } }
    /// Ouvert depuis la complication « Lancer un match »
    @Published var openSetup = false
    init() {
        let u = UserDefaults.standard
        hom = (u.object(forKey: "montee.hom") as? Bool) ?? true
        fmt = u.string(forKey: "montee.fmt") ?? "full"
        adv = u.bool(forKey: "montee.adv")
    }
}

/// Match en cours, sauvegardé à chaque point (rien ne se perd si l'app est relancée)
struct Live: Codable {
    var oid: String
    var name: String
    var rank: String
    var hom: Bool
    var fmt: String
    var srv0: Int
    var ev: [Ev] = []
    /// 3.53 : l'heure de chaque événement (secondes depuis t0), pour poser le score sur la courbe cardio
    var evT: [Int]? = nil
    var t0 = Date()
    var t1: Date? = nil
    var forced: Int? = nil     // résultat choisi si le match s'arrête avant la fin (0 = victoire, 1 = défaite)
    var sent = false
    var changeAt: Date? = nil
    var changeSeen = -1
    var free = false           // ce match utilise le match offert du mois
    // 3.35 : pause (le chrono s'arrête aussi)
    var pausedAt: Date? = nil
    var pausedTotal: Double? = nil
    // 3.42 : coaching au changement de côté (Montée+ ou match offert)
    var plan: [WStep]? = nil
    var cueGi: Int? = nil
    var cueId: String? = nil
    var cueN: [String: Int]? = nil
    var cueCache: Cue? = nil
}

/// Échauffement avant le match : la séance Santé tourne déjà, le serveur se choisit à la fin
struct WarmUp: Codable {
    var opp: WOpp
    var hom: Bool
    var fmt: String
    var t0 = Date()
    /// 3.55 : échauffement guidé lancé depuis l'iPhone (4 étapes, une vibration à chaque changement)
    var guided: Bool? = nil
}

/// 3.55 : les 4 étapes de l'échauffement guidé (mêmes durées que l'iPhone), en secondes
let WARM_STEPS: [(t: String, s: String, d: Int)] = [
    ("Corps", "Footing, pas chassés, montées de genoux.", 180),
    ("Mini-tennis", "Au filet : toucher, sans forcer.", 120),
    ("Services", "5 en 1re, 5 en 2de. Vise 70 % de 1res.", 120),
    ("Ta phrase", "Puis 3 respirations lentes.", 60)
]
/// Étape en cours (WARM_STEPS.count = terminé) et secondes restantes dans l'étape
func warmStep(_ elapsed: Int) -> (k: Int, left: Int) {
    var acc = 0
    for (i, x) in WARM_STEPS.enumerated() {
        if elapsed < acc + x.d { return (i, acc + x.d - elapsed) }
        acc += x.d
    }
    return (WARM_STEPS.count, 0)
}

/// Ce que l'iPhone reçoit à la fin du match
struct OutStats: Codable { var me: ServeStats; var him: ServeStats }
struct OutHR: Codable { var avg: Double; var max: Double }
struct OutMatch: Codable {
    var oid: String?
    var name: String
    var rank: String
    var hom: Bool
    var fmt: String
    var result: String
    var score: String
    var minutes: Int
    var date: String
    var serve: OutStats
    var hr: OutHR?
    var kcal: Double?
    var ev: String
    /// 3.53 : secondes depuis le début, une par caractère de `ev` ; début du match (ms) ; FC max utilisée pour les zones
    var evT: [Int]? = nil
    var t0: Double? = nil
    var maxHR: Double? = nil
    /// 3.47 : qui a servi en premier (0 = toi) : l'iPhone rejoue le match point par point (doubles fautes, balles de break)
    var srv0: Int? = nil
}

final class MatchVM: ObservableObject {
    static let shared = MatchVM()
    @Published var live: Live?
    @Published var warmup: WarmUp?
    private let key = "montee.live"
    private let wkey = "montee.warmup"

    init() {
        if let d = UserDefaults.standard.data(forKey: key), let l = try? JSONDecoder().decode(Live.self, from: d) {
            live = l
            if l.t1 == nil { DispatchQueue.main.async { Workout.shared.start() } }
        } else if let d = UserDefaults.standard.data(forKey: wkey), let w = try? JSONDecoder().decode(WarmUp.self, from: d) {
            warmup = w
            DispatchQueue.main.async { Workout.shared.start(); self.scheduleWarmBuzz() }
        }
    }

    private func saveWarm() {
        if let w = warmup, let d = try? JSONEncoder().encode(w) { UserDefaults.standard.set(d, forKey: wkey) }
        else { UserDefaults.standard.removeObject(forKey: wkey) }
    }

    /// Échauffement : la séance Tennis démarre (cardio, calories), le match n'est pas encore compté
    func beginWarmup(opp: WOpp, hom: Bool, fmt: String, guided: Bool = false) {
        warmup = WarmUp(opp: opp, hom: hom, fmt: fmt, guided: guided ? true : nil)
        saveWarm()
        Workout.shared.start()
        buzz(.start)
        scheduleWarmBuzz()
    }

    /// 3.55 : l'iPhone précise l'adversaire après coup (la montre a pu s'ouvrir avant de recevoir le message)
    func setWarmOpp(_ opp: WOpp) {
        guard var w = warmup else { return }
        w.opp = opp
        if let h = opp.hom { w.hom = h }
        warmup = w
        saveWarm()
    }

    /// 3.55 : une vibration à chaque étape, même poignet baissé (la séance Santé garde l'app active)
    private func scheduleWarmBuzz() {
        guard let w = warmup, w.guided == true else { return }
        let t0 = w.t0
        var acc = 0
        for (i, x) in WARM_STEPS.enumerated() {
            acc += x.d
            let at = t0.addingTimeInterval(TimeInterval(acc)).timeIntervalSinceNow
            guard at > 0 else { continue }
            let last = i == WARM_STEPS.count - 1
            DispatchQueue.main.asyncAfter(deadline: .now() + at) { [weak self] in
                guard let self = self, self.live == nil, let cur = self.warmup, cur.t0 == t0 else { return }
                self.buzz(last ? .success : .directionUp)
                if last { DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { WKInterfaceDevice.current().play(.success) } }
            }
        }
    }

    func cancelWarmup() {
        Workout.shared.end(save: false)
        warmup = nil
        saveWarm()
    }

    var state: MatchState {
        guard let l = live else { return MatchState() }
        return replay(srv0: l.srv0, fmt: l.fmt, ev: l.ev)
    }

    /// 3.36 : le format du 3e set se choisit à 1 set partout (fmt « ? » = pas encore choisi, joué comme un set classique)
    var needsThird: Bool {
        guard let l = live, l.fmt == "?", l.t1 == nil, l.forced == nil else { return false }
        let M = state
        return M.winner == nil && M.sets.count == 2 && M.setsWon == [1, 1]
    }
    /// Le 3e set a commencé (ou va commencer) : on peut en changer le format depuis le menu
    var thirdReached: Bool {
        let M = state
        guard M.sets.count >= 2 else { return false }
        let w0 = M.sets[0].a > M.sets[0].b, w1 = M.sets[1].a > M.sets[1].b
        return w0 != w1
    }
    func setThird(_ f: String) {
        guard var l = live, l.fmt != f else { return }
        l.fmt = f
        live = l
        save()
        buzz(.click)
    }

    var showChange: Bool {
        guard let l = live else { return false }
        let M = state
        return M.change && M.rest > 0 && l.changeSeen != l.ev.count
    }

    var paused: Bool { live?.pausedAt != nil }
    /// Temps de jeu en secondes, pauses retirées
    func playedSeconds(_ now: Date = Date()) -> Double {
        guard let l = live else { return 0 }
        let end = l.t1 ?? l.pausedAt ?? now
        return max(0, end.timeIntervalSince(l.t0) - (l.pausedTotal ?? 0))
    }
    /// Pause / reprise : la séance Santé et le chrono du match
    func togglePause() {
        guard var l = live, l.t1 == nil else { return }
        if let p = l.pausedAt {
            l.pausedTotal = (l.pausedTotal ?? 0) + Date().timeIntervalSince(p)
            l.pausedAt = nil
            Workout.shared.resume()
        } else {
            l.pausedAt = Date()
            Workout.shared.pause()
        }
        live = l
        save()
        buzz(.click)
    }

    func elapsed(_ now: Date = Date()) -> String {
        guard live != nil else { return "" }
        let s = Int(playedSeconds(now))
        return s >= 3600 ? String(format: "%d:%02d:%02d", s / 3600, (s % 3600) / 60, s % 60) : String(format: "%d:%02d", s / 60, s % 60)
    }

    private func save() {
        if let l = live, let d = try? JSONEncoder().encode(l) { UserDefaults.standard.set(d, forKey: key) }
        else { UserDefaults.standard.removeObject(forKey: key) }
        shareScore()
    }

    /// Score pour la complication « Score en direct »
    private func shareScore() {
        var dict: [String: Any] = ["on": false, "me": "", "him": "", "sets": "", "srvMe": false]
        if let l = live, l.t1 == nil, l.forced == nil {
            let M = state
            var sets = M.scoreText
            if M.games[0] + M.games[1] > 0 || sets.isEmpty { sets += (sets.isEmpty ? "" : " ") + "\(M.games[0])-\(M.games[1])" }
            dict = ["on": true, "me": M.pointText(0), "him": M.pointText(1), "sets": sets, "srvMe": M.server == 0]
        }
        if let d = try? JSONSerialization.data(withJSONObject: dict) { sharedDefaults?.set(d, forKey: "montee.liveScore") }
        WidgetCenter.shared.reloadTimelines(ofKind: "MonteeLive")
    }

    private func buzz(_ t: WKHapticType) { WKInterfaceDevice.current().play(t) }

    /// Balle de break : double tape (vers le haut pour toi, vers le bas à sauver) ; set ou match : appuyé
    private func buzzImportant(_ i: Importance) {
        let t: WKHapticType = i.level >= 2 ? .notification : (i.mine ? .directionUp : .directionDown)
        for k in 0..<2 {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.45 + Double(k) * 0.3) { WKInterfaceDevice.current().play(t) }
        }
    }

    func begin(opp: WOpp, hom: Bool, fmt: String, srv0: Int) {
        let link = PhoneLink.shared
        live = Live(oid: opp.id, name: opp.name, rank: opp.rank, hom: hom, fmt: fmt, srv0: srv0)
        live?.plan = opp.plan
        live?.free = !link.hasPlus && !link.freeUsed
        warmup = nil
        saveWarm()
        save()
        link.useFree()
        Workout.shared.start()
        buzz(.start)
    }

    func tap(_ e: Ev) {
        guard var l = live, l.t1 == nil, l.forced == nil else { return }
        // 3.53 : anciens matchs en cours sans horodatage : on aligne avec des -1 (inconnus)
        var tt = l.evT ?? Array(repeating: -1, count: l.ev.count)
        while tt.count < l.ev.count { tt.append(-1) }
        tt.append(Int(Date().timeIntervalSince(l.t0)))
        l.evT = tt
        l.ev.append(e)
        let M = replay(srv0: l.srv0, fmt: l.fmt, ev: l.ev)
        if M.winner != nil { l.t1 = Date() }
        if M.change { l.changeAt = Date(); pickCue(M, &l) }
        live = l
        save()
        // 3.47 (retour testeur) : sentir sans regarder : ton point ≠ son point ≠ faute ; changement de côté et fin de set bien marqués
        if M.winner != nil { buzz(.success); DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { WKInterfaceDevice.current().play(.success) } }
        else if M.setBreak { buzz(.notification) }
        else if M.change { buzz(.start) }
        else if e == .fault { buzz(M.second ? .retry : .directionDown) }   // 1re faute : « retry » ; double faute = son point
        else if e == .him { buzz(.directionDown) }
        else { buzz(.success) }                                           // ton point (ou ace)
        // Point important qui arrive : une vibration à part, juste après celle du point
        if e != .fault, M.winner == nil, let imp = M.importance { buzzImportant(imp) }
    }

    func undo() {
        guard var l = live, !l.ev.isEmpty, !l.sent else { return }
        l.ev.removeLast()
        if var tt = l.evT, !tt.isEmpty { tt.removeLast(); l.evT = tt }
        l.t1 = nil
        l.forced = nil
        live = l
        save()
        buzz(.retry)
    }

    /// 3.42 : la consigne du changement de côté, choisie au moment du changement (pas pendant l'affichage)
    func pickCue(_ M: MatchState, _ l: inout Live) {
        let st = gameStreak(srv0: l.srv0, fmt: l.fmt, ev: l.ev)
        let cands = coachCues(M, plan: l.plan ?? [], streak: st)
        guard !cands.isEmpty else { l.cueId = nil; return }
        var seen = l.cueN ?? [:]
        var best = cands[0], bestS = Int.min
        for c in cands {
            if c.id == l.cueId && cands.count > 1 { continue } // jamais deux fois de suite la même carte
            let s = c.prio - (seen[c.id] ?? 0) * 4 // une carte déjà vue cède vite la place
            if s > bestS { bestS = s; best = c }
        }
        seen[best.id] = (seen[best.id] ?? 0) + 1
        l.cueGi = M.gi; l.cueId = best.id; l.cueN = seen; l.cueCache = best
    }
    func cue(_ M: MatchState) -> Cue? {
        guard let l = live, let id = l.cueId, l.cueGi == M.gi else { return nil }
        if let c = l.cueCache, c.id == id { return c }
        return coachCues(M, plan: l.plan ?? []).first { $0.id == id }
    }

    func dismissChange() {
        guard var l = live else { return }
        l.changeSeen = l.ev.count
        live = l
        save()
    }

    func switchServer() {
        guard var l = live else { return }
        l.srv0 = 1 - l.srv0
        live = l
        save()
        buzz(.click)
    }

    /// Arrêt avant la fin (abandon, pluie…) : on choisit le résultat
    func stop(result: Int) {
        guard var l = live else { return }
        l.forced = result
        l.t1 = l.t1 ?? Date()
        live = l
        save()
    }

    /// Enregistre : séance Tennis dans Santé, match envoyé à l'iPhone
    func finish() {
        guard var l = live, !l.sent else { return }
        let M = state
        let w = Workout.shared
        let res = l.forced ?? M.winner ?? 0
        var score = M.scoreText
        if l.forced != nil && (M.games[0] + M.games[1]) > 0 { score += (score.isEmpty ? "" : " ") + "\(M.games[0])-\(M.games[1])" }
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        let oid: String? = (l.oid == "new" || l.oid.hasPrefix("n:")) ? nil : l.oid
        let out = OutMatch(oid: oid, name: l.name, rank: l.rank, hom: l.hom, fmt: l.fmt == "stb" ? "stb" : "full",
                           result: res == 0 ? "V" : "D", score: score,
                           minutes: max(1, Int(playedSeconds() / 60)),
                           date: f.string(from: l.t0),
                           serve: OutStats(me: M.stats[0], him: M.stats[1]),
                           hr: w.avg > 0 ? OutHR(avg: w.avg, max: w.maxBpm) : nil,
                           kcal: w.kcal > 0 ? w.kcal : nil,
                           ev: l.ev.map { $0.rawValue }.joined(),
                           evT: (l.evT?.count == l.ev.count) ? l.evT : nil,
                           t0: l.t0.timeIntervalSince1970 * 1000,
                           maxHR: w.maxHR,
                           srv0: l.srv0)
        if let d = try? JSONEncoder().encode(out), let j = String(data: d, encoding: .utf8) { PhoneLink.shared.send(match: j) }
        w.end(save: true)
        l.sent = true
        live = l
        save()
        buzz(.success)
    }

    /// Match annulé : rien n'est envoyé, la séance n'est pas gardée
    func cancel() {
        // Annulé avant d'avoir vraiment joué (moins de 3 points) : le match offert du mois est rendu
        if let l = live, l.free, l.ev.count < 3 { PhoneLink.shared.refundFree() }
        Workout.shared.end(save: false)
        live = nil
        save()
    }

    func close() {
        live = nil
        save()
    }
}
