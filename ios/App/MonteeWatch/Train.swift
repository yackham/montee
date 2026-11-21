import SwiftUI
import WatchKit
import WidgetKit

// MARK: - Mode entraînement : pas de score, le cardio, tes zones, et un compteur de service facultatif

/// Un « moment service » : chaque balle est dedans (true) ou faute (false)
struct TMoment: Codable { var t0 = Date(); var t1: Date? = nil; var ev: [Bool] = [] }

/// Séance en cours, sauvegardée à chaque mesure
struct TLive: Codable {
    var t0 = Date()
    var t1: Date? = nil
    var maxHR: Double = 190
    /// 3.55.3 : zones figées au début de la séance (celles de l'iPhone)
    var thr: [Int]? = nil
    var samples: [Int] = []          // cardio toutes les 10 s
    var zoneSec: [Int] = [0, 0, 0, 0, 0]
    var moments: [TMoment] = []
    var pausedAt: Date? = nil
    var pausedTotal: Double = 0
    var avg: Double = 0
    var mx: Double = 0
    var kcal: Double = 0
    var tag: String? = nil
    var hkid: String? = nil
    var ended = false                 // séance Santé terminée (hkid connu)
    var sent = false
    /// 3.59 : séance du jour (étapes envoyées par l'iPhone), comptes par étape, étapes passées à la main
    var plan: SPlan? = nil
    var cnts: [Int]? = nil
    var stepBuzz: Int? = nil
    var skip: Double? = nil
    /// 3.61 : défis, gage en attente (étape), montante du groupe
    var duels: [SDuel]? = nil
    var gp: Int? = nil
    var buzzKey: String? = nil
    var mt: [[String]]? = nil
    var mtPick: [[String]]? = nil
    var mtPts: [String: Int]? = nil
    var mtN: Int? = nil
    var mtLosers: [String]? = nil
    var mtGage: String? = nil
    var mtGd: Bool? = nil
    var gdN: Int? = nil
}

/// 3.59 : une étape de la séance du jour : titre, minutes, 3 mots, couleur de l'axe, ce qu'on compte
/// 3.61 : le défi de l'étape (à deux : premier à « to » ; seul : contre ton record ; groupe : montante), et le gage du perdant
struct SDefi: Codable { var t: String; var to: Int; var m: Double; var solo: Bool? = nil; var grp: Bool? = nil; var g: String? = nil; var gs: String? = nil; var gl: [String]? = nil }
struct SStep: Codable {
    var t: String; var min: Double; var cue: String; var col: String; var cnt: String?; var n: Int?
    /// 3.62 (Yann) : comment mettre l'exercice en place (avec le partenaire, le groupe ou seul)
    var x: String? = nil
    var df: SDefi? = nil
    /// Groupe : qui joue où à chaque rotation (terrains → prénoms), durée d'une rotation, qui vient de bouger
    var rot: [[[String]]]? = nil
    var rotMin: Double? = nil
    var mv: [[String]]? = nil
    /// Groupe : les terrains au début de la montante
    var mt: [[String]]? = nil
}
struct SPlan: Codable { var id: String; var t: String; var steps: [SStep]; var day: String? = nil; var mode: String? = nil; var mate: String? = nil; var adv: Bool? = nil
    var minutes: Int { Int(steps.reduce(0.0) { $0 + $1.min }) }
}
/// 3.61 : un défi joué : Toi (a) contre ton partenaire (b) ; w = 0 tu gagnes, 1 il gagne (ou défi seul raté), -1 égalité, -2 pas joué
struct SDuel: Codable { var k: Int; var a = 0; var b = 0; var w: Int? = nil; var gd = false; var h: [Int] = [] }
struct OutDuel: Codable { var k: Int; var a: Int; var b: Int; var w: Int; var gd: Bool }
struct OutRk: Codable { var n: String; var p: Int }

extension Color {
    init?(hexStr: String) {
        var h = hexStr.trimmingCharacters(in: .whitespaces)
        if h.hasPrefix("#") { h.removeFirst() }
        guard h.count == 6, let v = UInt32(h, radix: 16) else { return nil }
        self.init(red: Double((v >> 16) & 0xFF) / 255, green: Double((v >> 8) & 0xFF) / 255, blue: Double(v & 0xFF) / 255)
    }
}

/// Ce que l'iPhone reçoit (même canal que les matchs, kind = "train")
struct OutServe: Codable { var ins: Int; var outs: Int; var minutes: Int }
struct OutTrain: Codable {
    var kind = "train"
    var date: String
    var start: String
    var minutes: Int
    var hr: OutHR?
    var kcal: Double?
    var zones: [Int]          // minutes par zone
    var curve: [Int]          // ≤ 48 points
    var thr: [Int]            // seuils des zones 2 à 5 (bpm)
    var serve: OutServe?
    var tag: String?
    var hkid: String?
    /// 3.59 : la séance du jour suivie, et ce qui a été compté à chaque étape
    var seance: String? = nil
    var cnts: [Int]? = nil
    /// 3.61 : les défis et le classement de la montante
    var duels: [OutDuel]? = nil
    var rk: [OutRk]? = nil
    var mtN: Int? = nil
    var gdN: Int? = nil
}

/// Zones : < 60 %, 60–70, 70–80, 80–90, ≥ 90 % de ta FC max
let ZONE_NAMES = ["Récupération", "Endurance", "Tempo", "Seuil", "Max"]
let ZONE_COLORS: [Color] = [Color(red: 0.55, green: 0.62, blue: 0.75), .gazon, .balle, .terre, Color(red: 0.93, green: 0.33, blue: 0.33)]
func thresholds(_ maxHR: Double) -> [Int] { [0.6, 0.7, 0.8, 0.9].map { Int(($0 * maxHR).rounded()) } }
/// 3.55.3 (Yann) : les zones réglées dans l'appli iPhone ; sinon 60–90 % de ta FC max
func userThr(_ maxHR: Double) -> [Int] {
    if let t = PhoneLink.shared.ctx.hrThr, t.count == 4, t[0] >= 60, t[3] < 230, zip(t, t.dropFirst()).allSatisfy({ $0.0 < $0.1 }) { return t }
    return thresholds(maxHR)
}
func zoneOf(_ bpm: Int, _ thr: [Int]) -> Int { var z = 0; for t in thr where bpm >= t { z += 1 }; return z }

final class TrainVM: ObservableObject {
    static let shared = TrainVM()
    @Published var live: TLive?
    private let key = "montee.train"
    private var timer: Timer?

    init() {
        if let d = UserDefaults.standard.data(forKey: key), let l = try? JSONDecoder().decode(TLive.self, from: d) {
            live = l
            if l.t1 == nil { DispatchQueue.main.async { Workout.shared.start(); self.tick(); self.stepTick() } }
        }
    }

    var thr: [Int] { live?.thr ?? userThr(live?.maxHR ?? 190) }
    var paused: Bool { live?.pausedAt != nil }
    var moment: TMoment? { if let m = live?.moments.last, m.t1 == nil { return m }; return nil }

    /// Durée effective (sans les pauses), en secondes
    func seconds(_ now: Date = Date()) -> Int {
        guard let l = live else { return 0 }
        var p = l.pausedTotal
        if let a = l.pausedAt { p += now.timeIntervalSince(a) }
        return max(0, Int((l.t1 ?? now).timeIntervalSince(l.t0) - p))
    }
    func clock(_ now: Date = Date()) -> String {
        let s = seconds(now)
        return s >= 3600 ? String(format: "%d:%02d:%02d", s / 3600, (s % 3600) / 60, s % 60) : String(format: "%d:%02d", s / 60, s % 60)
    }

    private func save() {
        if let l = live, let d = try? JSONEncoder().encode(l) { UserDefaults.standard.set(d, forKey: key) }
        else { UserDefaults.standard.removeObject(forKey: key) }
    }

    /// Complication « Séance en direct » : chrono qui tourne tout seul
    private func shareLive() {
        var dict: [String: Any] = ["on": false, "me": "", "him": "", "sets": "", "srvMe": false]
        if let l = live, l.t1 == nil {
            let start = Date().addingTimeInterval(-Double(seconds()))
            dict = ["on": true, "train": true, "t0": start.timeIntervalSince1970, "paused": l.pausedAt != nil,
                    "me": "", "him": "", "sets": "", "srvMe": false]
        }
        if let d = try? JSONSerialization.data(withJSONObject: dict) { sharedDefaults?.set(d, forKey: "montee.liveScore") }
        WidgetCenter.shared.reloadTimelines(ofKind: "MonteeLive")
    }

    private func buzz(_ t: WKHapticType) { WKInterfaceDevice.current().play(t) }

    private func tick() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 10, repeats: true) { [weak self] _ in self?.sample() }
    }

    private func sample() {
        guard var l = live, l.t1 == nil, l.pausedAt == nil else { return }
        let b = Int(Workout.shared.bpm.rounded())
        guard b > 30 else { return }
        l.samples.append(b)
        l.zoneSec[zoneOf(b, thr)] += 10
        live = l
        save()
    }

    func begin() {
        guard live == nil else { return }
        Workout.shared.start()
        let mx = Workout.shared.maxHR
        live = TLive(maxHR: mx, thr: userThr(mx))
        save()
        shareLive()
        tick()
        buzz(.start)
    }

    func togglePause() {
        guard var l = live, l.t1 == nil else { return }
        if let a = l.pausedAt {
            l.pausedTotal += Date().timeIntervalSince(a)
            l.pausedAt = nil
            Workout.shared.resume()
        } else {
            l.pausedAt = Date()
            Workout.shared.pause()
        }
        live = l
        save()
        shareLive()
        buzz(.click)
    }

    // MARK: 3.59 : séance du jour
    private var stepTimer: Timer?

    func setPlan(_ p: SPlan) {
        guard var l = live, l.t1 == nil, l.plan?.id != p.id else { return }
        l.plan = p
        l.cnts = Array(repeating: 0, count: p.steps.count)
        l.stepBuzz = 0
        l.skip = 0
        l.duels = nil; l.gp = nil; l.buzzKey = nil
        l.mt = nil; l.mtPick = nil; l.mtPts = nil; l.mtN = nil; l.mtLosers = nil; l.mtGage = nil; l.mtGd = nil; l.gdN = nil
        live = l
        save()
        stepTick()
    }

    /// Étape en cours et secondes restantes (i = nombre d'étapes une fois la séance finie)
    func step(_ now: Date = Date()) -> (i: Int, left: Int)? {
        guard let l = live, let p = l.plan, !p.steps.isEmpty else { return nil }
        let s = seconds(now) + Int(l.skip ?? 0)
        var acc = 0
        for (i, st) in p.steps.enumerated() {
            let d = Int(st.min * 60)
            if s < acc + d { return (i, acc + d - s) }
            acc += d
        }
        return (p.steps.count, 0)
    }

    func count(at i: Int) -> Int { guard let c = live?.cnts, i >= 0, i < c.count else { return 0 }; return c[i] }

    fileprivate func stepTick() {
        stepTimer?.invalidate()
        guard live?.plan != nil, live?.t1 == nil else { return }
        stepTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in self?.checkStep() }
    }

    /// Une vibration à chaque changement d'étape, de rotation, au début d'un défi et à chaque match de la montante (3.61)
    private func checkStep() {
        guard var l = live, l.t1 == nil, l.pausedAt == nil, let st = step(), let p = l.plan else { return }
        var key = "\(st.i)"
        if st.i < p.steps.count {
            let s = p.steps[st.i], into = Int(s.min * 60) - st.left
            if let r = rotIndex(st.i, into: into) { key += "|r\(r)" }
            if let d = s.df {
                if d.grp == true { key += "|m\(into / 360)" } else if d.m < s.min && Double(st.left) <= d.m * 60 { key += "|d" }
            }
        }
        if st.i != (l.stepBuzz ?? 0) {
            let prev = l.stepBuzz ?? 0
            l.stepBuzz = st.i
            live = l
            finalize(prev)
            l = live ?? l
        }
        if key != (l.buzzKey ?? "0") {
            let first = l.buzzKey == nil
            l.buzzKey = key
            live = l
            save()
            if !first { buzz(st.i >= p.steps.count ? .success : .notification) }
        }
    }

    // MARK: 3.61 : défis, gages, rotations et montante

    /// Rotation en cours d'une étape de groupe (nil si l'étape ne tourne pas)
    func rotIndex(_ i: Int, into: Int) -> Int? {
        guard let p = live?.plan, i < p.steps.count, let r = p.steps[i].rot, let m = p.steps[i].rotMin, m > 0, !r.isEmpty else { return nil }
        return min(r.count - 1, max(0, into / Int(m * 60)))
    }
    /// Le défi de l'étape a commencé (les dernières minutes ; tout l'exercice pour le match de la séance)
    func inPhase(_ i: Int, left: Int) -> Bool {
        guard let p = live?.plan, i < p.steps.count, let d = p.steps[i].df else { return false }
        return Double(left) <= d.m * 60
    }
    func duel(_ i: Int) -> SDuel? { live?.duels?.first(where: { $0.k == i }) }
    private func putDuel(_ d: SDuel) {
        guard var l = live else { return }
        var all = l.duels ?? []
        if let j = all.firstIndex(where: { $0.k == d.k }) { all[j] = d } else { all.append(d) }
        l.duels = all
        live = l
    }
    /// Un point pour toi (0) ou ton partenaire (1) ; au score visé, le défi est fini et le perdant a son gage
    func tapDuel(_ side: Int) {
        guard let st = step(), let p = live?.plan, st.i < p.steps.count, let df = p.steps[st.i].df, df.solo != true, df.grp != true else { return }
        var d = duel(st.i) ?? SDuel(k: st.i)
        guard d.w == nil else { return }
        if side == 0 { d.a += 1 } else { d.b += 1 }
        d.h.append(side)
        if d.a >= df.to || d.b >= df.to {
            d.w = d.a > d.b ? 0 : 1
            putDuel(d)
            if df.g != nil, var l = live { l.gp = st.i; live = l }
            save(); buzz(.success)
            return
        }
        putDuel(d); save(); buzz(.click)
    }
    func undoDuel() {
        guard let st = step(), var d = duel(st.i), d.w == nil, let last = d.h.last else { return }
        d.h.removeLast()
        if last == 0 { d.a = max(0, d.a - 1) } else { d.b = max(0, d.b - 1) }
        putDuel(d); save(); buzz(.directionDown)
    }
    /// Avantage au départ : +2 à l'un des deux, avant le premier point
    func advDuel(_ side: Int) {
        guard let st = step() else { return }
        var d = duel(st.i) ?? SDuel(k: st.i)
        guard d.w == nil, d.a == 0, d.b == 0 else { return }
        if side == 0 { d.a = 2 } else { d.b = 2 }
        putDuel(d); save(); buzz(.click)
    }
    func gageDone(_ i: Int) {
        guard var d = duel(i) else { return }
        d.gd = true
        putDuel(d)
        if var l = live, l.gp == i { l.gp = nil; live = l }
        save(); buzz(.success)
    }
    /// Fin d'une étape : le défi est tranché (le meneur gagne ; seul, le compteur contre le record)
    private func finalize(_ i: Int, quiet: Bool = false) {
        guard let p = live?.plan, i >= 0, i < p.steps.count, let df = p.steps[i].df, df.grp != true else { return }
        var d = duel(i) ?? SDuel(k: i)
        guard d.w == nil else { return }
        if df.solo == true {
            d.a = count(at: i)
            d.w = d.a == 0 ? -2 : (d.a >= df.to ? 0 : 1)
        } else {
            d.w = d.a == 0 && d.b == 0 ? -2 : (d.a > d.b ? 0 : d.b > d.a ? 1 : -1)
        }
        putDuel(d)
        if !quiet, let w = d.w, w >= 0, df.g != nil, !(df.solo == true && w == 0), var l = live { l.gp = i; live = l }
        save()
    }
    /// Les points des défis à deux : victoire 2, défaite 1, égalité 1 chacun
    func duelPoints() -> (me: Int, him: Int)? {
        guard let l = live, let p = l.plan else { return nil }
        var me = 0
        var him = 0
        var n = 0
        for d in l.duels ?? [] {
            guard let w = d.w, w > -2, d.k >= 0, d.k < p.steps.count else { continue }
            if p.steps[d.k].df?.solo == true { continue }
            n += 1
            if w == 0 { me += 2; him += 1 } else if w == 1 { me += 1; him += 2 } else { me += 1; him += 1 }
        }
        return n > 0 ? (me, him) : nil
    }
    func finalizeAll() {
        guard let st = step(), let p = live?.plan else { return }
        for i in 0...min(st.i, p.steps.count - 1) { finalize(i, quiet: true) }
    }
    /// Montante : les terrains (au premier match, ceux de la fin des rotations)
    func mtCourts(_ i: Int) -> [[String]] {
        if let m = live?.mt { return m }
        guard let p = live?.plan, i < p.steps.count, let m = p.steps[i].mt else { return [] }
        return m
    }
    func mtPicked(_ c: Int, _ n: String) -> Bool { guard let p = live?.mtPick, c < p.count else { return false }; return p[c].contains(n) }
    func mtToggle(_ i: Int, _ c: Int, _ n: String) {
        guard var l = live else { return }
        let courts = mtCourts(i)
        if l.mt == nil { l.mt = courts; var pts: [String: Int] = [:]; courts.flatMap { $0 }.forEach { pts[$0] = 0 }; l.mtPts = pts }
        var pick = l.mtPick ?? Array(repeating: [], count: courts.count)
        while pick.count < courts.count { pick.append([]) }
        if let j = pick[c].firstIndex(of: n) { pick[c].remove(at: j) } else { pick[c].append(n) }
        l.mtPick = pick
        live = l; save(); buzz(.click)
    }
    /// Valide le match : victoire 2, défaite 1 ; les gagnants d'un terrain montent, les perdants du terrain du dessus descendent
    func mtValidate(_ i: Int) {
        guard var l = live, var courts = l.mt, let pick = l.mtPick, pick.contains(where: { !$0.isEmpty }), let p = l.plan, i < p.steps.count else { return }
        var pts = l.mtPts ?? [:]
        var losers: [String] = []
        for (c, players) in courts.enumerated() {
            let w = c < pick.count ? pick[c] : []
            guard !w.isEmpty else { continue }
            for n in players { pts[n, default: 0] += w.contains(n) ? 2 : 1; if !w.contains(n) { losers.append(n) } }
        }
        if courts.count > 1 {
            for c in 1..<courts.count {
                let up = c < pick.count ? pick[c] : [], wAbove = c - 1 < pick.count ? pick[c - 1] : []
                guard !wAbove.isEmpty else { continue }
                let down = courts[c - 1].filter { !wAbove.contains($0) }
                for j in 0..<min(up.count, down.count) {
                    if let a = courts[c - 1].firstIndex(of: down[j]), let b = courts[c].firstIndex(of: up[j]) { courts[c - 1][a] = up[j]; courts[c][b] = down[j] }
                }
            }
        }
        let n = l.mtN ?? 0
        let df = p.steps[i].df
        var gage: String? = df?.g
        if let gl = df?.gl, !gl.isEmpty { gage = gl[n % gl.count] }
        l.mtGage = gage
        l.mt = courts; l.mtPts = pts; l.mtN = n + 1; l.mtLosers = losers; l.mtGd = false
        l.mtPick = Array(repeating: [], count: courts.count)
        live = l; save(); buzz(.success)
    }
    func mtGageDone() {
        guard var l = live else { return }
        l.mtGd = true; l.gdN = (l.gdN ?? 0) + (l.mtLosers ?? []).count
        live = l; save(); buzz(.success)
    }

    func countStep(_ d: Int) {
        guard var l = live, let st = step(), var c = l.cnts, st.i < c.count else { return }
        c[st.i] = max(0, c[st.i] + d)
        l.cnts = c
        live = l
        save()
        buzz(d > 0 ? .click : .directionDown)
    }

    func skipStep() {
        guard var l = live, let st = step(), st.left > 0 else { return }
        l.skip = (l.skip ?? 0) + Double(st.left)
        live = l
        save()
        checkStep()
    }

    // Moment service
    func startMoment() {
        guard var l = live, moment == nil else { return }
        l.moments.append(TMoment())
        live = l; save(); buzz(.click)
    }
    func serve(_ inside: Bool) {
        guard var l = live, moment != nil else { return }
        l.moments[l.moments.count - 1].ev.append(inside)
        live = l; save(); buzz(inside ? .click : .failure)
    }
    func undoServe() {
        guard var l = live, moment != nil, !(l.moments.last?.ev.isEmpty ?? true) else { return }
        l.moments[l.moments.count - 1].ev.removeLast()
        live = l; save(); buzz(.directionDown)
    }
    func endMoment() {
        guard var l = live, moment != nil else { return }
        if l.moments[l.moments.count - 1].ev.isEmpty { l.moments.removeLast() }
        else { l.moments[l.moments.count - 1].t1 = Date() }
        live = l; save(); buzz(.success)
    }

    var serveIns: Int { live?.moments.reduce(0) { $0 + $1.ev.filter { $0 }.count } ?? 0 }
    var serveAll: Int { live?.moments.reduce(0) { $0 + $1.ev.count } ?? 0 }

    /// Fin de la séance : le chrono s'arrête et le résumé s'affiche. La séance Santé est seulement mise en pause :
    /// tant que rien n'est enregistré, « Reprendre » relance tout (un tap par erreur n'est plus fatal).
    func stop() {
        if live?.plan != nil { finalizeAll() }
        guard var l = live, l.t1 == nil else { return }
        if moment != nil { endMoment(); l = live ?? l }
        if let a = l.pausedAt { l.pausedTotal += Date().timeIntervalSince(a); l.pausedAt = nil }
        let w = Workout.shared
        l.t1 = Date()
        l.avg = w.avg; l.mx = w.maxBpm; l.kcal = w.kcal
        live = l
        save()
        shareLive()
        timer?.invalidate()
        stepTimer?.invalidate()
        w.pause()
        buzz(.success)
    }

    /// Reprendre après « Terminer » (tant que la séance n'est pas enregistrée)
    func resume() {
        guard var l = live, let t1 = l.t1, !l.sent else { return }
        l.pausedTotal += Date().timeIntervalSince(t1)
        l.t1 = nil
        live = l
        save()
        if Workout.shared.session == nil { Workout.shared.start() } else { Workout.shared.resume() }
        shareLive()
        tick()
        stepTick()
        buzz(.start)
    }

    func setTag(_ t: String?) {
        guard var l = live else { return }
        l.tag = l.tag == t ? nil : t
        live = l; save()
    }

    /// Enregistrer : la séance Tennis part dans Santé, puis vers l'iPhone avec son identifiant Santé.
    /// Le résumé est préparé tout de suite : même si tu fermes l'écran aussitôt, il part (au plus tard 8 s après).
    func send() {
        guard var l = live, !l.sent else { return }
        l.sent = true
        live = l
        save()
        buzz(.success)
        let base = makeOut(l)
        var done = false
        let deliver: (String?) -> Void = { id in
            guard !done else { return }
            done = true
            var o = base
            o.hkid = id
            if let d = try? JSONEncoder().encode(o), let j = String(data: d, encoding: .utf8) { PhoneLink.shared.send(match: j) }
        }
        Workout.shared.end(save: true) { [weak self] id in
            deliver(id)
            if let self = self, var l = self.live { l.hkid = id; l.ended = true; self.live = l; self.save() }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 8) { deliver(nil) }
    }

    private func makeOut(_ l: TLive) -> OutTrain {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        let h = DateFormatter()
        h.locale = Locale(identifier: "en_US_POSIX")
        h.dateFormat = "HH:mm"
        let all = l.moments.flatMap { $0.ev }
        let sMin = l.moments.reduce(0.0) { $0 + (($1.t1 ?? $1.t0).timeIntervalSince($1.t0)) }
        var o = OutTrain(date: f.string(from: l.t0), start: h.string(from: l.t0),
                        minutes: max(1, seconds() / 60),
                        hr: l.avg > 0 ? OutHR(avg: l.avg, max: l.mx) : nil,
                        kcal: l.kcal > 0 ? l.kcal : nil,
                        zones: l.zoneSec.map { Int((Double($0) / 60).rounded()) },
                        curve: downsample(l.samples, 48),
                        thr: l.thr ?? thresholds(l.maxHR),
                        serve: all.isEmpty ? nil : OutServe(ins: all.filter { $0 }.count, outs: all.filter { !$0 }.count, minutes: max(1, Int(sMin / 60))),
                        tag: l.tag, hkid: nil)
        o.seance = l.plan?.id
        o.cnts = l.plan != nil ? l.cnts : nil
        if l.plan != nil {
            let d = (l.duels ?? []).compactMap { x -> OutDuel? in guard let w = x.w, w > -2 else { return nil }; return OutDuel(k: x.k, a: x.a, b: x.b, w: w, gd: x.gd) }
            o.duels = d.isEmpty ? nil : d
            if let pts = l.mtPts, (l.mtN ?? 0) > 0 { o.rk = pts.map { OutRk(n: $0.key, p: $0.value) }.sorted { $0.p > $1.p }; o.mtN = l.mtN; o.gdN = l.gdN }
        }
        return o
    }

    /// Séance annulée : rien dans Santé, rien envoyé
    func cancel() {
        timer?.invalidate()
        stepTimer?.invalidate()
        Workout.shared.end(save: false)
        live = nil
        save()
        shareLive()
    }

    func close() {
        live = nil
        save()
    }
}

/// Moyennes par paquets pour garder au plus n points
func downsample(_ a: [Int], _ n: Int) -> [Int] {
    guard a.count > n, n > 0 else { return a }
    let step = Double(a.count) / Double(n)
    return (0..<n).map { i in
        let lo = Int(Double(i) * step), hi = max(lo + 1, Int(Double(i + 1) * step))
        let s = a[lo..<min(hi, a.count)]
        return Int((Double(s.reduce(0, +)) / Double(s.count)).rounded())
    }
}

// MARK: - Vues

struct TrainView: View {
    @ObservedObject var vm = TrainVM.shared
    @State private var page = 1
    var body: some View {
        if vm.live?.t1 != nil {
            TrainEndView()
        } else {
            // 3.34 : service à gauche, séance au milieu (page de départ), commandes à droite
            if vm.live?.plan != nil {
                // 3.59 : séance du jour : l'étape en cours d'abord
                TabView(selection: $page) {
                    ServeMomentView().containerBackground(appGradient, for: .tabView).tag(0)
                    SeanceStepView().containerBackground(appGradient, for: .tabView).tag(1)
                    TrainLiveView().containerBackground(appGradient, for: .tabView).tag(2)
                    TrainControls().containerBackground(appGradient, for: .tabView).tag(3)
                }
                .tabViewStyle(.page)
            } else {
                TabView(selection: $page) {
                    ServeMomentView().containerBackground(appGradient, for: .tabView).tag(0)
                    TrainLiveView().containerBackground(appGradient, for: .tabView).tag(1)
                    TrainControls().containerBackground(appGradient, for: .tabView).tag(2)
                }
                .tabViewStyle(.page)
            }
        }
    }
}

/// Courbe cardio lissée, colorée par zone (seuils en pointillés, pas de fond en bandes)
struct HRCurve: View {
    let pts: [Int]
    let thr: [Int]
    var lineWidth: CGFloat = 3
    var body: some View {
        GeometryReader { g in
            // Échelle calée sur tes mesures (au moins 45 bpm d'amplitude) : une séance calme ne colle plus au bord
            let lo = Double((pts.min() ?? 100) - 8)
            let hi = max(Double((pts.max() ?? 140) + 8), lo + 45)
            let y: (Double) -> CGFloat = { v in g.size.height * CGFloat(1 - (v - lo) / max(1, hi - lo)) }
            let xs: (Int) -> CGFloat = { i in pts.count < 2 ? 0 : g.size.width * CGFloat(i) / CGFloat(pts.count - 1) }
            let P = pts.indices.map { CGPoint(x: xs($0), y: y(Double(pts[$0]))) }
            let grad = LinearGradient(stops: stops(lo: lo, hi: hi), startPoint: .top, endPoint: .bottom)
            ZStack {
                ForEach(thr, id: \.self) { t in
                    if Double(t) > lo && Double(t) < hi {
                        Path { p in p.move(to: CGPoint(x: 0, y: y(Double(t)))); p.addLine(to: CGPoint(x: g.size.width, y: y(Double(t)))) }
                            .stroke(Color.white.opacity(0.22), style: StrokeStyle(lineWidth: 1, dash: [2, 3]))
                    }
                }
                if P.count > 1 {
                    smooth(P, close: g.size.height).fill(LinearGradient(colors: [Color.white.opacity(0.14), Color.white.opacity(0)], startPoint: .top, endPoint: .bottom))
                    smooth(P, close: nil).stroke(grad, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round, lineJoin: .round))
                    if let last = P.last {
                        Circle().fill(ZONE_COLORS[zoneOf(pts.last ?? 0, thr)]).frame(width: lineWidth * 2.4, height: lineWidth * 2.4).position(last)
                    }
                } else {
                    Text("Mesure du cardio…").font(.system(size: 11, weight: .semibold)).foregroundColor(.secondary)
                }
            }
        }
    }

    /// Dégradé à arrêts nets : la couleur change exactement au seuil
    func stops(lo: Double, hi: Double) -> [Gradient.Stop] {
        var s: [Gradient.Stop] = []
        var cur = ZONE_COLORS[4]
        var pos: CGFloat = 0
        s.append(.init(color: cur, location: 0))
        for (i, t) in thr.enumerated().reversed() {
            let f = CGFloat(1 - (Double(t) - lo) / max(1, hi - lo))
            let loc = min(1, max(pos, f))
            s.append(.init(color: cur, location: loc))
            cur = ZONE_COLORS[i]
            s.append(.init(color: cur, location: loc))
            pos = loc
        }
        s.append(.init(color: cur, location: 1))
        return s
    }

    func smooth(_ P: [CGPoint], close: CGFloat?) -> Path {
        Path { p in
            p.move(to: P[0])
            for i in 0..<(P.count - 1) {
                let p0 = P[max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[min(P.count - 1, i + 2)]
                let c1 = CGPoint(x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6)
                let c2 = CGPoint(x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6)
                p.addCurve(to: p2, control1: c1, control2: c2)
            }
            if let h = close, let a = P.first, let b = P.last {
                p.addLine(to: CGPoint(x: b.x, y: h))
                p.addLine(to: CGPoint(x: a.x, y: h))
                p.closeSubpath()
            }
        }
    }
}

/// Temps passé dans chaque zone, en une barre
/// Temps dans chaque zone : les 5 zones toujours visibles, minutes dessous, la zone en cours mise en avant
struct ZoneMinutes: View {
    let sec: [Int]
    var current: Int? = nil
    var body: some View {
        HStack(alignment: .top, spacing: 3) {
            ForEach(0..<5, id: \.self) { i in
                let on = current == i
                VStack(spacing: 3) {
                    Capsule().fill(ZONE_COLORS[i].opacity(sec[i] > 0 || on ? 1 : 0.28))
                        .frame(height: on ? 9 : 6)
                        .overlay(Capsule().stroke(on ? Color.white : Color.clear, lineWidth: 1.5))
                    Text(mins(sec[i])).font(.system(size: 10, weight: .heavy)).monospacedDigit()
                        .foregroundColor(on ? .white : .secondary).lineLimit(1).minimumScaleFactor(0.7)
                }
                .frame(maxWidth: .infinity)
            }
        }
    }
    func mins(_ s: Int) -> String { s == 0 ? "0′" : s < 60 ? "<1′" : "\(s / 60)′" }
}

struct TrainLiveView: View {
    @ObservedObject var vm = TrainVM.shared
    @ObservedObject var w = Workout.shared
    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { ctx in
            let b = Int(w.bpm.rounded())
            let z = zoneOf(b, vm.thr)
            let pts = Array((vm.live?.samples ?? []).suffix(60))
            VStack(alignment: .leading, spacing: 3) {
                HStack(alignment: .firstTextBaseline) {
                    Text(vm.clock(ctx.date)).font(.system(size: 30, weight: .heavy)).monospacedDigit()
                        .foregroundColor(vm.paused ? .secondary : .white)
                    Spacer()
                    if vm.paused { Text("PAUSE").font(.system(size: 11, weight: .heavy)).foregroundColor(.terre) }
                }
                HStack(spacing: 6) {
                    Image(systemName: "heart.fill").foregroundColor(ZONE_COLORS[z]).font(.system(size: 13))
                    Text(b > 0 ? "\(b)" : "–").font(.system(size: 20, weight: .heavy)).monospacedDigit()
                    if b > 0 {
                        Text("Z\(z + 1) · " + ZONE_NAMES[z]).font(.system(size: 12, weight: .bold)).foregroundColor(ZONE_COLORS[z]).lineLimit(1)
                    }
                }
                HRCurve(pts: pts, thr: vm.thr).frame(maxHeight: .infinity)
                HStack {
                    Text(pts.count > 1 ? "10 dernières min" : "Ta courbe arrive").foregroundColor(.secondary)
                    Spacer()
                    if let m = pts.max(), pts.count > 1 { Text("max \(m)").fontWeight(.bold) }
                    if w.kcal > 0 { Text("· \(Int(w.kcal)) kcal").fontWeight(.bold) }
                }.font(.system(size: 10.5, weight: .semibold))
                ZoneMinutes(sec: vm.live?.zoneSec ?? [0, 0, 0, 0, 0], current: b > 0 ? z : nil)
            }
        }
    }
}

struct ServeMomentView: View {
    @ObservedObject var vm = TrainVM.shared
    var body: some View {
        if let m = vm.moment {
            let ins = m.ev.filter { $0 }.count
            VStack(spacing: 6) {
                HStack {
                    Text("Service").font(.system(size: 13, weight: .heavy)).foregroundColor(.balle)
                    Spacer()
                    Text("\(ins)/\(m.ev.count) · " + pct(ins, m.ev.count)).font(.system(size: 13, weight: .heavy)).monospacedDigit()
                }
                HStack(spacing: 6) {
                    BigButton(t: "Dedans", bg: .gazon, fg: .encre, height: 70) { vm.serve(true) }
                    BigButton(t: "Faute", bg: .terre, fg: Color(red: 0.16, green: 0.07, blue: 0.02), height: 70) { vm.serve(false) }
                }
                HStack(spacing: 6) {
                    Button { vm.undoServe() } label: { Image(systemName: "arrow.uturn.backward") }.buttonStyle(Wide()).frame(width: 52)
                    Button("Fin du moment") { vm.endMoment() }.buttonStyle(Wide())
                }
            }
        } else {
            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Moment service").font(.system(size: 15, weight: .heavy)).foregroundColor(.balle)
                    Text("Tu travailles ton service ? Compte tes balles dedans et tes fautes.")
                        .font(.system(size: 12, weight: .semibold)).foregroundColor(.secondary).fixedSize(horizontal: false, vertical: true)
                    Button { vm.startMoment() } label: {
                        Text("Commencer").font(.system(size: 15, weight: .heavy)).foregroundColor(.black).frame(maxWidth: .infinity)
                    }.buttonStyle(PrimaryStyle())
                    if vm.serveAll > 0 {
                        KV(k: "Déjà compté", v: "\(vm.serveIns)/\(vm.serveAll) · " + pct(vm.serveIns, vm.serveAll))
                    }
                }
            }
        }
    }
}

struct TrainControls: View {
    @ObservedObject var vm = TrainVM.shared
    @State private var askEnd = false
    @State private var askCancel = false
    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                TimelineView(.periodic(from: .now, by: 1)) { ctx in
                    Text(vm.clock(ctx.date)).font(.system(size: 34, weight: .heavy)).monospacedDigit()
                        .foregroundColor(vm.paused ? .secondary : .white).frame(maxWidth: .infinity, alignment: .leading)
                }
                HStack(spacing: 8) {
                    Button { askCancel = true } label: {
                        Image(systemName: "xmark").font(.system(size: 24, weight: .heavy)).foregroundColor(.terre)
                            .frame(maxWidth: .infinity, minHeight: 60).background(Color.terre.opacity(0.22))
                            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                    }.buttonStyle(.plain)
                    Button { vm.togglePause() } label: {
                        Image(systemName: vm.paused ? "play.fill" : "pause.fill").font(.system(size: 24, weight: .heavy))
                            .frame(maxWidth: .infinity, minHeight: 60).background(Color.white.opacity(0.16))
                            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                    }.buttonStyle(.plain)
                }
                Button { askEnd = true } label: {
                    Label("Terminer", systemImage: "stop.fill").font(.system(size: 16, weight: .heavy)).foregroundColor(.balle)
                        .frame(maxWidth: .infinity, minHeight: 46).background(Color.balle.opacity(0.2))
                        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(Color.balle.opacity(0.45), lineWidth: 1))
                        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                }.buttonStyle(.plain)
            }
        }
        .fullScreenCover(isPresented: $askEnd) {
            ConfirmScreen(title: "Terminer la séance ?", note: "Tu pourras encore la reprendre tant qu'elle n'est pas enregistrée.",
                          options: [ConfirmOption(t: "Terminer", bg: .balle, fg: .black) { vm.stop() }], cancel: "Continuer")
        }
        .fullScreenCover(isPresented: $askCancel) {
            ConfirmScreen(title: "Annuler la séance ?", note: "Rien ne sera enregistré.",
                          options: [ConfirmOption(t: "Annuler la séance", bg: .terre, fg: terreInk) { vm.cancel() }], cancel: "Continuer")
        }
    }
}

/// Une tuile du résumé : petit libellé, grande valeur
struct StatTile: View {
    let k: String
    let v: String
    var color: Color = .white
    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(k).font(.system(size: 10.5, weight: .bold)).foregroundColor(.secondary).lineLimit(1)
            Text(v).font(.system(size: 17, weight: .heavy)).foregroundColor(color).lineLimit(1).minimumScaleFactor(0.6)
        }
        .padding(.horizontal, 9).padding(.vertical, 7)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.card.opacity(0.75))
        .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
    }
}

struct TrainEndView: View {
    @ObservedObject var vm = TrainVM.shared
    @State private var askDelete = false
    var body: some View {
        let l = vm.live ?? TLive()
        let tot = max(1, l.zoneSec.reduce(0, +))
        let hard = Int((Double(l.zoneSec[2...].reduce(0, +)) * 100 / Double(tot)).rounded())
        let label = hard >= 50 ? "Soutenue" : hard >= 25 ? "Modérée" : "Légère"
        ScrollView {
            VStack(alignment: .leading, spacing: 7) {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 0) {
                        Text(l.sent ? "Séance enregistrée" : "Ta séance").font(.system(size: 12, weight: .heavy)).foregroundColor(l.sent ? .gazon : .balle)
                        Text(vm.clock()).font(.system(size: 30, weight: .heavy)).monospacedDigit()
                    }
                    Spacer()
                    if l.sent { Image(systemName: "checkmark.circle.fill").font(.system(size: 22)).foregroundColor(.gazon) }
                }
                if l.samples.count > 1 {
                    HRCurve(pts: downsample(l.samples, 60), thr: l.thr ?? thresholds(l.maxHR), lineWidth: 2.5).frame(height: 52)
                    ZoneMinutes(sec: l.zoneSec)
                }
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 6), GridItem(.flexible(), spacing: 6)], spacing: 6) {
                    if l.samples.count > 1 { StatTile(k: "Intensité · " + label.lowercased(), v: "\(hard) % Z3+", color: hard >= 50 ? .terre : hard >= 25 ? .balle : .white) }
                    if l.avg > 0 { StatTile(k: "Cardio moy/max", v: "\(Int(l.avg)) · \(Int(l.mx))") }
                    if l.kcal > 0 { StatTile(k: "Calories", v: "\(Int(l.kcal)) kcal") }
                    if vm.serveAll > 0 { StatTile(k: "Service", v: "\(vm.serveIns)/\(vm.serveAll) · " + pct(vm.serveIns, vm.serveAll), color: .gazon) }
                }
                // 3.61 : les défis (à deux : victoire 2, défaite 1) et le classement de la montante
                if let p = l.plan {
                    if let dp = vm.duelPoints() {
                        StatTile(k: "Défis · toi – " + (p.mate ?? "lui"), v: "\(dp.me) – \(dp.him) pts", color: dp.me >= dp.him ? Color.gazon : Color.terre)
                    }
                    if let pts = l.mtPts, (l.mtN ?? 0) > 0 {
                        let rk = pts.sorted { $0.value > $1.value }
                        Text("La montante").font(.system(size: 11, weight: .heavy)).foregroundColor(.balle)
                        ForEach(Array(rk.prefix(4).enumerated()), id: \.offset) { k, e in
                            HStack(spacing: 6) {
                                Text("\(k + 1)").foregroundColor(.secondary).frame(width: 14, alignment: .leading)
                                Text(e.key).lineLimit(1)
                                Spacer(minLength: 2)
                                Text("\(e.value)").fontWeight(.heavy).monospacedDigit()
                            }.font(.system(size: 12, weight: .bold))
                        }
                    }
                }
                if l.sent {
                    Text("Envoyée à l'iPhone et enregistrée dans Santé.").font(.system(size: 11.5, weight: .semibold)).foregroundColor(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                    Button("Fermer") { vm.close() }.buttonStyle(Wide(bg: .balle, fg: .black))
                } else {
                    Text("Type de séance (facultatif)").font(.system(size: 11, weight: .semibold)).foregroundColor(.secondary).padding(.top, 2)
                    HStack(spacing: 4) {
                        Chip(t: "Collectif", on: l.tag == "Collectif") { vm.setTag("Collectif") }
                        Chip(t: "Cours", on: l.tag == "Cours") { vm.setTag("Cours") }
                    }
                    Chip(t: "Partenaire", on: l.tag == "Partenaire") { vm.setTag("Partenaire") }
                    Button("Enregistrer") { vm.send() }.buttonStyle(Wide(bg: .balle, fg: .black)).padding(.top, 2)
                    Button { vm.resume() } label: { Label("Reprendre", systemImage: "play.fill") }.buttonStyle(Wide())
                    Button("Supprimer la séance") { askDelete = true }.buttonStyle(Wide(fg: .terre))
                }
            }
        }
        .fullScreenCover(isPresented: $askDelete) {
            ConfirmScreen(title: "Supprimer la séance ?", note: "Rien ne sera enregistré.",
                          options: [ConfirmOption(t: "Supprimer", bg: .terre, fg: terreInk) { vm.cancel() }])
        }
    }
}

/// 3.59 : l'étape de la séance du jour : le temps qui reste, 3 mots, et le compteur si l'étape compte quelque chose
struct SeanceStepView: View {
    @ObservedObject var vm = TrainVM.shared
    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { ctx in
            if let p = vm.live?.plan, let st = vm.step(ctx.date) {
                if st.i >= p.steps.count {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Séance terminée").font(.system(size: 13, weight: .heavy)).foregroundColor(.gazon)
                        Text(p.t).font(.system(size: 16, weight: .heavy)).fixedSize(horizontal: false, vertical: true)
                        Text("Glisse à droite pour terminer et l'enregistrer.").font(.system(size: 12, weight: .semibold))
                            .foregroundColor(.secondary).fixedSize(horizontal: false, vertical: true)
                    }
                } else {
                    stepPane(p, st.i, st.left)
                }
            } else {
                Text("Ta séance arrive de l'iPhone…").font(.system(size: 13, weight: .semibold)).foregroundColor(.secondary)
            }
        }
    }
    /// 3.61 : selon l'étape : le gage à faire, la montante, le duel, qui joue où, ou l'exercice
    @ViewBuilder func stepPane(_ p: SPlan, _ i: Int, _ left: Int) -> some View {
        let s = p.steps[i]
        let into = Int(s.min * 60) - left
        if let g = vm.live?.gp, g != i, g < p.steps.count, let d = vm.duel(g), !d.gd {
            GageCard(p: p, i: g, d: d)
        } else if let df = s.df, df.grp == true {
            MontanteView(p: p, i: i, left: left)
        } else if let df = s.df, df.solo != true, let d = vm.duel(i), d.w != nil, !d.gd {
            GageCard(p: p, i: i, d: d)
        } else if let df = s.df, df.solo != true, vm.duel(i)?.w == nil, vm.inPhase(i, left: left) {
            DuelView(p: p, i: i, left: left, df: df)
        } else if let r = s.rot, let ri = vm.rotIndex(i, into: into) {
            let per = max(60, Int((s.rotMin ?? 8) * 60))
            RotationView(p: p, i: i, round: ri, left: ri < r.count - 1 ? per - into % per : left)
        } else {
            classic(p, i, left)
        }
    }

    func duelLine(_ w: Int, _ d: SDuel) -> String {
        if w == 0 { return "Défi gagné " + String(d.a) + "–" + String(d.b) }
        if w == 1 { return "Défi perdu " + String(d.a) + "–" + String(d.b) }
        return "Défi : égalité"
    }

    @ViewBuilder func classic(_ p: SPlan, _ i: Int, _ left: Int) -> some View {
        let s = p.steps[i]
        let col = Color(hexStr: s.col) ?? .balle
        ScrollView {
        VStack(alignment: .leading, spacing: 3) {
            Text("\(i + 1)/\(p.steps.count) · \(s.t)").font(.system(size: 12, weight: .heavy)).foregroundColor(col)
                .lineLimit(1).minimumScaleFactor(0.7)
            Text(mmss(left)).font(.system(size: 34, weight: .heavy)).monospacedDigit()
                .foregroundColor(vm.paused ? .secondary : .white)
            Text(s.cue).font(.system(size: 12, weight: .semibold)).foregroundColor(.secondary)
                .lineLimit(s.df != nil ? 2 : 3).fixedSize(horizontal: false, vertical: true)
            if let x = s.x, !x.isEmpty {
                StepHowText(x: x)
            }
            if let df = s.df {
                if df.solo == true {
                    Text("Défi : \(vm.count(at: i))/\(df.to)").font(.system(size: 11, weight: .heavy)).foregroundColor(.balle)
                } else if let d = vm.duel(i), let w = d.w {
                    Text(duelLine(w, d)).font(.system(size: 11, weight: .heavy)).foregroundColor(.balle)
                } else {
                    Text("Défi : les \(Int(df.m)) dernières min").font(.system(size: 11, weight: .heavy)).foregroundColor(.balle)
                }
            }
            Spacer(minLength: 2)
            if let c = s.cnt {
                HStack(spacing: 6) {
                    Button { vm.countStep(-1) } label: { Image(systemName: "minus") }.buttonStyle(Wide()).frame(width: 44)
                    VStack(spacing: 0) {
                        Text("\(vm.count(at: i))" + (s.n.map { "/\($0)" } ?? "")).font(.system(size: 20, weight: .heavy)).monospacedDigit()
                        Text(c).font(.system(size: 9, weight: .bold)).foregroundColor(.secondary).lineLimit(1).minimumScaleFactor(0.6)
                    }.frame(maxWidth: .infinity)
                    Button { vm.countStep(1) } label: { Image(systemName: "plus") }.buttonStyle(PrimaryStyle()).frame(width: 44)
                }
            } else {
                Button("Étape suivante") { vm.skipStep() }.buttonStyle(Wide())
            }
        }
        }
    }
}

/// 3.62 : le petit descriptif de l'exercice (comment le mettre en place), sous la consigne
struct StepHowText: View {
    let x: String
    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text("Comment faire").font(.system(size: 10, weight: .heavy)).foregroundColor(.gazon)
            Text(x).font(.system(size: 12, weight: .medium)).foregroundColor(.white)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.vertical, 2)
    }
}

func mmss(_ s: Int) -> String { String(format: "%d:%02d", max(0, s) / 60, max(0, s) % 60) }

/// 3.61 : le gage (encadré terre) — ce que le perdant fait tout de suite
struct GageBox: View {
    let who: String
    let t: String
    let s: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text("Gage · " + who).font(.system(size: 9.5, weight: .heavy)).foregroundColor(.terre).textCase(.uppercase).lineLimit(1).minimumScaleFactor(0.6)
            Text(t).font(.system(size: 13.5, weight: .heavy)).fixedSize(horizontal: false, vertical: true)
            if let s = s { Text(s).font(.system(size: 11, weight: .semibold)).foregroundColor(.secondary).fixedSize(horizontal: false, vertical: true) }
        }
        .padding(8).frame(maxWidth: .infinity, alignment: .leading)
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.terre, lineWidth: 1.4))
    }
}

/// 3.61 : le duel : deux grosses zones, un tap pour celui qui marque
struct DuelView: View {
    @ObservedObject var vm = TrainVM.shared
    let p: SPlan
    let i: Int
    let left: Int
    let df: SDefi
    var body: some View {
        let d = vm.duel(i) ?? SDuel(k: i)
        let mate = p.mate ?? "Lui"
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("Défi · premier à \(df.to)").font(.system(size: 11, weight: .heavy)).foregroundColor(.balle).lineLimit(1).minimumScaleFactor(0.7)
                Spacer(minLength: 2)
                Text(mmss(left)).font(.system(size: 11, weight: .heavy)).monospacedDigit().foregroundColor(.secondary)
            }
            Text(df.t).font(.system(size: 10.5, weight: .semibold)).foregroundColor(.secondary).lineLimit(2).fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 5) {
                side("Toi", d.a, true) { vm.tapDuel(0) }
                side(mate, d.b, false) { vm.tapDuel(1) }
            }
            if d.a == 0 && d.b == 0 && p.adv != false {
                HStack {
                    Button("+2 toi") { vm.advDuel(0) }
                    Spacer()
                    Button("+2 " + mate) { vm.advDuel(1) }.lineLimit(1)
                }.font(.system(size: 11, weight: .bold)).buttonStyle(.plain).foregroundColor(.gazon)
            } else {
                Button("Annuler le dernier") { vm.undoDuel() }.font(.system(size: 11, weight: .bold)).buttonStyle(.plain).foregroundColor(.secondary)
            }
        }
    }
    func side(_ name: String, _ v: Int, _ me: Bool, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 0) {
                Text(name).font(.system(size: 11, weight: .bold)).foregroundColor(.secondary).lineLimit(1).minimumScaleFactor(0.6)
                Text("\(v)").font(.system(size: 34, weight: .heavy)).monospacedDigit().foregroundColor(.white)
            }
            .frame(maxWidth: .infinity, minHeight: 74)
            .background(RoundedRectangle(cornerRadius: 18).fill(me ? Color(red: 0.14, green: 0.15, blue: 0.06) : Color.card))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(me ? Color.balle : Color.clear, lineWidth: 1.6))
        }.buttonStyle(.plain)
    }
}

/// 3.61 : le résultat du défi, et le gage du perdant
struct GageCard: View {
    @ObservedObject var vm = TrainVM.shared
    let p: SPlan
    let i: Int
    let d: SDuel
    var df: SDefi? { p.steps[i].df }
    var mate: String { p.mate ?? "Ton partenaire" }
    var solo: Bool { df?.solo == true }
    var w: Int { d.w ?? -2 }
    var owes: Bool {
        guard df?.g != nil else { return false }
        if solo { return w == 1 }
        return w == 0 || w == 1
    }
    var title: String {
        if solo { return w == 0 ? "Défi réussi" : "Défi raté" }
        if w == -1 { return "Égalité" }
        if w == 0 { return "Tu gagnes" }
        return mate + " gagne"
    }
    var tone: Color {
        if w == 0 { return Color.gazon }
        if w == -1 { return Color.secondary }
        return Color.terre
    }
    var score: String {
        if solo { return String(d.a) + " / " + String(df?.to ?? 0) }
        return String(max(d.a, d.b)) + " – " + String(min(d.a, d.b))
    }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.system(size: 12, weight: .heavy)).foregroundColor(tone).lineLimit(1).minimumScaleFactor(0.7)
                Text(score).font(.system(size: 30, weight: .heavy)).monospacedDigit()
                if owes, let g = df?.g {
                    GageBox(who: (!solo && w == 0) ? mate : "toi", t: g, s: df?.gs)
                    Button("Gage fait") { vm.gageDone(i) }.buttonStyle(Wide(bg: .gazon, fg: .encre))
                } else {
                    Button("Continuer") { vm.gageDone(i) }.buttonStyle(Wide())
                }
            }
        }
    }
}

/// 3.61 : groupe : qui joue où pendant cette rotation (ton terrain entouré)
struct RotationView: View {
    let p: SPlan
    let i: Int
    let round: Int
    let left: Int
    var body: some View {
        let s = p.steps[i]
        let r = s.rot ?? []
        let courts = round < r.count ? r[round] : []
        let mvs = s.mv ?? []
        let nextMv = round + 1 < mvs.count ? mvs[round + 1] : []
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                Text("\(s.t) · rotation \(round + 1)/\(r.count)").font(.system(size: 11, weight: .heavy)).foregroundColor(Color(hexStr: s.col) ?? .balle)
                    .lineLimit(1).minimumScaleFactor(0.6)
                Text(mmss(left)).font(.system(size: 30, weight: .heavy)).monospacedDigit()
                ForEach(Array(courts.enumerated()), id: \.offset) { c, players in
                    let me = players.contains("Toi")
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Terrain \(c + 1)" + (me ? " · toi" : "")).font(.system(size: 9.5, weight: .heavy)).foregroundColor(.secondary).textCase(.uppercase)
                        Text(players.joined(separator: ", ")).font(.system(size: 12.5, weight: .bold)).fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.horizontal, 8).padding(.vertical, 5).frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color.card))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(me ? Color.balle : Color.clear, lineWidth: 1.4))
                }
                if !nextMv.isEmpty {
                    Text("Puis : " + nextMv.joined(separator: ", ") + (nextMv.count > 1 ? " changent" : " change") + " de terrain")
                        .font(.system(size: 11, weight: .semibold)).foregroundColor(.secondary).fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }
}

/// 3.61 : la montante : un tap sur les gagnants de chaque terrain, la montre refait les terrains et tient le classement
struct MontanteView: View {
    @ObservedObject var vm = TrainVM.shared
    let p: SPlan
    let i: Int
    let left: Int
    var body: some View {
        let courts = vm.mtCourts(i)
        let l = vm.live
        ScrollView {
            VStack(alignment: .leading, spacing: 5) {
                HStack {
                    Text("Montante · match \((l?.mtN ?? 0) + 1)").font(.system(size: 12, weight: .heavy)).foregroundColor(.balle)
                    Spacer(minLength: 2)
                    Text(mmss(left)).font(.system(size: 12, weight: .heavy)).monospacedDigit().foregroundColor(.secondary)
                }
                if let lo = l?.mtLosers, !lo.isEmpty, let g = l?.mtGage, l?.mtGd != true {
                    GageBox(who: lo.joined(separator: ", "), t: g, s: nil)
                    Button("Gages faits") { vm.mtGageDone() }.buttonStyle(Wide(bg: .gazon, fg: .encre))
                }
                Text("Qui a gagné ?").font(.system(size: 11, weight: .semibold)).foregroundColor(.secondary)
                ForEach(Array(courts.enumerated()), id: \.offset) { c, players in
                    Text("Terrain \(c + 1)").font(.system(size: 9.5, weight: .heavy)).foregroundColor(.secondary).textCase(.uppercase)
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 4), GridItem(.flexible(), spacing: 4)], spacing: 4) {
                        ForEach(players, id: \.self) { n in
                            let on = vm.mtPicked(c, n)
                            Button { vm.mtToggle(i, c, n) } label: {
                                Text(n).font(.system(size: 12.5, weight: .heavy)).lineLimit(1).minimumScaleFactor(0.6)
                                    .frame(maxWidth: .infinity, minHeight: 32)
                                    .background(RoundedRectangle(cornerRadius: 10).fill(on ? Color.gazon : Color.card))
                                    .foregroundColor(on ? .encre : .white)
                            }.buttonStyle(.plain)
                        }
                    }
                }
                Button("Valider le match") { vm.mtValidate(i) }.buttonStyle(PrimaryStyle())
                if let pts = l?.mtPts, (l?.mtN ?? 0) > 0 {
                    let rk = pts.sorted { $0.value > $1.value }
                    Text("Victoire 2, défaite 1").font(.system(size: 10, weight: .semibold)).foregroundColor(.secondary).padding(.top, 2)
                    ForEach(Array(rk.prefix(8).enumerated()), id: \.offset) { k, e in
                        HStack(spacing: 6) {
                            Text("\(k + 1)").foregroundColor(.secondary).frame(width: 14, alignment: .leading)
                            Text(e.key).lineLimit(1)
                            Spacer(minLength: 2)
                            Text("\(e.value)").fontWeight(.heavy).monospacedDigit()
                        }.font(.system(size: 12, weight: .bold))
                    }
                }
            }
        }
    }
}

/// 3.61 : Entraînement → « Séance du jour » (en premier, avec ses couleurs) ou « Libre »
struct TrainChoiceView: View {
    @ObservedObject var link = PhoneLink.shared
    let plan: SPlan
    let pick: (String) -> Void
    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                if link.ctx.sjOk != false {
                    NavigationLink { SeancePreview(plan: plan, pick: pick) } label: { card(true) }.buttonStyle(.plain)
                } else {
                    card(true).opacity(0.5)
                    Text("Ta séance montre offerte du mois est utilisée. La séance reste sur ton iPhone, gratuite.")
                        .font(.system(size: 11)).foregroundColor(.secondary).multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                }
                Button { pick("train") } label: { card(false) }.buttonStyle(.plain)
            }.padding(.horizontal, 2)
        }
        .navigationTitle("Entraînement")
        .containerBackground(appGradient, for: .navigation)
    }
    func card(_ seance: Bool) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 6) {
                Image(systemName: seance ? "list.bullet" : "heart.fill").font(.system(size: 13, weight: .heavy)).foregroundColor(seance ? .balle : .gazon)
                Text(seance ? "Séance du jour" : "Libre").font(.system(size: 15, weight: .heavy)).foregroundColor(seance ? .balle : .white)
            }
            Text(seance ? plan.t + " · " + fmtMin(plan.minutes) : "sans plan : durée et cardio").font(.system(size: 11, weight: .semibold)).foregroundColor(.secondary)
                .lineLimit(2).fixedSize(horizontal: false, vertical: true)
            if seance {
                GeometryReader { g in
                    HStack(spacing: 2) {
                        ForEach(Array(plan.steps.enumerated()), id: \.offset) { _, s in
                            Capsule().fill(Color(hexStr: s.col) ?? Color.balle).frame(width: barWidth(g.size.width, s))
                        }
                    }
                }.frame(height: 4)
            }
        }
        .padding(10).frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16).fill(Color.card))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(seance ? Color.balle : Color.clear, lineWidth: 1.6))
    }
}

extension TrainChoiceView {
    func barWidth(_ total: CGFloat, _ s: SStep) -> CGFloat {
        let n = CGFloat(plan.steps.count - 1)
        let free: CGFloat = total - n * 2
        let share: CGFloat = CGFloat(s.min) / CGFloat(max(1, plan.minutes))
        return max(2, free * share)
    }
}

func fmtMin(_ m: Int) -> String {
    if m < 60 { return "\(m) min" }
    if m % 60 == 0 { return "\(m / 60) h" }
    return "\(m / 60) h " + String(format: "%02d", m % 60)
}

/// 3.61 : l'aperçu : les étapes, avec qui, les défis ; puis on commence
/// 3.62 : une étape de l'aperçu, avec son descriptif en petit
struct PreviewStepRow: View {
    let s: SStep
    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            HStack(spacing: 6) {
                Circle().fill(Color(hexStr: s.col) ?? .balle).frame(width: 7, height: 7)
                Text(s.t).font(.system(size: 12.5, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.7)
                Spacer(minLength: 4)
                Text("\(Int(s.min))′").font(.system(size: 12, weight: .bold)).foregroundColor(.secondary).monospacedDigit()
            }
            if let x = s.x, !x.isEmpty {
                Text(x).font(.system(size: 10.5, weight: .medium)).foregroundColor(.secondary)
                    .lineLimit(3).fixedSize(horizontal: false, vertical: true).padding(.leading, 13)
            }
        }
    }
}

struct SeancePreview: View {
    let plan: SPlan
    let pick: (String) -> Void
    var nd: Int { plan.steps.filter { $0.df != nil }.count }
    var sub: String {
        let gages = plan.steps.contains { $0.df?.g != nil } ? ", gages" : ""
        if plan.mode == "grp" { return "En groupe · montante" + gages }
        if plan.mode == "solo" { return "Seul · défis contre ton record" }
        let who = plan.mate ?? "ton partenaire"
        let nb = nd > 1 ? "\(nd) défis" : "\(nd) défi"
        return "Avec " + who + " · " + nb + gages
    }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 5) {
                ForEach(Array(plan.steps.enumerated()), id: \.offset) { _, s in
                    PreviewStepRow(s: s)
                }
                if nd > 0 {
                    Text(sub)
                        .font(.system(size: 11, weight: .semibold)).foregroundColor(.secondary).padding(.top, 2).fixedSize(horizontal: false, vertical: true)
                }
                Button("Commencer") { pick("seance") }.buttonStyle(PrimaryStyle()).padding(.top, 4)
            }
        }
        .navigationTitle("Séance du jour")
        .containerBackground(appGradient, for: .navigation)
    }
}
