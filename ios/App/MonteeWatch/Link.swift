import Foundation
import WatchConnectivity
import StoreKit
import WidgetKit

/// Dossier partagé avec les complications
let sharedDefaults = UserDefaults(suiteName: "group.fr.montennis.app")

/// Adversaire proposé sur la montre (envoyé par l'iPhone)
struct WOpp: Codable, Identifiable, Hashable {
    var id: String
    var name: String
    var rank: String
    var p: Int? = nil
    var tip: String? = nil
    var tag: String? = nil
    var hom: Bool? = nil
    var fmt: String? = nil
    /// 3.42 : le plan de jeu préparé sur l'iPhone (3 consignes) et son jeu (forces / faiblesses)
    var plan: [WStep]? = nil
    var forts: [String]? = nil
    var faibles: [String]? = nil
}

/// Une consigne du plan : « Break avant 5-5 » + pourquoi ; k = att / pro ; th = thème (mental, physique, start…)
struct WStep: Codable, Hashable { var id: String; var t: String; var s: String? = nil; var k: String? = nil; var th: String? = nil }

/// Ce que l'iPhone envoie : ton classement, ta progression, tes adversaires, Montée+
struct WCtx: Codable {
    var rank: String = ""
    var next: String = ""
    var pct: Int? = nil
    var short: String = ""
    var plus: Bool = false
    var gap: Int? = nil
    var defend: Int? = nil
    /// Mois de la sortie où ces points partent (« janv. »)
    var defendWhen: String? = nil
    var record: String? = nil
    var rel: Int? = nil
    var name: String = ""
    var relLabel: String? = nil
    var form: [String]? = nil
    var season: String? = nil
    var streak: String? = nil
    var forces: [WForce]? = nil
    var serve: WServe? = nil
    var nextOpp: WNext? = nil
    var last: String? = nil
    var racket: WRacket? = nil
    /// « 3 h 20 · 2 séances + 1 match » (7 derniers jours)
    var week: String? = nil
    // 3.29 : détails de l'accueil montre
    var recent: [WRecent]? = nil
    var defNow: Int? = nil
    var defMonths: [WDefMonth]? = nil
    var defLabel: String? = nil
    var thisMonth: String? = nil
    // 3.30 : les 3 anneaux de l'accueil iPhone, et le mental sur 12 mois
    var rings: WRings? = nil
    // 3.34 : ta photo (miniature JPEG en base64) et ton initiale, en bas de l'écran de score
    var photo: String? = nil
    var initial: String? = nil
    var mental: [WMental]? = nil
    var opps: [WOpp] = []
    /// 3.46.5 : « À venir » (comme la frise de l'iPhone) et « Tes copains » (joueurs suivis)
    var cal: [WCal]? = nil
    var fol: [WFol]? = nil
    /// 3.49 : face-à-face (complication) et tes chances de monter (Montée+)
    var faf: WFaf? = nil
    var chances: WChances? = nil
}

/// 3.49 : un face-à-face : prénom, quand (« Sam. »), victoires, défaites, carrés du plus ancien au plus récent
struct WFaf: Codable, Hashable { var n: String; var when: String; var v: Int; var d: Int; var seq: String }
/// 3.49 : tes chances d'être « t » à la sortie du « rel » (down = se maintenir), et l'écart avec la semaine dernière
struct WChances: Codable, Hashable { var p: Int; var t: String; var down: Bool? = nil; var rel: String; var delta: Int? = nil
    var deltaTxt: String { guard let d = delta, d != 0 else { return "" }; return (d > 0 ? "+" : "−") + String(abs(d)) }
}

/// Un élément à venir : jour (« 18 »), jour de semaine (« MER. »), mois, titre, détail, enjeu (« +35 pts · 82 % »), adversaire (pour lancer le match)
struct WCal: Codable, Hashable { var d: String; var w: String; var m: String? = nil; var t: String; var s: String? = nil; var st: String? = nil; var oid: String? = nil }
/// Un copain suivi : nom, classement, ce qui a bougé (up 1 = monté, -1 = descendu)
struct WFol: Codable, Hashable { var n: String; var r: String; var s: String; var up: Int? = nil }

/// Victoires (12 mois), Forme (6 derniers matchs), Niveau joué : mêmes chiffres que l'accueil iPhone
struct WRings: Codable {
    var win: Int; var form: Int; var lvl: String; var lvlPct: Int; var lvlLabel: String
    // 3.32 : les mêmes détails que l'iPhone
    var v: Int? = nil; var d: Int? = nil; var groups: [WMental]? = nil; var say: String? = nil; var cur: String? = nil; var lvlN: Int? = nil; var hasLvl: Bool? = nil
    var formSay: String? = nil; var streakN: Int? = nil; var streakR: String? = nil; var best: Int? = nil
}
/// Une ligne du mental : « Au 3e set » 5 sur 7
struct WMental: Codable, Hashable { var k: String; var v: Int; var n: Int }

/// Une force (même calcul que « Tes forces » sur l'iPhone)
struct WForce: Codable, Hashable { var h: String; var s: String; var t: String; var v: Int; var n: Int }
/// Ton service sur la saison (matchs comptés à la montre)
struct WServe: Codable { var n: Int; var first: Int?; var df: Double?; var held: Int?; var sec: Int?; var trend: Int?; var bpWon: Int? = nil; var bpSaved: Int? = nil }
/// Un match récent (détail « Forme »)
struct WRecent: Codable, Hashable { var r: String; var opp: String; var rank: String; var score: String }
/// Une victoire qui sort, et le bilan à une sortie (détail « À défendre »)
struct WLost: Codable, Hashable { var opp: String; var rank: String; var pts: Int }
struct WDefMonth: Codable, Hashable { var m: String; var total: Int; var norme: Int; var lost: [WLost] }
/// Le prochain adversaire (match programmé, sinon le dernier consulté)
struct WNext: Codable { var id: String? = nil; var name: String; var rank: String; var when: String; var p: Int?; var h2h: String; var tip: String; var tipS: String
    /// 3.34 : « impossible » (bien trop fort) ou « abyssal » (bien trop faible) : on change de ton
    var mode: String? = nil; var gap: Int? = nil
    /// 3.42 : plan, son jeu, votre dernier match (« Défaite 4-6 6-7 »)
    var plan: [WStep]? = nil; var forts: [String]? = nil; var faibles: [String]? = nil; var last: String? = nil
    /// 3.49 : votre face-à-face (toutes saisons) ; rv = le plan est celui de la revanche
    var fv: Int? = nil; var fd: Int? = nil; var fseq: String? = nil; var rv: Bool? = nil }
/// Ta raquette principale
struct WRacket: Codable { var name: String; var pct: Int; var msg: String; var hours: String; var level: String }

/// Lien avec l'iPhone (WatchConnectivity) + droit à Montée+
final class PhoneLink: NSObject, ObservableObject, WCSessionDelegate {
    static let shared = PhoneLink()
    @Published var ctx = WCtx()
    @Published var ownsPlus = false
    /// Mois du dernier match offert (« 2026-11 ») : sans Montée+, 1 match compté par mois
    @Published var freeMonth = UserDefaults.standard.string(forKey: "montee.freeMonth") ?? ""
    static func monthKey(_ d: Date = Date()) -> String {
        let c = Calendar(identifier: .gregorian).dateComponents([.year, .month], from: d)
        return String(format: "%04d-%02d", c.year ?? 0, c.month ?? 0)
    }
    var freeUsed: Bool { freeMonth == PhoneLink.monthKey() }

    /// Montée+ actif (abonnement vu par l'iPhone ou par la montre), ou le match offert du mois pas encore utilisé
    var canPlay: Bool { ctx.plus || ownsPlus || !freeUsed }
    var hasPlus: Bool { ctx.plus || ownsPlus }

    func start() {
        if let d = UserDefaults.standard.data(forKey: "montee.ctx"), let c = try? JSONDecoder().decode(WCtx.self, from: d) { ctx = c }
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
        Task { await checkStore() }
    }

    func useFree() {
        if !hasPlus && !freeUsed {
            freeMonth = PhoneLink.monthKey()
            UserDefaults.standard.set(freeMonth, forKey: "montee.freeMonth")
        }
    }

    func refundFree() {
        guard freeUsed else { return }
        freeMonth = ""
        UserDefaults.standard.set("", forKey: "montee.freeMonth")
    }

    @MainActor func setOwns(_ v: Bool) {
        ownsPlus = v
        sharedDefaults?.set(v, forKey: "montee.plus")
        WidgetCenter.shared.reloadAllTimelines()
    }

    func checkStore() async {
        var owns = false
        for await r in Transaction.currentEntitlements {
            if case .verified(let t) = r, t.revocationDate == nil, t.productID.hasPrefix("plus_") {
                if let exp = t.expirationDate, exp < Date() { continue }
                owns = true
            }
        }
        await setOwns(owns)
    }

    private func apply(_ dict: [String: Any]) {
        guard let j = dict["json"] as? String, let d = j.data(using: .utf8),
              let c = try? JSONDecoder().decode(WCtx.self, from: d) else { return }
        UserDefaults.standard.set(d, forKey: "montee.ctx")
        sharedDefaults?.set(d, forKey: "montee.ctx")
        WidgetCenter.shared.reloadAllTimelines()
        DispatchQueue.main.async { self.ctx = c }
    }

    /// Envoie un match terminé à l'iPhone (livré même si l'iPhone est loin : file d'attente du système)
    func send(match json: String) {
        guard WCSession.isSupported() else { return }
        let s = WCSession.default
        // 3.47 : iPhone joignable → envoi direct (il arrive tout de suite) ; sinon, ou en cas d'échec, la file d'attente du système
        if s.activationState == .activated && s.isReachable {
            s.sendMessage(["match": json], replyHandler: { _ in }, errorHandler: { _ in _ = s.transferUserInfo(["match": json]) })
        } else {
            _ = s.transferUserInfo(["match": json])
        }
    }

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        apply(session.receivedApplicationContext)
        if session.isReachable {
            session.sendMessage(["hello": 1], replyHandler: { r in self.apply(r) }, errorHandler: nil)
        }
    }
    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        apply(applicationContext)
    }
}
