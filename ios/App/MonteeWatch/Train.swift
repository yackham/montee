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
}

/// Zones : < 60 %, 60–70, 70–80, 80–90, ≥ 90 % de ta FC max
let ZONE_NAMES = ["Récupération", "Endurance", "Tempo", "Seuil", "Max"]
let ZONE_COLORS: [Color] = [Color(red: 0.55, green: 0.62, blue: 0.75), .gazon, .balle, .terre, Color(red: 0.93, green: 0.33, blue: 0.33)]
func thresholds(_ maxHR: Double) -> [Int] { [0.6, 0.7, 0.8, 0.9].map { Int(($0 * maxHR).rounded()) } }
func zoneOf(_ bpm: Int, _ thr: [Int]) -> Int { var z = 0; for t in thr where bpm >= t { z += 1 }; return z }

final class TrainVM: ObservableObject {
    static let shared = TrainVM()
    @Published var live: TLive?
    private let key = "montee.train"
    private var timer: Timer?

    init() {
        if let d = UserDefaults.standard.data(forKey: key), let l = try? JSONDecoder().decode(TLive.self, from: d) {
            live = l
            if l.t1 == nil { DispatchQueue.main.async { Workout.shared.start(); self.tick() } }
        }
    }

    var thr: [Int] { thresholds(live?.maxHR ?? 190) }
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
        live = TLive(maxHR: Workout.shared.maxHR)
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
        return OutTrain(date: f.string(from: l.t0), start: h.string(from: l.t0),
                        minutes: max(1, seconds() / 60),
                        hr: l.avg > 0 ? OutHR(avg: l.avg, max: l.mx) : nil,
                        kcal: l.kcal > 0 ? l.kcal : nil,
                        zones: l.zoneSec.map { Int((Double($0) / 60).rounded()) },
                        curve: downsample(l.samples, 48),
                        thr: thresholds(l.maxHR),
                        serve: all.isEmpty ? nil : OutServe(ins: all.filter { $0 }.count, outs: all.filter { !$0 }.count, minutes: max(1, Int(sMin / 60))),
                        tag: l.tag, hkid: nil)
    }

    /// Séance annulée : rien dans Santé, rien envoyé
    func cancel() {
        timer?.invalidate()
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
            TabView(selection: $page) {
                ServeMomentView().containerBackground(appGradient, for: .tabView).tag(0)
                TrainLiveView().containerBackground(appGradient, for: .tabView).tag(1)
                TrainControls().containerBackground(appGradient, for: .tabView).tag(2)
            }
            .tabViewStyle(.page)
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
                    HRCurve(pts: downsample(l.samples, 60), thr: thresholds(l.maxHR), lineWidth: 2.5).frame(height: 52)
                    ZoneMinutes(sec: l.zoneSec)
                }
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 6), GridItem(.flexible(), spacing: 6)], spacing: 6) {
                    if l.samples.count > 1 { StatTile(k: "Intensité · " + label.lowercased(), v: "\(hard) % Z3+", color: hard >= 50 ? .terre : hard >= 25 ? .balle : .white) }
                    if l.avg > 0 { StatTile(k: "Cardio moy/max", v: "\(Int(l.avg)) · \(Int(l.mx))") }
                    if l.kcal > 0 { StatTile(k: "Calories", v: "\(Int(l.kcal)) kcal") }
                    if vm.serveAll > 0 { StatTile(k: "Service", v: "\(vm.serveIns)/\(vm.serveAll) · " + pct(vm.serveIns, vm.serveAll), color: .gazon) }
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
