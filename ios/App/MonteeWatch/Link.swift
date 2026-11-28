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
    /// 4.16 : couleur de la balle des chances (calculée par l'iPhone)
    var pc: String? = nil
    var hom: Bool? = nil
    var fmt: String? = nil
    /// 3.42 : le plan de jeu préparé sur l'iPhone (3 consignes) et son jeu (forces / faiblesses)
    var plan: [WStep]? = nil
    var forts: [String]? = nil
    var faibles: [String]? = nil
    /// 3.81 : votre face-à-face (carte « Jour de match »)
    var fv: Int? = nil
    var fd: Int? = nil
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
    /// 3.55.3 : tes zones cardio réglées sur l'iPhone (seuils des zones 2 à 5, en bpm : automatique, Karvonen ou à la main)
    var hrThr: [Int]? = nil
    /// 3.61 : la séance du jour, prête à lancer depuis la montre (JSON du plan), et si elle est permise (Montée+ ou séance offerte du mois)
    var seance: String? = nil
    var sjOk: Bool? = nil
    /// 3.81 : Ace, ton match du jour, ton dernier match
    var ace: WAce? = nil
    var day: WDay? = nil
    var lastM: WLastM? = nil
    // 4.7 : Ace sur la montre : les questions du moment avec leur réponse (calculées par l'iPhone), ce que rapporte le prochain match
    var aceQs: [WAceQ]? = nil
    var winPts: WWinPts? = nil
    /// 4.32 : annoter le match depuis la montre (raisons, surfaces, raquettes, surface et lieu du jour), tout préparé par l'iPhone
    var ann: WAnnCtx? = nil
}

/// 3.92.1 : lecture tolérante. Avant, un seul champ illisible faisait rejeter tout l'envoi de l'iPhone, et la montre gardait les anciennes données (ex. celles d'un autre compte).
extension WCtx {
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        rank = (try? c.decodeIfPresent(String.self, forKey: .rank)) ?? ""
        next = (try? c.decodeIfPresent(String.self, forKey: .next)) ?? ""
        pct = try? c.decodeIfPresent(Int.self, forKey: .pct)
        short = (try? c.decodeIfPresent(String.self, forKey: .short)) ?? ""
        plus = (try? c.decodeIfPresent(Bool.self, forKey: .plus)) ?? false
        gap = try? c.decodeIfPresent(Int.self, forKey: .gap)
        defend = try? c.decodeIfPresent(Int.self, forKey: .defend)
        defendWhen = try? c.decodeIfPresent(String.self, forKey: .defendWhen)
        record = try? c.decodeIfPresent(String.self, forKey: .record)
        rel = try? c.decodeIfPresent(Int.self, forKey: .rel)
        name = (try? c.decodeIfPresent(String.self, forKey: .name)) ?? ""
        relLabel = try? c.decodeIfPresent(String.self, forKey: .relLabel)
        form = try? c.decodeIfPresent([String].self, forKey: .form)
        season = try? c.decodeIfPresent(String.self, forKey: .season)
        streak = try? c.decodeIfPresent(String.self, forKey: .streak)
        forces = try? c.decodeIfPresent([WForce].self, forKey: .forces)
        serve = try? c.decodeIfPresent(WServe.self, forKey: .serve)
        nextOpp = try? c.decodeIfPresent(WNext.self, forKey: .nextOpp)
        last = try? c.decodeIfPresent(String.self, forKey: .last)
        racket = try? c.decodeIfPresent(WRacket.self, forKey: .racket)
        week = try? c.decodeIfPresent(String.self, forKey: .week)
        recent = try? c.decodeIfPresent([WRecent].self, forKey: .recent)
        defNow = try? c.decodeIfPresent(Int.self, forKey: .defNow)
        defMonths = try? c.decodeIfPresent([WDefMonth].self, forKey: .defMonths)
        defLabel = try? c.decodeIfPresent(String.self, forKey: .defLabel)
        thisMonth = try? c.decodeIfPresent(String.self, forKey: .thisMonth)
        rings = try? c.decodeIfPresent(WRings.self, forKey: .rings)
        photo = try? c.decodeIfPresent(String.self, forKey: .photo)
        initial = try? c.decodeIfPresent(String.self, forKey: .initial)
        mental = try? c.decodeIfPresent([WMental].self, forKey: .mental)
        opps = (try? c.decodeIfPresent([WOpp].self, forKey: .opps)) ?? []
        cal = try? c.decodeIfPresent([WCal].self, forKey: .cal)
        fol = try? c.decodeIfPresent([WFol].self, forKey: .fol)
        faf = try? c.decodeIfPresent(WFaf.self, forKey: .faf)
        chances = try? c.decodeIfPresent(WChances.self, forKey: .chances)
        hrThr = try? c.decodeIfPresent([Int].self, forKey: .hrThr)
        seance = try? c.decodeIfPresent(String.self, forKey: .seance)
        sjOk = try? c.decodeIfPresent(Bool.self, forKey: .sjOk)
        ace = try? c.decodeIfPresent(WAce.self, forKey: .ace)
        day = try? c.decodeIfPresent(WDay.self, forKey: .day)
        lastM = try? c.decodeIfPresent(WLastM.self, forKey: .lastM)
        aceQs = try? c.decodeIfPresent([WAceQ].self, forKey: .aceQs)
        winPts = try? c.decodeIfPresent(WWinPts.self, forKey: .winPts)
        ann = try? c.decodeIfPresent(WAnnCtx.self, forKey: .ann)
    }
}

/// 3.49 : un face-à-face : prénom, quand (« Sam. »), victoires, défaites, carrés du plus ancien au plus récent
struct WFaf: Codable, Hashable { var n: String; var when: String; var v: Int; var d: Int; var seq: String }
/// 3.49 : tes chances d'être « t » à la sortie du « rel » (down = se maintenir), et l'écart avec la semaine dernière
struct WChances: Codable, Hashable { var p: Int; var t: String; var down: Bool? = nil; var rel: String; var delta: Int? = nil
    var deltaTxt: String { guard let d = delta, d != 0 else { return "" }; return (d > 0 ? "+" : "−") + String(abs(d)) }
}

/// Un élément à venir : jour (« 18 »), jour de semaine (« MER. »), mois, titre, détail, enjeu (« +35 pts · 82 % »), adversaire (pour lancer le match)
struct WCal: Codable, Hashable { var d: String; var w: String; var m: String? = nil; var t: String; var s: String? = nil; var st: String? = nil; var oid: String? = nil
    /// 3.81 : en-tête du billet (« Badge · presque ») et sorte (match, tour, team, rel, badge, todo)
    var e: String? = nil; var k: String? = nil }
/// 3.81 : ce que dit Ace (la Balle) en ce moment : texte, humeur (joie, decu, repos, pense, encourage…), sens (up, win, loss…)
struct WAce: Codable, Hashable { var t: String; var m: String? = nil; var v: String? = nil }

/// 4.7 : une question d'Ace (tuile : titre, chiffre clé, picto ; lk = Montée+ fermé) et sa réponse (phrases + cartes), telles que sur l'iPhone
struct WAceQ: Codable, Hashable, Identifiable {
    var id: String; var q: String; var t: String; var v: String? = nil; var ic: String? = nil
    var pl: Bool? = nil; var lk: Bool? = nil; var m: String? = nil; var a: [String]? = nil; var k: [WAceCard]? = nil
}
struct WAceCard: Codable, Hashable { var h: String? = nil; var b: String? = nil; var bc: String? = nil; var l: String? = nil; var r: [WAceRow]? = nil }
struct WAceRow: Codable, Hashable { var l: String? = nil; var rk: String? = nil; var s: String? = nil; var v: String? = nil; var c: String? = nil }
/// 4.32 : une raison de la feuille « Annote ton match » (clé, titre court, mini descriptif, couleur), telle que sur l'iPhone
struct WFelt: Codable, Hashable, Identifiable { var k: String; var t: String; var d: String? = nil; var c: String? = nil; var id: String { k } }
/// 4.32 : une surface (nom, couleur) et une raquette du sac
struct WSurf: Codable, Hashable { var n: String; var c: String? = nil }
struct WRk: Codable, Hashable { var id: String; var n: String }
/// 4.32 : surface et lieu proposés d'emblée (tu = d'après la fiche Ten'Up du tournoi, sinon ton dernier match annoté)
struct WAnnPre: Codable, Hashable { var s: String? = nil; var i: Bool? = nil; var tu: Bool? = nil }
/// 4.32 : tout ce qu'il faut pour annoter sur la montre
struct WAnnCtx: Codable, Hashable {
    var V: [WFelt] = []
    var D: [WFelt] = []
    var surfs: [WSurf]? = nil
    var rk: [WRk]? = nil
    var rkId: String? = nil
    var pre: WAnnPre? = nil
}
/// 4.32 : ce que la montre renvoie (le match est déjà parti) : t0 = début du match, pour le retrouver sur l'iPhone
struct OutAnn: Codable { var kind = "ann"; var t0: Double; var felt: [String]; var s: String?; var i: Bool?; var rk: String? }

/// 4.7 : ce que rapporte une victoire contre le prochain adversaire (n = son nom)
struct WWinPts: Codable, Hashable { var n: String; var g: Int }
/// 3.81 : ton match du jour (match prévu, tour de tournoi, rencontre par équipes)
struct WDay: Codable, Hashable { var k: String? = nil; var t: String; var r: String? = nil; var s: String? = nil; var time: String? = nil; var st: String? = nil; var oid: String? = nil }
/// 3.81 : ton dernier match (moins de 3 jours) pour l'après-match
struct WLastM: Codable, Hashable { var r: String; var opp: String; var rank: String? = nil; var score: String? = nil; var pts: String? = nil; var when: String? = nil }
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
    var fv: Int? = nil; var fd: Int? = nil; var fseq: String? = nil; var rv: Bool? = nil
    /// 4.16 : couleur de la balle des chances (calculée par l'iPhone)
    var pc: String? = nil }
/// Ta raquette principale
struct WRacket: Codable { var name: String; var pct: Int; var msg: String; var hours: String; var level: String }

/// Lien avec l'iPhone (WatchConnectivity) + droit à Montée+
final class PhoneLink: NSObject, ObservableObject, WCSessionDelegate {
    static let shared = PhoneLink()
    @Published var ctx = WCtx()
    @Published var ownsPlus = false
    @Published var openAce = false // 4.7 : la complication Ace ouvre la conversation
    @Published var openPlay = false // 3.61.2 : la complication Entraînement ouvre le choix séance / libre
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

    /// 4.32 : l'annotation du match, par le même chemin que le match (l'iPhone range tout ce qui arrive sous « match »)
    func send(ann: OutAnn) {
        guard let d = try? JSONEncoder().encode(ann), let j = String(data: d, encoding: .utf8) else { return }
        send(match: j)
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

    // MARK: 3.55 : échauffement guidé lancé depuis l'iPhone
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        warm(message)
    }
    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        warm(userInfo)
    }

    /// 3.61 : la séance du jour reçue de l'iPhone, si elle est bien d'aujourd'hui
    var todayPlan: SPlan? {
        guard let j = ctx.seance, let d = j.data(using: .utf8), let p = try? JSONDecoder().decode(SPlan.self, from: d), !p.steps.isEmpty else { return nil }
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.dateFormat = "yyyy-MM-dd"
        if let day = p.day, day != f.string(from: Date()) { return nil }
        return p
    }

    /// L'adversaire du match : parmi ceux envoyés par l'iPhone, sinon le prochain match
    func opp(for oid: String) -> WOpp? {
        if let o = ctx.opps.first(where: { $0.id == oid }) { return o }
        if let nx = ctx.nextOpp, oid.isEmpty || nx.id == oid {
            return WOpp(id: (nx.id ?? "").isEmpty ? "new" : nx.id!, name: nx.name, rank: nx.rank, p: nx.p, tip: nx.tip, plan: nx.plan, forts: nx.forts, faibles: nx.faibles)
        }
        return nil
    }

    private func warm(_ d: [String: Any]) {
        // 3.59 : la séance du jour
        if let sj = d["seance"] as? String {
            if let at = d["at"] as? Double, Date().timeIntervalSince1970 - at > 20 * 60 { return }
            DispatchQueue.main.async { PhoneLink.startSeance(json: sj) }
            return
        }
        guard let oid = d["warm"] as? String else { return }
        // Une demande restée en file trop longtemps (montre loin) ne lance plus rien
        if let at = d["at"] as? Double, Date().timeIntervalSince1970 - at > 20 * 60 { return }
        DispatchQueue.main.async { PhoneLink.startGuidedWarmup(oid: oid) }
    }

    /// 3.59 : démarre (ou complète) la séance du jour : une séance « Entraînement » avec ses étapes
    static func startSeance(json: String?) {
        let vm = MatchVM.shared, t = TrainVM.shared
        guard vm.live == nil, vm.warmup == nil else { return }
        let plan = json.flatMap { $0.data(using: .utf8) }.flatMap { try? JSONDecoder().decode(SPlan.self, from: $0) }
        if t.live != nil { if let p = plan { t.setPlan(p) }; return }
        Workout.shared.authorize {
            DispatchQueue.main.async {
                if t.live == nil { t.begin() }
                if let p = plan { t.setPlan(p) }
            }
        }
    }

    /// Démarre (ou complète) l'échauffement guidé. Appelé par le message de l'iPhone et à l'ouverture par séance (startWatchApp).
    static func startGuidedWarmup(oid: String?) {
        let link = PhoneLink.shared, vm = MatchVM.shared
        guard vm.live == nil, TrainVM.shared.live == nil else { return }
        let o = oid.flatMap { link.opp(for: $0) }
        if let w = vm.warmup {
            if w.guided == true, let o = o { vm.setWarmOpp(o) }
            return
        }
        guard link.canPlay else { return }
        let opp = o ?? link.opp(for: "") ?? WOpp(id: "new", name: "", rank: "")
        Workout.shared.authorize { vm.beginWarmup(opp: opp, hom: opp.hom ?? Draft.shared.hom, fmt: "?", guided: true) }
    }
}
