import WidgetKit
import SwiftUI
import UIKit

// Montée — widgets iPhone.
// L'app dessine chaque widget d'écran d'accueil en image (mêmes visuels que sur Android, mêmes
// thèmes) et la dépose dans le dossier partagé du groupe d'apps. Le widget l'affiche telle quelle.
// Les widgets d'écran verrouillé sont dessinés ici, en natif, à partir de data.json.
// Aucune donnée ne sort du téléphone.

let kGroup = "group.fr.montennis.app"

enum Shared {
    static var dir: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: kGroup)?.appendingPathComponent("widgets", isDirectory: true)
    }
    static func data() -> [String: Any] {
        guard let u = dir?.appendingPathComponent("data.json"), let raw = try? Data(contentsOf: u),
              let obj = try? JSONSerialization.jsonObject(with: raw) as? [String: Any] else { return [:] }
        return obj
    }
    static func image(_ kind: String) -> UIImage? {
        guard let u = dir?.appendingPathComponent(kind + ".png") else { return nil }
        return UIImage(contentsOfFile: u.path)
    }
    static func familyKey(_ f: WidgetFamily) -> String {
        switch f {
        case .systemSmall: return "small"
        case .systemMedium: return "medium"
        case .systemLarge: return "large"
        default: return "other"
        }
    }
    /// Taille réelle du widget sur cet iPhone, pour que l'app dessine l'image au pixel près.
    static func saveSize(_ context: TimelineProviderContext) {
        let k = familyKey(context.family)
        guard k != "other", let d = UserDefaults(suiteName: kGroup) else { return }
        let s = context.displaySize
        if s.width > 10 && s.height > 10 { d.set([Double(s.width), Double(s.height)], forKey: "montee.size." + k) }
    }
}

/// Écran ouvert quand on touche le widget (mêmes adresses que sur Android).
func targetURL(_ kind: String, _ d: [String: Any]) -> URL? {
    var s = "montee://open/projection"
    switch kind {
    case "cordage":
        if let r = d["racket"] as? [String: Any], let id = r["id"] as? String { s = "montee://open/raquette/" + id } else { s = "montee://open/raquette/new" }
    case "semaine": s = "montee://open/materiel"
    case "defend": s = "montee://open/courbes?to=defend"
    case "tableau": s = "montee://open/"
    case "objectif": s = "montee://open/objectif"
    case "suivis", "suivis2", "suivis3": s = "montee://open/faf?tab=suivis"
    case "faf", "faf2", "faf1": s = "montee://open/faf?tab=adv"
    case "adversaire", "adversaire2":
        if let o = d["scout"] as? [String: Any], let id = o["id"] as? String, !id.isEmpty { s = "montee://open/joueur/" + id } else { s = "montee://open/faf?focus=1" }
    default: break
    }
    return URL(string: s)
}

// MARK: - Écran d'accueil : images dessinées par l'app

struct ImgEntry: TimelineEntry {
    let date: Date
    let kind: String
    let image: UIImage?
    let data: [String: Any]
}

struct ImgProvider: TimelineProvider {
    let kinds: [WidgetFamily: String]

    func kind(_ f: WidgetFamily) -> String { kinds[f] ?? kinds.values.first ?? "classement" }

    /// Aperçu de la galerie des widgets : un exemple dessiné à l'avance (assets « preview-… »)
    func preview(_ k: String) -> UIImage? { UIImage(named: "preview-" + k) }

    func placeholder(in context: Context) -> ImgEntry {
        let k = kind(context.family)
        return ImgEntry(date: Date(), kind: k, image: preview(k), data: [:])
    }
    func getSnapshot(in context: Context, completion: @escaping (ImgEntry) -> Void) {
        let k = kind(context.family)
        let img = context.isPreview ? (Shared.image(k) ?? preview(k)) : Shared.image(k)
        completion(ImgEntry(date: Date(), kind: k, image: img, data: Shared.data()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<ImgEntry>) -> Void) {
        Shared.saveSize(context)
        let k = kind(context.family)
        let img = Shared.image(k)
        let e = ImgEntry(date: Date(), kind: k, image: img, data: Shared.data())
        // L'app redessine à chaque ouverture ; widget tout juste posé (pas encore d'image) : on relit vite
        completion(Timeline(entries: [e], policy: .after(Date().addingTimeInterval(img == nil ? 300 : 4 * 3600))))
    }
}

struct ImgView: View {
    let entry: ImgEntry

    var slotURL: URL? {
        guard entry.kind == "semaine", let w = entry.data["week"] as? [String: Any], let sl = w["slot"] as? [String: Any],
              (sl["ask"] as? Bool) == true, let id = sl["id"] as? String, let dt = sl["date"] as? String else { return nil }
        var c = URLComponents(); c.scheme = "montee"; c.host = "slot"; c.path = "/yes"
        c.queryItems = [URLQueryItem(name: "id", value: id), URLQueryItem(name: "d", value: dt)]
        return c.url
    }

    /// Joueurs suivis (moyen et grand) : chaque ligne ouvre la fiche de ce joueur
    var followLinks: [(URL, Int)] {
        guard entry.kind == "suivis" || entry.kind == "suivis3" else { return [] }
        let key = entry.kind == "suivis3" ? "followsAll" : "follows"
        let list = (entry.data[key] as? [[String: Any]]) ?? []
        return list.enumerated().compactMap { i, f in
            guard let id = f["id"] as? String, !id.isEmpty, let u = URL(string: "montee://open/joueur/" + id) else { return nil }
            return (u, i)
        }
    }

    var body: some View {
        ZStack {
            if let img = entry.image {
                Image(uiImage: img).resizable().scaledToFill()
            } else {
                VStack(spacing: 6) {
                    Text("Montée").font(.headline)
                    Text("Ouvre Montée une fois pour afficher ce widget.").font(.caption).foregroundColor(.secondary).multilineTextAlignment(.center)
                }.padding(12)
            }
            let links = followLinks
            if !links.isEmpty {
                // Mêmes marges que le dessin : en-tête de 34 pt (44 en grand), lignes de même hauteur
                GeometryReader { g in
                    let top: CGFloat = entry.kind == "suivis3" ? 44 : 34, bottom: CGFloat = entry.kind == "suivis3" ? 10 : 8
                    let h = max(1, (g.size.height - top - bottom) / CGFloat(links.count))
                    ForEach(0..<links.count, id: \.self) { i in
                        Link(destination: links[i].0) { Color.clear.contentShape(Rectangle()) }
                            .frame(width: g.size.width, height: h)
                            .position(x: g.size.width / 2, y: top + h * (CGFloat(i) + 0.5))
                    }
                }
            }
            if let u = slotURL {
                // « T'as joué ? » : zone de toucher en bas à droite, comme sur Android
                GeometryReader { g in
                    Link(destination: u) { Color.clear.contentShape(Rectangle()) }
                        .frame(width: g.size.width * 0.42, height: g.size.height * 0.4)
                        .position(x: g.size.width * 0.79, y: g.size.height * 0.8)
                }
            }
        }
        .widgetURL(targetURL(entry.kind, entry.data))
        .containerBackground(for: .widget) { Color(UIColor.systemBackground) }
    }
}

struct MainWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MonteeMain", provider: ImgProvider(kinds: [.systemSmall: "classement", .systemMedium: "sortie", .systemLarge: "tableau"])) { ImgView(entry: $0) }
            .configurationDisplayName("Montée")
            .description("Ton classement projeté et ce qu'il te manque pour monter.")
            .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
            .contentMarginsDisabled()
    }
}

struct CordageWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MonteeCordage", provider: ImgProvider(kinds: [.systemSmall: "cordage"])) { ImgView(entry: $0) }
            .configurationDisplayName("Raquette")
            .description("Les heures de jeu sur ton cordage.")
            .supportedFamilies([.systemSmall])
            .contentMarginsDisabled()
    }
}

struct DefendWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MonteeDefend", provider: ImgProvider(kinds: [.systemSmall: "defend"])) { ImgView(entry: $0) }
            .configurationDisplayName("Points à défendre")
            .description("Ce que ton bilan perd dans les prochains mois.")
            .supportedFamilies([.systemSmall])
            .contentMarginsDisabled()
    }
}

struct ObjectifWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MonteeObjectif", provider: ImgProvider(kinds: [.systemSmall: "objectif"])) { ImgView(entry: $0) }
            .configurationDisplayName("Ton objectif")
            .description("Où tu en es de ton objectif de saison.")
            .supportedFamilies([.systemSmall])
            .contentMarginsDisabled()
    }
}

struct SemaineWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MonteeSemaine", provider: ImgProvider(kinds: [.systemMedium: "semaine"])) { ImgView(entry: $0) }
            .configurationDisplayName("Ta semaine")
            .description("Ton temps de jeu de la semaine et ton prochain créneau.")
            .supportedFamilies([.systemMedium])
            .contentMarginsDisabled()
    }
}

struct SuivisWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MonteeSuivis", provider: ImgProvider(kinds: [.systemSmall: "suivis2", .systemMedium: "suivis", .systemLarge: "suivis3"])) { ImgView(entry: $0) }
            .configurationDisplayName("Joueurs suivis")
            .description("Qui a joué, qui monte : les nouvelles de tes joueurs suivis.")
            .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
            .contentMarginsDisabled()
    }
}

struct FafWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MonteeFaf", provider: ImgProvider(kinds: [.systemSmall: "faf1", .systemMedium: "faf2", .systemLarge: "faf"])) { ImgView(entry: $0) }
            .configurationDisplayName("Tes face-à-face")
            .description("Ta bête noire, ton client et tes rivaux : votre bilan match par match.")
            .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
            .contentMarginsDisabled()
    }
}

struct AdversaireWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MonteeAdversaire", provider: ImgProvider(kinds: [.systemSmall: "adversaire2", .systemMedium: "adversaire"])) { ImgView(entry: $0) }
            .configurationDisplayName("Prochain adversaire")
            .description("Ton match programmé, sinon ta dernière recherche : tes chances et la clé du match.")
            .supportedFamilies([.systemSmall, .systemMedium])
            .contentMarginsDisabled()
    }
}

// MARK: - Écran verrouillé : dessiné ici

struct LockEntry: TimelineEntry {
    let date: Date
    let data: [String: Any]
}

struct LockProvider: TimelineProvider {
    func placeholder(in context: Context) -> LockEntry {
        LockEntry(date: Date(), data: ["rankNow": "15/3", "label": "15/2", "pct": 78, "short": "Il manque 75 pts", "status": "maintien"])
    }
    func getSnapshot(in context: Context, completion: @escaping (LockEntry) -> Void) {
        let d = Shared.data()
        completion(d.isEmpty ? placeholder(in: context) : LockEntry(date: Date(), data: d))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<LockEntry>) -> Void) {
        let e = LockEntry(date: Date(), data: Shared.data())
        // Recalcul chaque nuit pour le compte à rebours jusqu'à la sortie
        let next = Calendar.current.startOfDay(for: Date().addingTimeInterval(86400)).addingTimeInterval(120)
        completion(Timeline(entries: [e], policy: .after(next)))
    }
}

struct LockView: View {
    let entry: LockEntry
    @Environment(\.widgetFamily) var family

    var d: [String: Any] { entry.data }
    var rank: String { (d["rankNow"] as? String) ?? (d["rank"] as? String) ?? "–" }
    var next: String { (d["label"] as? String) ?? "" }
    var status: String { (d["status"] as? String) ?? "none" }
    var pct: Double {
        if let n = d["pct"] as? NSNumber { return max(0, min(1, n.doubleValue / 100)) }
        return 0
    }
    var short: String {
        if status == "montee" { return "Montée dans la poche" }
        if status == "top" { return "Joueur numéroté" }
        return (d["short"] as? String) ?? (d["line"] as? String) ?? "Ouvre Montée"
    }
    var days: Int? {
        guard let iso = d["releaseIso"] as? String else { return nil }
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.locale = Locale(identifier: "en_US_POSIX")
        guard let rel = f.date(from: iso) else { return nil }
        let n = Calendar.current.dateComponents([.day], from: Calendar.current.startOfDay(for: entry.date), to: rel).day ?? 0
        return n >= 0 ? n : nil
    }
    var whenText: String {
        guard let n = days else { return "" }
        return n == 0 ? "Sortie aujourd'hui" : n == 1 ? "Sortie demain" : "Sortie dans \(n) j"
    }

    var body: some View {
        content
            .widgetURL(URL(string: "montee://open/projection"))
            .containerBackground(for: .widget) { Color.clear }
    }

    @ViewBuilder var content: some View {
        switch family {
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                if status == "montee" || next.isEmpty {
                    VStack(spacing: 0) {
                        Image(systemName: status == "montee" ? "arrow.up" : "tennisball")
                            .font(.system(size: 12, weight: .bold))
                        Text(status == "montee" ? ((d["rank"] as? String) ?? rank) : rank)
                            .font(.system(size: 15, weight: .bold)).minimumScaleFactor(0.6).lineLimit(1)
                    }
                } else {
                    Gauge(value: pct) {
                        Text("")
                    } currentValueLabel: {
                        Text(next).font(.system(size: 14, weight: .bold)).minimumScaleFactor(0.6)
                    }
                    .gaugeStyle(.accessoryCircularCapacity)
                }
            }
        case .accessoryInline:
            if next.isEmpty || status == "montee" || status == "top" {
                Text("\(rank) · \(short)")
            } else {
                Text("\(rank) → \(next) · \(short)")
            }
        default:
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Image(systemName: "arrow.up.right").font(.system(size: 11, weight: .bold))
                    Text(next.isEmpty || status == "top" ? rank : "\(rank) → \(next)").font(.system(size: 15, weight: .bold)).lineLimit(1)
                }
                Text(short).font(.system(size: 13, weight: .medium)).lineLimit(1).minimumScaleFactor(0.8)
                if !next.isEmpty && status != "montee" && status != "top" {
                    ProgressView(value: pct).tint(.primary)
                }
                if !whenText.isEmpty {
                    Text(whenText).font(.system(size: 11)).foregroundStyle(.secondary).lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

struct LockWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MonteeLock", provider: LockProvider()) { LockView(entry: $0) }
            .configurationDisplayName("Montée")
            .description("Ton classement et ce qu'il te manque, sur l'écran verrouillé.")
            .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

@main
struct MonteeWidgetBundle: WidgetBundle {
    var body: some Widget {
        MainWidget()
        CordageWidget()
        DefendWidget()
        ObjectifWidget()
        SemaineWidget()
        AdversaireWidget()
        SuivisWidget()
        FafWidget()
        LockWidget()
    }
}
