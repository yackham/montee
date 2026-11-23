import WidgetKit
import SwiftUI

// Montée · complications Apple Watch.
// L'app montre écrit dans le groupe d'apps ce qu'elle reçoit de l'iPhone (classement, adversaires…)
// et le score du match en cours ; les complications ne font que le lire.

let MGROUP = "group.fr.montennis.app"
let mBalle = Color(red: 0.831, green: 0.902, blue: 0.290)
let mGazon = Color(red: 0.435, green: 0.761, blue: 0.561)

struct CCtx: Codable {
    var rank: String = ""
    var next: String = ""
    var pct: Int? = nil
    var gap: Int? = nil
    var short: String = ""
    var plus: Bool = false
    var defend: Int? = nil
    var defendWhen: String? = nil
    var record: String? = nil
    var rel: Int? = nil
    var form: [String]? = nil
    var streak: String? = nil
    var last: String? = nil
    var racket: CRacket? = nil
    var week: String? = nil
    // 3.33 : complications rondes
    var rings: CRings? = nil
    var weekDays: [Int]? = nil
    var defLate: Bool? = nil
    var serve: CServe? = nil
    var opps: [COpp] = []
    // 3.49 : face-à-face et chances de monter
    var faf: CFaf? = nil
    var chances: CChances? = nil
}
struct CFaf: Codable { var n: String; var when: String; var v: Int; var d: Int; var seq: String }
struct CChances: Codable { var p: Int; var t: String; var down: Bool? = nil; var rel: String; var delta: Int? = nil }
struct CRings: Codable { var win: Int; var form: Int; var lvlPct: Int }
struct CServe: Codable { var first: Int? = nil }

// MARK: - 3.33 · Anneaux épais (comme les Anneaux d'activité), sans texte

let mBleu = Color(red: 0.56, green: 0.66, blue: 1)
let mTerre = Color(red: 0.91, green: 0.54, blue: 0.37)

/// Un anneau épais + une icône au centre
struct ThickRing: View {
    let value: Double
    let color: Color
    var icon: String? = nil
    var body: some View {
        ZStack {
            AccessoryWidgetBackground()
            Circle().inset(by: 4.5).stroke(color.opacity(0.25), lineWidth: 6.5)
            Circle().inset(by: 4.5).trim(from: 0, to: CGFloat(max(0.02, min(1, value))))
                .stroke(color, style: StrokeStyle(lineWidth: 6.5, lineCap: .round)).rotationEffect(.degrees(-90))
                .widgetAccentable()
                .animation(.smooth(duration: 0.4), value: value) // 3.71 : transition quand la valeur change
            if let icon { Image(systemName: icon).font(.system(size: 15, weight: .bold)).foregroundColor(color).widgetAccentable() }
        }
    }
}
/// Des arcs séparés (6 derniers matchs, 7 jours…)
struct SegRing: View {
    let colors: [Color]
    var icon: String? = nil
    var iconColor: Color = .white
    var body: some View {
        let n = max(1, colors.count), gap = 0.045
        ZStack {
            AccessoryWidgetBackground()
            ForEach(0..<colors.count, id: \.self) { i in
                Circle().inset(by: 4.5)
                    .trim(from: Double(i) / Double(n) + gap / 2, to: Double(i + 1) / Double(n) - gap / 2)
                    .stroke(colors[i], style: StrokeStyle(lineWidth: 6.5, lineCap: .round)).rotationEffect(.degrees(-90))
                    .widgetAccentable()
            }
            if let icon { Image(systemName: icon).font(.system(size: 15, weight: .bold)).foregroundColor(iconColor) }
        }
    }
}
/// Les 3 anneaux de l'accueil : victoires, forme, niveau joué
struct Rings3View: View {
    let e: MEntry
    var body: some View {
        let r = e.ctx.rings
        ZStack {
            AccessoryWidgetBackground()
            ring(Double(r?.win ?? 0) / 100, mGazon, 3)
            ring(Double(r?.form ?? 0) / 100, mBalle, 10)
            ring(Double(r?.lvlPct ?? 0) / 100, mBleu, 17)
        }
    }
    func ring(_ v: Double, _ c: Color, _ inset: CGFloat) -> some View {
        ZStack {
            Circle().inset(by: inset).stroke(c.opacity(0.25), lineWidth: 5.5)
            Circle().inset(by: inset).trim(from: 0, to: CGFloat(max(0.02, min(1, v)))).stroke(c, style: StrokeStyle(lineWidth: 5.5, lineCap: .round)).rotationEffect(.degrees(-90)).widgetAccentable()
                .animation(.smooth(duration: 0.4), value: v)
        }
    }
}
struct RingStatView: View {
    let e: MEntry
    let which: String
    var body: some View {
        let r = e.ctx.rings
        switch which {
        case "win": ThickRing(value: Double(r?.win ?? 0) / 100, color: mGazon, icon: "trophy.fill")
        case "form": ThickRing(value: Double(r?.form ?? 0) / 100, color: mBalle, icon: "chart.line.uptrend.xyaxis")
        default: ThickRing(value: Double(r?.lvlPct ?? 0) / 100, color: mBleu, icon: "scope")
        }
    }
}
struct CRacket: Codable {
    var name: String
    var pct: Int
    var msg: String
    var hours: String
    var level: String
}
struct COpp: Codable {
    var name: String
    var rank: String
    var p: Int? = nil
    var tag: String? = nil
}
struct CLive: Codable {
    var me: String
    var him: String
    var sets: String
    var srvMe: Bool
    var on: Bool
    /// Entraînement en cours (chrono) plutôt qu'un match
    var train: Bool? = nil
    var t0: Double? = nil
    var paused: Bool? = nil
}

struct MEntry: TimelineEntry {
    let date: Date
    let ctx: CCtx
    let live: CLive?
    let plus: Bool
    var planned: COpp? { ctx.opps.first { ($0.tag ?? "").hasPrefix("Prévu") } }
    /// 3.81 : pile intelligente : le jour d'un match (et juste avant la sortie du classement), Montée remonte en haut
    var relevance: TimelineEntryRelevance? {
        let today = ctx.opps.contains { ($0.tag ?? "").lowercased().contains("aujourd'hui") }
        if today { return TimelineEntryRelevance(score: 1) }
        if let r = ctx.rel, r >= 0, r <= 2 { return TimelineEntryRelevance(score: 0.6) }
        return nil
    }
}

func loadEntry() -> MEntry {
    let d = UserDefaults(suiteName: MGROUP)
    var c = CCtx()
    if let data = d?.data(forKey: "montee.ctx"), let x = try? JSONDecoder().decode(CCtx.self, from: data) { c = x }
    var live: CLive? = nil
    if let data = d?.data(forKey: "montee.liveScore"), let x = try? JSONDecoder().decode(CLive.self, from: data), x.on { live = x }
    let plus = c.plus || (d?.bool(forKey: "montee.plus") ?? false)
    return MEntry(date: Date(), ctx: c, live: live, plus: plus)
}

struct MProvider: TimelineProvider {
    func placeholder(in context: Context) -> MEntry {
        MEntry(date: Date(),
               ctx: CCtx(rank: "15/2", next: "15/1", pct: 70, gap: 75, short: "Il manque 75 pts", plus: true, defend: 120, record: "12 V · 5 D", rel: 12,
                         form: ["V", "V", "D", "V", "V"], streak: "2 victoires d'affilée", last: "V 6-4 6-3 · Théo Durand",
                         racket: CRacket(name: "Raquette n°1", pct: 70, msg: "de jeu sur le cordage", hours: "≈ 14 h", level: "ok"), week: "3 h 20 · 2 séances + 1 match",
                         opps: [COpp(name: "Théo Durand", rank: "15/1", p: 58, tag: "Prévu sam. 7")]),
               live: CLive(me: "30", him: "15", sets: "6-4 3-2", srvMe: true, on: true), plus: true)
    }
    func getSnapshot(in context: Context, completion: @escaping (MEntry) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : loadEntry())
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<MEntry>) -> Void) {
        completion(Timeline(entries: [loadEntry()], policy: .after(Date().addingTimeInterval(3600))))
    }
}

/// Complication réservée à Montée+ : un cadenas tant que l'abonnement n'est pas actif
struct Locked: View {
    @Environment(\.widgetFamily) var family
    var body: some View {
        switch family {
        case .accessoryInline: Text("Montée+")
        case .accessoryRectangular:
            VStack(alignment: .leading) {
                Text("Montée+").font(.headline).foregroundColor(mBalle)
                Text("Abonne-toi dans Montée sur l'iPhone").font(.caption2)
            }
        default: Image(systemName: "lock.fill")
        }
    }
}

// MARK: - 1. Classement (gratuite)

struct RankView: View {
    let e: MEntry
    @Environment(\.widgetFamily) var family
    var v: Double { Double(min(100, max(0, e.ctx.pct ?? 0))) / 100 }
    var rank: String { e.ctx.rank.isEmpty ? "–" : e.ctx.rank }
    var body: some View {
        switch family {
        case .accessoryCorner:
            Text(rank).font(.system(size: 18, weight: .bold)).contentTransition(.numericText())
                .widgetLabel { Gauge(value: v) { Text("") }.tint(mBalle) }
        case .accessoryInline:
            Text(e.ctx.next.isEmpty ? "Montée · \(rank)" : "\(rank) → \(e.ctx.next)")
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 1) {
                Text("CLASSEMENT").font(.system(size: 11, weight: .heavy)).foregroundColor(mBalle)
                Text(e.ctx.next.isEmpty ? rank : "\(rank) → \(e.ctx.next)").font(.system(size: 20, weight: .bold))
                if !e.ctx.short.isEmpty { Text(e.ctx.short).font(.system(size: 12)).lineLimit(1) }
            }
        default:
            Gauge(value: v) { Text("") } currentValueLabel: { Text(rank).font(.system(size: 12, weight: .bold)) }
                .gaugeStyle(.accessoryCircular).tint(mBalle)
        }
    }
}

// MARK: - 2. Points manquants

struct GapView: View {
    let e: MEntry
    @Environment(\.widgetFamily) var family
    var gap: Int? { e.ctx.gap }
    var body: some View {
        if !e.plus { Locked() } else {
            switch family {
            case .accessoryCorner:
                Text(gap.map { "−\($0)" } ?? "OK").font(.system(size: 18, weight: .bold)).foregroundColor(mBalle)
                    .widgetLabel { Text(e.ctx.next.isEmpty ? "pts" : "pts pour \(e.ctx.next)") }
            case .accessoryInline:
                Text(gap.map { $0 > 0 ? "Il manque \($0) pts" : "Tu as les points" } ?? (e.ctx.short.isEmpty ? "Montée" : e.ctx.short))
            default:
                ZStack {
                    AccessoryWidgetBackground()
                    VStack(spacing: -2) {
                        Text(gap.map { $0 > 0 ? "−\($0)" : "OK" } ?? "–").font(.system(size: 17, weight: .heavy)).foregroundColor(mBalle)
                        Text("PTS").font(.system(size: 9, weight: .bold))
                    }
                }
            }
        }
    }
}

// MARK: - 3. Prochain match

struct NextView: View {
    let e: MEntry
    @Environment(\.widgetFamily) var family
    var body: some View {
        if family == .accessoryCircular {
            // 3.46.5 : version ronde : le jour et l'adversaire
            ZStack {
                AccessoryWidgetBackground()
                if !e.plus { Image(systemName: "lock.fill").font(.system(size: 14, weight: .bold)) }
                else if let o = e.planned {
                    VStack(spacing: 0) {
                        Text((o.tag ?? "").replacingOccurrences(of: "Prévu ", with: "").components(separatedBy: " ").first?.uppercased() ?? "").font(.system(size: 12, weight: .heavy)).foregroundColor(mBalle).lineLimit(1).minimumScaleFactor(0.6)
                        Text(String(o.name.split(separator: " ").last ?? "")).font(.system(size: 10, weight: .bold)).lineLimit(1).minimumScaleFactor(0.5)
                    }.padding(.horizontal, 4)
                } else { Image(systemName: "calendar").font(.system(size: 16, weight: .bold)) }
            }
        } else if !e.plus { Locked() } else if let o = e.planned {
            VStack(alignment: .leading, spacing: 1) {
                Text((o.tag ?? "").replacingOccurrences(of: "Prévu ", with: "").uppercased()).font(.system(size: 11, weight: .heavy)).foregroundColor(mBalle)
                Text(o.name + (o.rank.isEmpty ? "" : " · " + o.rank)).font(.system(size: 15, weight: .bold)).lineLimit(1)
                if let p = o.p { Text("Tu gagnes \(p) % du temps").font(.system(size: 12)).lineLimit(1) }
            }
        } else {
            VStack(alignment: .leading, spacing: 1) {
                Text("PROCHAIN MATCH").font(.system(size: 11, weight: .heavy)).foregroundColor(mBalle)
                Text("Aucun match prévu").font(.system(size: 14, weight: .semibold))
                Text("« Je joue contre lui » sur l'iPhone").font(.system(size: 11)).lineLimit(1)
            }
        }
    }
}

// MARK: - 4. Score en direct

struct LiveView: View {
    let e: MEntry
    @Environment(\.widgetFamily) var family
    var body: some View {
        if let l = e.live, l.train == true {
            TrainLiveView(l: l)
        } else if !e.plus { Locked() } else if let l = e.live {
            switch family {
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 2) {
                    Text("MATCH EN COURS").font(.system(size: 11, weight: .heavy)).foregroundColor(.red)
                    HStack { Text("Toi" + (l.srvMe ? " •" : "")).bold(); Spacer(); Text(l.me).font(.system(size: 16, weight: .heavy)).foregroundColor(mBalle) }
                    HStack { Text("Lui" + (l.srvMe ? "" : " •")).bold(); Spacer(); Text(l.him).font(.system(size: 16, weight: .heavy)) }
                }.font(.system(size: 13))
            default:
                ZStack {
                    AccessoryWidgetBackground()
                    VStack(spacing: -1) {
                        Text(l.me).font(.system(size: 15, weight: .heavy)).foregroundColor(mBalle)
                        Text(l.him).font(.system(size: 13, weight: .bold))
                    }
                }
            }
        } else {
            switch family {
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 1) {
                    Text("SCORE EN DIRECT").font(.system(size: 11, weight: .heavy)).foregroundColor(mBalle)
                    Text("Pas de match en cours").font(.system(size: 14, weight: .semibold))
                }
            default:
                ZStack { AccessoryWidgetBackground(); Image(systemName: "figure.tennis") }
            }
        }
    }
}

/// Entraînement en cours : le chrono tourne tout seul (gratuit)
struct TrainLiveView: View {
    let l: CLive
    @Environment(\.widgetFamily) var family
    var start: Date { Date(timeIntervalSince1970: l.t0 ?? Date().timeIntervalSince1970) }
    var body: some View {
        switch family {
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 1) {
                Text("ENTRAÎNEMENT").font(.system(size: 11, weight: .heavy)).foregroundColor(mGazon)
                if l.paused == true {
                    Text("En pause").font(.system(size: 20, weight: .heavy))
                } else {
                    Text(start, style: .timer).font(.system(size: 22, weight: .heavy)).monospacedDigit()
                }
                Text("sans score · cardio et zones").font(.system(size: 11, weight: .semibold)).foregroundColor(.secondary)
            }
        default:
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: 0) {
                    Image(systemName: "heart.fill").font(.system(size: 10, weight: .bold)).foregroundColor(mGazon)
                    if l.paused == true {
                        Text("Pause").font(.system(size: 11, weight: .heavy))
                    } else {
                        Text(start, style: .timer).font(.system(size: 12, weight: .heavy)).monospacedDigit()
                            .multilineTextAlignment(.center).minimumScaleFactor(0.6)
                    }
                }.padding(.horizontal, 3)
            }
        }
    }
}

// MARK: - 5. Lancer un match (gratuite : ouvre l'app sur « Nouveau match »)

struct StartView: View {
    var body: some View {
        ZStack {
            Circle().fill(mBalle).widgetAccentable()
            Image(systemName: "tennisball.fill").font(.system(size: 26, weight: .bold)).foregroundColor(.black)
        }
        .widgetURL(URL(string: "montee://start"))
    }
}

// MARK: - 5 bis. Lancer un entraînement (gratuite)

struct TrainStartView: View {
    var body: some View {
        ZStack {
            Circle().fill(mGazon.opacity(0.28)).widgetAccentable()
            Image(systemName: "figure.tennis").font(.system(size: 21, weight: .bold)).foregroundColor(mGazon)
        }
        .widgetURL(URL(string: "montee://train"))
    }
}

/// Ta semaine : temps de jeu des 7 derniers jours (gratuite)
struct WeekView: View {
    let e: MEntry
    @Environment(\.widgetFamily) var family
    var body: some View {
        if family == .accessoryCircular {
            // 3.33 : 7 arcs = 7 jours (vert match, jaune entraînement), calendrier au centre
            SegRing(colors: (e.ctx.weekDays ?? [0, 0, 0, 0, 0, 0, 0]).map { $0 == 1 ? mGazon : $0 == 2 ? mBalle : Color.white.opacity(0.2) }, icon: "calendar", iconColor: mGazon)
        } else {
            Text((e.ctx.week ?? "").isEmpty ? "Semaine · pas encore de séance" : "Semaine · " + (e.ctx.week ?? ""))
        }
    }
}

// MARK: - 6. Points à défendre

struct DefendView: View {
    let e: MEntry
    @Environment(\.widgetFamily) var family
    var body: some View {
        if !e.plus { Locked() } else {
            switch family {
            case .accessoryInline:
                Text(e.ctx.defend.map { "\($0) pts à défendre" + (e.ctx.defendWhen.map { " en " + $0 } ?? "") } ?? "Rien à défendre d'ici 6 mois")
            case .accessoryCorner:
                Text(e.ctx.defend.map { "\($0)" } ?? "0").font(.system(size: 18, weight: .bold)).foregroundColor(mBalle)
                    .widgetLabel { Text("pts à défendre") }
            default:
                // 3.33 : l'anneau se vide jusqu'à la sortie ; orange s'il manquera des points
                ThickRing(value: Double(max(0, min(31, e.ctx.rel ?? 31))) / 31, color: (e.ctx.defLate ?? false) ? mTerre : mGazon, icon: "shield.fill")
            }
        }
    }
}

// MARK: - 7. Bilan de saison · 8. Prochain classement

struct SeasonView: View {
    let e: MEntry
    var body: some View {
        if !e.plus { Locked() } else { Text(e.ctx.record ?? "Pas encore de match") }
    }
}

struct ReleaseView: View {
    let e: MEntry
    @Environment(\.widgetFamily) var family
    var body: some View {
        if !e.plus { Locked() } else if family == .accessoryInline {
            Text(e.ctx.rel.map { $0 <= 0 ? "Classement aujourd'hui" : "Classement dans \($0) j" } ?? "Montée")
        } else {
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: -2) {
                    Text(e.ctx.rel.map { "\($0)" } ?? "–").font(.system(size: 17, weight: .heavy)).foregroundColor(mBalle)
                    Text("JOURS").font(.system(size: 8, weight: .bold))
                }
            }
        }
    }
}

// MARK: - 9. Ta forme · 10. Ton cordage · 11. Dernier match (3.27)

struct FormView: View {
    let e: MEntry
    @Environment(\.widgetFamily) var family
    var f: [String] { e.ctx.form ?? [] }
    var body: some View {
        if !e.plus { Locked() } else if family == .accessoryInline {
            Text(f.isEmpty ? "Pas encore de match" : f.joined() + (e.ctx.streak.map { " · " + $0 } ?? ""))
        } else if family == .accessoryCircular {
            // 3.33 : les derniers matchs en arcs (ancien → récent dans le sens des aiguilles), flèche au centre
            SegRing(colors: (f.isEmpty ? ["", "", "", "", "", ""] : Array(f.prefix(6).reversed())).map { $0 == "V" ? mGazon : $0 == "D" ? mTerre : Color.white.opacity(0.2) }, icon: "chart.line.uptrend.xyaxis")
        } else {
            VStack(alignment: .leading, spacing: 3) {
                Text("TA FORME").font(.system(size: 11, weight: .heavy)).foregroundColor(mBalle)
                HStack(spacing: 4) {
                    ForEach(Array(f.enumerated()), id: \.offset) { _, r in
                        Text(r).font(.system(size: 11, weight: .heavy))
                            .frame(width: 20, height: 20)
                            .background(Circle().fill(r == "V" ? mGazon : Color(red: 0.91, green: 0.54, blue: 0.37)))
                            .foregroundColor(.black)
                    }
                }
                if let st = e.ctx.streak { Text(st).font(.system(size: 12)).lineLimit(1) }
            }
        }
    }
}

struct RacketView: View {
    let e: MEntry
    @Environment(\.widgetFamily) var family
    var body: some View {
        if !e.plus { Locked() } else if let r = e.ctx.racket {
            switch family {
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 2) {
                    Text("CORDAGE · \(r.name.uppercased())").font(.system(size: 11, weight: .heavy)).foregroundColor(mBalle).lineLimit(1)
                    Text(r.hours).font(.system(size: 18, weight: .bold))
                    Text(r.msg).font(.system(size: 12)).lineLimit(1)
                }
            case .accessoryCorner:
                Image(systemName: "tennis.racket").font(.system(size: 18, weight: .bold))
                    .widgetLabel { Gauge(value: Double(min(100, r.pct)) / 100) { Text("") }.tint(r.pct >= 90 ? .orange : mGazon) }
            default:
                Gauge(value: Double(min(100, r.pct)) / 100) { Text("") } currentValueLabel: {
                    Image(systemName: "tennis.racket").font(.system(size: 13, weight: .bold))
                }
                .gaugeStyle(.accessoryCircular).tint(r.pct >= 90 ? .orange : mGazon)
            }
        } else {
            ZStack { AccessoryWidgetBackground(); Image(systemName: "tennis.racket") }
        }
    }
}

struct LastView: View {
    let e: MEntry
    var body: some View {
        if !e.plus { Locked() } else { Text(e.ctx.last ?? "Pas encore de match") }
    }
}

// MARK: - 0. « Montée » : le logo, minimaliste (gratuite) — un tap ouvre l'app

/// Le logo Montée dessiné en vectoriel : balle jaune, coutures, flèche qui monte
struct MLogo: View {
    var body: some View {
        GeometryReader { g in
            let k = min(g.size.width, g.size.height) / 32
            ZStack {
                Circle().fill(mBalle).frame(width: 29 * k, height: 29 * k).widgetAccentable()
                Path { p in
                    p.move(to: CGPoint(x: 4 * k, y: 9.5 * k))
                    p.addCurve(to: CGPoint(x: 4 * k, y: 22.5 * k), control1: CGPoint(x: 7.6 * k, y: 12.5 * k), control2: CGPoint(x: 7.6 * k, y: 19.5 * k))
                    p.move(to: CGPoint(x: 28 * k, y: 9.5 * k))
                    p.addCurve(to: CGPoint(x: 28 * k, y: 22.5 * k), control1: CGPoint(x: 24.4 * k, y: 12.5 * k), control2: CGPoint(x: 24.4 * k, y: 19.5 * k))
                }
                .stroke(Color.white, style: StrokeStyle(lineWidth: 1.6 * k, lineCap: .round))
                Path { p in
                    p.move(to: CGPoint(x: 9.5 * k, y: 19.5 * k))
                    p.addLine(to: CGPoint(x: 16 * k, y: 13 * k))
                    p.addLine(to: CGPoint(x: 22.5 * k, y: 19.5 * k))
                }
                .stroke(Color.black, style: StrokeStyle(lineWidth: 3.2 * k, lineCap: .round, lineJoin: .round))
            }
            .frame(width: 32 * k, height: 32 * k)
            .position(x: g.size.width / 2, y: g.size.height / 2)
        }
    }
}

/// Le raccourci seul : juste le logo, sans chiffre
struct LogoOnlyView: View {
    @Environment(\.widgetFamily) var family
    var body: some View {
        switch family {
        case .accessoryInline:
            HStack(spacing: 3) { Image(systemName: "chevron.up.circle.fill"); Text("montée") }
        case .accessoryCorner:
            MLogo().padding(2)
        default:
            ZStack { AccessoryWidgetBackground(); MLogo().padding(7) }
        }
    }
}

/// Le logo + le suivi du classement
struct LogoView: View {
    let e: MEntry
    @Environment(\.widgetFamily) var family
    var v: CGFloat { CGFloat(min(100, max(0, e.ctx.pct ?? 0))) / 100 }
    var body: some View {
        switch family {
        case .accessoryInline:
            HStack(spacing: 3) {
                Image(systemName: "chevron.up.circle.fill")
                Text(e.ctx.rank.isEmpty ? "montée" : "montée · " + e.ctx.rank)
            }
        case .accessoryCorner:
            MLogo().padding(2)
                .widgetLabel { Text(e.ctx.rank.isEmpty ? "Montée" : (e.ctx.next.isEmpty ? e.ctx.rank : "\(e.ctx.rank) → \(e.ctx.next)")) }
        default:
            ZStack {
                Circle().inset(by: 3.5).stroke(mBalle.opacity(0.25), lineWidth: 6.5)
                if v > 0 {
                    Circle().inset(by: 3.5).trim(from: 0, to: v)
                        .stroke(mBalle, style: StrokeStyle(lineWidth: 6.5, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .widgetAccentable()
                }
                MLogo().padding(12)
            }
        }
    }
}

struct LogoWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MonteeLogo", provider: MProvider()) { _ in card(LogoOnlyView()) }
            .configurationDisplayName("Montée").description("Le logo, pour ouvrir Montée d'un tap.")
            .supportedFamilies([.accessoryCircular, .accessoryCorner, .accessoryInline])
    }
}
struct LogoRankWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MonteeLogoRank", provider: MProvider()) { e in card(LogoView(e: e)) }
            .configurationDisplayName("Montée · classement").description("Le logo entouré de ta progression vers l'échelon suivant.")
            .supportedFamilies([.accessoryCircular, .accessoryCorner, .accessoryInline])
    }
}

// MARK: - 3.33 · Déclarations des complications rondes

struct Rings3Widget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MonteeRings3", provider: MProvider()) { e in card(Rings3View(e: e)) }
            .configurationDisplayName("Les 3 anneaux").description("Victoires, forme et niveau joué, comme sur l'iPhone.")
            .supportedFamilies([.accessoryCircular])
    }
}
struct WinsWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MonteeWins", provider: MProvider()) { e in card(RingStatView(e: e, which: "win")) }
            .configurationDisplayName("Victoires").description("Ton % de victoires sur 12 mois.")
            .supportedFamilies([.accessoryCircular])
    }
}
struct FormPctWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MonteeFormPct", provider: MProvider()) { e in card(RingStatView(e: e, which: "form")) }
            .configurationDisplayName("Forme").description("Ton % de victoires sur tes 6 derniers matchs.")
            .supportedFamilies([.accessoryCircular])
    }
}
struct LevelWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MonteeLevel", provider: MProvider()) { e in card(RingStatView(e: e, which: "lvl")) }
            .configurationDisplayName("Niveau joué").description("Ton niveau réellement joué face à ton classement.")
            .supportedFamilies([.accessoryCircular])
    }
}
struct ServeView: View {
    let e: MEntry
    var body: some View {
        if !e.plus { Locked() } else { ThickRing(value: Double(e.ctx.serve?.first ?? 0) / 100, color: mBleu, icon: "square.split.2x1") }
    }
}
struct ServeWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MonteeServe", provider: MProvider()) { e in card(ServeView(e: e)) }
            .configurationDisplayName("Ton service").description("Tes 1res balles, comptées à la montre.")
            .supportedFamilies([.accessoryCircular])
    }
}
/// Les complications rondes gratuites (un bloc accepte au plus 10 widgets)
struct RingComplications: WidgetBundle {
    var body: some Widget {
        Rings3Widget()
        WinsWidget()
        FormPctWidget()
        LevelWidget()
        FafCWidget()
    }
}

// MARK: - 3.49 · Face-à-face et chances de monter

/// Le face-à-face du prochain match (sinon ton plus grand rival) : « Théo · sam. 2 – 3 »
struct FafCView: View {
    let e: MEntry
    @Environment(\.widgetFamily) var family
    var col: Color { guard let f = e.ctx.faf else { return .white }; return f.v > f.d ? mGazon : f.v < f.d ? mTerre : .white }
    var body: some View {
        if let f = e.ctx.faf {
            switch family {
            case .accessoryCircular:
                ZStack {
                    AccessoryWidgetBackground()
                    VStack(spacing: 0) {
                        Text("\(f.v)–\(f.d)").font(.system(size: 15, weight: .heavy)).foregroundColor(col).minimumScaleFactor(0.6)
                        Text(f.n).font(.system(size: 9.5, weight: .bold)).lineLimit(1).minimumScaleFactor(0.6)
                    }.padding(.horizontal, 4)
                }
            case .accessoryInline:
                Text("\(f.n) \(f.v)–\(f.d)" + (f.when.isEmpty ? "" : " · " + f.when))
            default:
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(f.when.isEmpty ? "FACE-À-FACE" : f.when.uppercased() + (f.d > f.v ? " · REVANCHE" : "")).font(.system(size: 11, weight: .heavy)).foregroundColor(mBalle).lineLimit(1)
                        Text(f.n).font(.system(size: 15, weight: .bold)).lineLimit(1)
                        HStack(spacing: 2) {
                            ForEach(Array(f.seq.suffix(8).enumerated()), id: \.offset) { _, r in
                                RoundedRectangle(cornerRadius: 2).fill(r == "V" ? mGazon : mTerre.opacity(0.6)).frame(width: 8, height: 8)
                            }
                        }
                    }
                    Spacer(minLength: 4)
                    Text("\(f.v)–\(f.d)").font(.system(size: 22, weight: .heavy)).foregroundColor(col)
                }
            }
        } else if family == .accessoryCircular {
            ZStack { AccessoryWidgetBackground(); Image(systemName: "person.2.fill").font(.system(size: 15, weight: .bold)) }
        } else {
            Text("Rejoue un adversaire").font(.system(size: 13, weight: .semibold))
        }
    }
}
struct FafCWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MonteeFafW", provider: MProvider()) { e in card(FafCView(e: e)) }
            .configurationDisplayName("Face-à-face").description("Ton bilan contre ton prochain adversaire, sinon ton plus grand rival.")
            .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}
/// Tes chances de monter (Montée+) : un anneau et le %
struct ChancesView: View {
    let e: MEntry
    @Environment(\.widgetFamily) var family
    var body: some View {
        if !e.plus { Locked() } else if let c = e.ctx.chances {
            if family == .accessoryInline { Text("\(c.p) % d'être \(c.t)") }
            else {
                Gauge(value: Double(c.p), in: 0...100) { Text(c.down == true ? "MAINT." : "MONTER") } currentValueLabel: { Text("\(c.p)%").font(.system(size: 14, weight: .heavy)).contentTransition(.numericText(value: Double(c.p))) }
                    .gaugeStyle(.accessoryCircularCapacity).tint(mBalle)
            }
        } else if family == .accessoryInline { Text("Pas de match prévu") }
        else { ZStack { AccessoryWidgetBackground(); Image(systemName: "chart.pie.fill").font(.system(size: 15, weight: .bold)) } }
    }
}
struct ChancesWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MonteeChances", provider: MProvider()) { e in card(ChancesView(e: e)) }
            .configurationDisplayName("Tes chances de monter").description("Le même calcul que sur l'iPhone, avec tes matchs prévus.")
            .supportedFamilies([.accessoryCircular, .accessoryInline])
    }
}

// MARK: - Déclarations

func card<V: View>(_ v: V) -> some View { v.containerBackground(Color.clear, for: .widget) }

struct RankWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MonteeRank", provider: MProvider()) { e in card(RankView(e: e)) }
            .configurationDisplayName("Classement").description("Ton classement et l'échelon suivant.")
            .supportedFamilies([.accessoryCircular, .accessoryCorner, .accessoryInline, .accessoryRectangular])
    }
}
struct GapWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MonteeGap", provider: MProvider()) { e in card(GapView(e: e)) }
            .configurationDisplayName("Points manquants").description("Ce qu'il te manque pour monter.")
            .supportedFamilies([.accessoryCircular, .accessoryCorner, .accessoryInline])
    }
}
struct NextWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MonteeNext", provider: MProvider()) { e in card(NextView(e: e)) }
            .configurationDisplayName("Prochain match").description("Ton prochain adversaire et tes chances.")
            .supportedFamilies([.accessoryRectangular, .accessoryCircular])
    }
}
struct LiveWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MonteeLive", provider: MProvider()) { e in card(LiveView(e: e)) }
            .configurationDisplayName("En direct").description("Le score du match, ou le chrono de l'entraînement en cours.")
            .supportedFamilies([.accessoryRectangular, .accessoryCircular])
    }
}
struct StartWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MonteeStart", provider: MProvider()) { _ in card(StartView()) }
            .configurationDisplayName("Lancer un match").description("Ouvre Montée sur un nouveau match.")
            .supportedFamilies([.accessoryCircular, .accessoryCorner])
    }
}
struct TrainStartWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MonteeTrain", provider: MProvider()) { _ in card(TrainStartView()) }
            .configurationDisplayName("Lancer un entraînement").description("Démarre une séance sans score : cardio et zones.")
            .supportedFamilies([.accessoryCircular, .accessoryCorner])
    }
}
struct WeekWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MonteeWeek", provider: MProvider()) { e in card(WeekView(e: e)) }
            .configurationDisplayName("Ta semaine").description("Ton temps de jeu sur 7 jours, matchs et entraînements.")
            .supportedFamilies([.accessoryInline, .accessoryCircular])
    }
}
struct DefendWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MonteeDefend", provider: MProvider()) { e in card(DefendView(e: e)) }
            .configurationDisplayName("Points à défendre").description("Ce qui sort du calcul ce mois-ci.")
            .supportedFamilies([.accessoryCircular, .accessoryCorner, .accessoryInline])
    }
}
struct SeasonWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MonteeSeason", provider: MProvider()) { e in card(SeasonView(e: e)) }
            .configurationDisplayName("Bilan de saison").description("Tes victoires et défaites.")
            .supportedFamilies([.accessoryInline])
    }
}
struct ReleaseWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MonteeRelease", provider: MProvider()) { e in card(ReleaseView(e: e)) }
            .configurationDisplayName("Prochain classement").description("Les jours avant la sortie du classement.")
            .supportedFamilies([.accessoryInline, .accessoryCircular])
    }
}

struct FormWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MonteeForm", provider: MProvider()) { e in card(FormView(e: e)) }
            .configurationDisplayName("Ta forme").description("Tes derniers matchs et ta série.")
            .supportedFamilies([.accessoryRectangular, .accessoryInline, .accessoryCircular])
    }
}
struct RacketWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MonteeRacket", provider: MProvider()) { e in card(RacketView(e: e)) }
            .configurationDisplayName("Ton cordage").description("L'usure du cordage de ta raquette principale.")
            .supportedFamilies([.accessoryCircular, .accessoryCorner, .accessoryRectangular])
    }
}
struct LastWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MonteeLast", provider: MProvider()) { e in card(LastView(e: e)) }
            .configurationDisplayName("Dernier match").description("Le résultat de ton dernier match.")
            .supportedFamilies([.accessoryInline])
    }
}

@main
struct MonteeComplications: WidgetBundle {
    var body: some Widget {
        LogoWidget()
        LogoRankWidget()
        RankWidget()
        StartWidget()
        TrainStartWidget()
        LiveWidget()
        WeekWidget()
        RingComplications().body
        PlusComplications().body
    }
}

/// Les complications Montée+ (regroupées : un bloc accepte au plus 10 widgets)
struct PlusComplications: WidgetBundle {
    var body: some Widget {
        GapWidget()
        NextWidget()
        DefendWidget()
        SeasonWidget()
        ReleaseWidget()
        FormWidget()
        RacketWidget()
        LastWidget()
        ServeWidget()
        ChancesWidget()
    }
}
