import Foundation

// Montée · Apple Watch — le score, point par point.
// Un match = une liste d'événements (point pour moi, point pour lui, faute au service).
// Tout l'état (score, serveur, 2e balle, stats de service) se recalcule en rejouant la liste :
// annuler, c'est simplement retirer le dernier événement.

enum Ev: String, Codable { case me = "m", him = "l", fault = "f", ace = "a" }

struct SetScore: Codable, Equatable {
    var a: Int          // mes jeux (ou mes points de super tie-break)
    var b: Int
    var tb: Int? = nil  // points du perdant au tie-break, ex. 7-6(4)
    var sup: Bool = false
}

/// Stats d'un joueur quand il sert
struct ServeStats: Codable, Equatable {
    var pts = 0       // points joués à son service
    var firstIn = 0   // 1res balles passées
    var firstWon = 0  // points gagnés derrière la 1re
    var secPts = 0    // points joués sur 2e balle
    var secWon = 0    // points gagnés derrière la 2e
    var df = 0        // doubles fautes
    var games = 0     // jeux de service joués
    var held = 0      // jeux de service gagnés
    var bpFaced = 0   // balles de break à sauver (sur son service)
    var bpSaved = 0   // … sauvées
    var aces1: Int? = nil  // 3.35 : aces / services gagnants sur 1re balle (mode avancé)
    var aces2: Int? = nil  // … sur 2e balle
}

/// Le prochain point compte plus que les autres
struct Importance: Equatable {
    var level: Int     // 1 balle de break, 2 balle de set, 3 balle de match
    var mine: Bool     // c'est toi qui peux conclure
    var label: String {
        switch level {
        case 3: return mine ? "Balle de match" : "Balle de match à sauver"
        case 2: return mine ? "Balle de set" : "Balle de set à sauver"
        default: return mine ? "Balle de break" : "Balle de break à sauver"
        }
    }
}

struct MatchState {
    var sets: [SetScore] = []
    var games = [0, 0]
    var pts = [0, 0]
    var inTB = false
    var superTB = false
    var tbFirst = 0
    var gi = 0              // jeux joués depuis le début (un tie-break compte pour un)
    var second = false      // 2e balle en cours
    var winner: Int? = nil  // 0 = moi, 1 = lui
    var change = false      // changement de côté après le dernier événement
    var rest = 0            // secondes de repos
    var setBreak = false
    var stats = [ServeStats(), ServeStats()]
    var last = ""           // dernière action, pour le bouton Annuler
    var server = 0

    var setsWon: [Int] { [sets.filter { $0.a > $0.b }.count, sets.filter { $0.b > $0.a }.count] }

    /// Balle de break : le relanceur mène dans un jeu normal (30-40, 15-40, 0-40, avantage)
    var isBreakPoint: Bool {
        guard !inTB, winner == nil else { return false }
        let r = 1 - server
        return pts[r] >= 3 && pts[r] > pts[server]
    }

    /// Ce point ferait gagner le set à w ?
    func setPoint(_ w: Int) -> Bool {
        if inTB {
            let t = superTB ? 10 : 7, a = pts[w] + 1, b = pts[1 - w]
            return a >= t && a - b >= 2
        }
        guard pts[w] >= 3 && pts[w] > pts[1 - w] else { return false }
        var g = games; g[w] += 1
        return (max(g[0], g[1]) >= 6 && abs(g[0] - g[1]) >= 2) || max(g[0], g[1]) == 7
    }

    /// Le prochain point important (match > set > break), vu de ton côté
    var importance: Importance? {
        guard winner == nil else { return nil }
        for w in [0, 1] where setPoint(w) {
            let match = superTB || setsWon[w] == 1
            return Importance(level: match ? 3 : 2, mine: w == 0)
        }
        if isBreakPoint { return Importance(level: 1, mine: server == 1) }
        return nil
    }

    /// Points du jeu en cours, à afficher (0, 15, 30, 40, AV)
    func pointText(_ who: Int) -> String {
        if inTB { return "\(pts[who])" }
        let me = pts[who], ot = pts[1 - who]
        if me >= 3 && ot >= 3 {
            if me == ot { return "40" }
            return me > ot ? "AV" : "40"
        }
        return ["0", "15", "30", "40"][min(me, 3)]
    }

    /// Score pour Montée, ex. « 6-4 3-6 10-7 » ou « 7-6(4) 6-3 »
    var scoreText: String {
        sets.map { s in
            if s.sup { return "\(s.a)-\(s.b)" }
            return "\(s.a)-\(s.b)" + (s.tb != nil ? "(\(s.tb!))" : "")
        }.joined(separator: " ")
    }
}

func serverFor(_ gi: Int, _ srv0: Int) -> Int { gi % 2 == 0 ? srv0 : 1 - srv0 }

func replay(srv0: Int, fmt: String, ev: [Ev]) -> MatchState {
    var M = MatchState()
    M.server = srv0

    func currentServer() -> Int {
        if M.inTB {
            let n = M.pts[0] + M.pts[1]
            let k = n == 0 ? 0 : (n + 1) / 2
            return k % 2 == 0 ? M.tbFirst : 1 - M.tbFirst
        }
        return serverFor(M.gi, srv0)
    }

    func point(_ w: Int, server s: Int) {
        if M.inTB {
            M.pts[w] += 1
            let target = M.superTB ? 10 : 7
            let a = M.pts[0], b = M.pts[1]
            if max(a, b) >= target && abs(a - b) >= 2 {
                if M.superTB {
                    M.sets.append(SetScore(a: a, b: b, tb: nil, sup: true))
                } else {
                    M.sets.append(SetScore(a: a > b ? 7 : 6, b: a > b ? 6 : 7, tb: min(a, b), sup: false))
                }
                M.inTB = false; M.superTB = false
                M.gi += 1; M.games = [0, 0]; M.pts = [0, 0]
                M.change = true; M.setBreak = true; M.rest = 120
            } else if (a + b) % 6 == 0 {
                M.change = true; M.rest = 0
            }
        } else {
            M.pts[w] += 1
            if M.pts[w] >= 4 && M.pts[w] - M.pts[1 - w] >= 2 {
                M.stats[s].games += 1
                if w == s { M.stats[s].held += 1 }
                M.games[w] += 1; M.gi += 1; M.pts = [0, 0]
                let g = M.games, tot = g[0] + g[1]
                if (max(g[0], g[1]) >= 6 && abs(g[0] - g[1]) >= 2) || max(g[0], g[1]) == 7 {
                    M.sets.append(SetScore(a: g[0], b: g[1]))
                    M.games = [0, 0]
                    if tot % 2 == 1 { M.change = true; M.setBreak = true; M.rest = 120 }
                } else if g[0] == 6 && g[1] == 6 {
                    M.inTB = true; M.superTB = false; M.tbFirst = serverFor(M.gi, srv0)
                } else if tot % 2 == 1 {
                    M.change = true; M.rest = tot == 1 ? 0 : 90
                }
            }
        }
        let won = M.setsWon
        if won[0] == 2 || won[1] == 2 { M.winner = won[0] == 2 ? 0 : 1; M.change = false; return }
        if !M.inTB && won[0] == 1 && won[1] == 1 && fmt == "stb" && M.games == [0, 0] && M.sets.count == 2 {
            M.inTB = true; M.superTB = true; M.tbFirst = serverFor(M.gi, srv0)
        }
    }

    for e in ev {
        if M.winner != nil { break }
        M.change = false; M.rest = 0; M.setBreak = false
        let s = currentServer()
        M.server = s
        switch e {
        case .fault:
            if !M.second {
                M.second = true
                M.last = "Faute"
            } else {
                // Double faute : point au relanceur
                if M.isBreakPoint { M.stats[s].bpFaced += 1 }
                M.stats[s].pts += 1; M.stats[s].secPts += 1; M.stats[s].df += 1
                M.second = false
                M.last = "Double faute"
                point(1 - s, server: s)
            }
        case .me, .him:
            let w = e == .me ? 0 : 1
            if M.isBreakPoint { M.stats[s].bpFaced += 1; if w == s { M.stats[s].bpSaved += 1 } }
            M.stats[s].pts += 1
            if M.second {
                M.stats[s].secPts += 1
                if w == s { M.stats[s].secWon += 1 }
            } else {
                M.stats[s].firstIn += 1
                if w == s { M.stats[s].firstWon += 1 }
            }
            M.second = false
            M.last = w == 0 ? "Point Moi" : "Point Lui"
            point(w, server: s)
        case .ace:
            // Ace / service gagnant : point au serveur, compté sur 1re ou 2e balle
            if M.isBreakPoint { M.stats[s].bpFaced += 1; M.stats[s].bpSaved += 1 }
            M.stats[s].pts += 1
            if M.second {
                M.stats[s].secPts += 1; M.stats[s].secWon += 1
                M.stats[s].aces2 = (M.stats[s].aces2 ?? 0) + 1
            } else {
                M.stats[s].firstIn += 1; M.stats[s].firstWon += 1
                M.stats[s].aces1 = (M.stats[s].aces1 ?? 0) + 1
            }
            M.second = false
            M.last = "Ace"
            point(s, server: s)
        }
    }
    M.server = currentServer()
    return M
}

/// Une phrase au changement de côté, tirée des chiffres du match (rien de générique)
func changeLine(_ M: MatchState) -> String? {
    let me = M.stats[0], him = M.stats[1]
    func pct(_ a: Int, _ b: Int) -> Int { b == 0 ? 0 : Int((Double(a) * 100 / Double(b)).rounded()) }
    if him.df >= 2 && him.df > me.df {
        return "Sa 2e balle craque : \(him.df) doubles fautes. Avance d'un pas en retour."
    }
    if me.df >= 2 && me.df > him.df {
        return "\(me.df) doubles fautes pour toi : sur la 2e, vise le centre du carré."
    }
    if me.pts >= 8 && pct(me.firstIn, me.pts) < 55 {
        return "Ta 1re balle passe à \(pct(me.firstIn, me.pts)) % : assure-la, quitte à ralentir."
    }
    if him.games >= 2 && him.held < him.games {
        return "Tu l'as breaké \(him.games - him.held) fois sur \(him.games) jeux de service."
    }
    if me.games >= 2 && me.held == me.games {
        return "Tu as tenu tous tes jeux de service (\(me.held) sur \(me.games))."
    }
    return nil
}


// MARK: - 3.42 : coaching au changement de côté

/// Une carte du changement de côté : une consigne du plan (« MAINTENANT ») ou un chiffre du match (« CE QUE DIT TA MONTRE »)
struct Cue: Codable, Equatable { let id: String; let fromWatch: Bool; let t: String; let s: String; let prio: Int }

/// Qui a gagné les derniers jeux : > 0 = toi (nombre de jeux d'affilée), < 0 = lui
func gameStreak(srv0: Int, fmt: String, ev: [Ev]) -> Int {
    var winners: [Int] = [], prevTotal = 0
    var k = 0
    while k < ev.count {
        k += 1
        let M = replay(srv0: srv0, fmt: fmt, ev: Array(ev.prefix(k)))
        let total = M.sets.reduce(0) { $0 + $1.a + $1.b } + M.games[0] + M.games[1]
        if total > prevTotal {
            // le jeu qui vient de finir : celui dont le compteur a monté
            let prev = replay(srv0: srv0, fmt: fmt, ev: Array(ev.prefix(k - 1)))
            let a0 = prev.sets.reduce(0) { $0 + $1.a } + prev.games[0], a1 = M.sets.reduce(0) { $0 + $1.a } + M.games[0]
            winners.append(a1 > a0 ? 0 : 1)
            prevTotal = total
        }
    }
    guard let last = winners.last else { return 0 }
    var n = 0
    for w in winners.reversed() { if w == last { n += 1 } else { break } }
    return last == 0 ? n : -n
}

/// Les cartes possibles à ce moment du match, la plus utile d'abord.
/// 3.42.2 : les chiffres du match passent avant les consignes génériques ; une consigne du plan
/// ne remonte que si le moment s'y prête (5-5, début de match, set décisif…).
func coachCues(_ M: MatchState, plan: [WStep], streak: Int = 0) -> [Cue] {
    let me = M.stats[0], him = M.stats[1]
    func pct(_ a: Int, _ b: Int) -> Int { b == 0 ? 0 : Int((Double(a) * 100 / Double(b)).rounded()) }
    var out: [Cue] = []
    let a = M.games[0], b = M.games[1], setNo = M.sets.count + 1
    // --- Le moment du match
    if streak <= -3 {
        out.append(Cue(id: "m-lost", fromWatch: true, t: "Casse son rythme", s: "Il enchaîne \(-streak) jeux. Prends ton temps, 1re balle au centre.", prio: 11))
    } else if streak >= 3 {
        out.append(Cue(id: "m-won", fromWatch: true, t: "Ne change rien", s: "\(streak) jeux d'affilée pour toi. Même plan, même rythme.", prio: 8))
    }
    if !M.inTB && a == 5 && b <= 4 && M.server == 0 {
        out.append(Cue(id: "m-sfs", fromWatch: false, t: "Tu sers pour le set", s: "1re balle, du poids, pas de risque inutile.", prio: 12))
    }
    if !M.inTB && b == 5 && a <= 4 && M.server == 1 {
        out.append(Cue(id: "m-rfs", fromWatch: false, t: "Il sert pour le set", s: "Rien à perdre : avance en retour, fais-le jouer.", prio: 12))
    }
    // --- Ton service
    if me.games >= 3 && me.held == me.games && me.pts >= 12 && pct(me.firstWon, max(1, me.firstIn)) >= 70 {
        out.append(Cue(id: "s-strong", fromWatch: true, t: "Ton service fait mal", s: "\(me.held) jeux sur \(me.games), \(pct(me.firstWon, me.firstIn)) % derrière ta 1re. Continue à servir long.", prio: 7))
    }
    if me.pts >= 12 && pct(me.firstIn, me.pts) < 55 {
        out.append(Cue(id: "s-first", fromWatch: true, t: "Plus de 1res balles", s: "Ta 1re passe à \(pct(me.firstIn, me.pts)) %. Ralentis un peu.", prio: 9))
    }
    if me.secPts >= 8 && pct(me.secWon, me.secPts) < 40 {
        out.append(Cue(id: "s-sec", fromWatch: true, t: "Ta 2e balle prend cher", s: "\(me.secWon) points sur \(me.secPts). Plus de 1res.", prio: 9))
    }
    if me.df >= 3 && me.df > him.df {
        out.append(Cue(id: "s-df", fromWatch: true, t: "Sécurise ta 2e", s: "\(me.df) doubles fautes : vise le centre du carré, avec effet.", prio: 9))
    }
    if me.games >= 3 && me.games - me.held >= 2 {
        out.append(Cue(id: "s-broken", fromWatch: true, t: "Il lit ton service", s: "Breaké \(me.games - me.held) fois sur \(me.games). Varie : corps, T, slice large.", prio: 9))
    }
    // --- Son service, ton retour
    if him.games >= 3 && him.held == him.games && pct(him.firstWon, max(1, him.firstIn)) >= 72 {
        out.append(Cue(id: "r-wall", fromWatch: true, t: "Recule en retour", s: "Il gagne \(pct(him.firstWon, him.firstIn)) % derrière sa 1re. Bloque, remets en jeu long.", prio: 8))
    }
    if him.secPts >= 8 && pct(him.secWon, him.secPts) < 45 {
        out.append(Cue(id: "r-sec", fromWatch: true, t: "Attaque sa 2e balle", s: "Il n'en gagne que \(him.secWon) sur \(him.secPts). Avance d'un pas.", prio: 9))
    }
    if him.df >= 3 && him.df > me.df {
        out.append(Cue(id: "r-df", fromWatch: true, t: "Sa 2e balle craque", s: "\(him.df) doubles fautes. Mets-lui la pression en retour.", prio: 7))
    }
    if him.bpFaced >= 4 && pct(him.bpFaced - him.bpSaved, him.bpFaced) <= 30 {
        out.append(Cue(id: "r-bp", fromWatch: true, t: "Tes balles de break", s: "\(him.bpFaced - him.bpSaved) converties sur \(him.bpFaced). Sur la prochaine, retour long au centre.", prio: 8))
    }
    if him.games >= 3 && him.games - him.held >= 2 {
        out.append(Cue(id: "r-break", fromWatch: true, t: "Ton retour fait mal", s: "Tu l'as breaké \(him.games - him.held) fois. Garde la même position.", prio: 6))
    }
    if me.bpFaced >= 4 && pct(me.bpSaved, me.bpFaced) >= 70 {
        out.append(Cue(id: "m-clutch", fromWatch: true, t: "Solide sous pression", s: "\(me.bpSaved) balles de break sauvées sur \(me.bpFaced). Fais-toi confiance.", prio: 5))
    }
    // --- Le plan, seulement quand le moment s'y prête (sinon en bas de pile)
    let tight = !M.inTB && a >= 4 && b >= 4, early = setNo == 1 && a + b <= 3
    let decider = setNo >= 3 || (M.setsWon[0] == 1 && M.setsWon[1] == 1)
    for (i, st) in plan.prefix(3).enumerated() {
        let th = st.th ?? ""
        var p = 3 - i
        if st.id == "c-mental" { p = M.setsWon[1] > M.setsWon[0] ? 10 : 0 } // ton profil : « après un set perdu »
        else if th == "mental" || st.id.contains("clutch") { p = tight ? 10 : 1 }
        else if th == "start" { p = early ? 10 : 0 }
        else if th == "physique" { p = decider ? 10 : 2 }
        else if th == "retour" || th == "service" { p = 2 }
        out.append(Cue(id: st.id, fromWatch: false, t: st.t, s: st.s ?? "", prio: p))
    }
    return out.sorted { $0.prio > $1.prio }
}
