import SwiftUI
import WatchKit

extension Color {
    static let balle = Color(red: 0.831, green: 0.902, blue: 0.290)
    static let gazon = Color(red: 0.435, green: 0.761, blue: 0.561)
    static let terre = Color(red: 0.910, green: 0.541, blue: 0.369)
    /// 4.2.6 : bleu « dur » du code couleur (niveau, dates, chances), comme l'iPhone en Nuit
    static let bleuDur = Color(red: 0.553, green: 0.706, blue: 1.0)
    static let card = Color(white: 0.16)
    static let encre = Color(red: 0.043, green: 0.141, blue: 0.086)
}

/// Classements FFT, du meilleur au moins bon (la couronne fait défiler)
let RANKS = ["-30", "-15", "-4/6", "-2/6", "0", "1/6", "2/6", "3/6", "4/6", "5/6", "15", "15/1", "15/2", "15/3", "15/4", "15/5", "30", "30/1", "30/2", "30/3", "30/4", "30/5", "40", "NC"]

func pct(_ a: Int, _ b: Int) -> String { b == 0 ? "–" : "\(Int((Double(a) * 100 / Double(b)).rounded())) %" }

/// Bouton principal : capsule jaune balle, plus compacte que le style système
struct PrimaryStyle: ButtonStyle {
    var height: CGFloat = 40
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 15, weight: .heavy))
            .foregroundColor(.black)
            .frame(maxWidth: .infinity, minHeight: height)
            .background(Color.balle)
            .clipShape(Capsule())
            .opacity(configuration.isPressed ? 0.7 : 1)
    }
}

/// 3.29 · fond de l'app : dégradé sombre façon Exercice / Bevel
struct AppBackground: View {
    var body: some View {
        RadialGradient(colors: [Color(red: 0.14, green: 0.15, blue: 0.18), Color(red: 0.04, green: 0.05, blue: 0.06)],
                       center: .top, startRadius: 0, endRadius: 260).ignoresSafeArea()
    }
}
let appGradient = RadialGradient(colors: [Color(red: 0.14, green: 0.15, blue: 0.18), Color(red: 0.04, green: 0.05, blue: 0.06)], center: .top, startRadius: 0, endRadius: 260)
extension View {
    func appBackground() -> some View { background(AppBackground()) }
}

/// Carte translucide très arrondie
struct Glass<Content: View>: View {
    var tint: Color? = nil
    @ViewBuilder let content: Content
    var body: some View {
        content
            .padding(.horizontal, 12).padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(tint.map { $0.opacity(0.18) } ?? Color.white.opacity(0.09))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke((tint ?? .white).opacity(tint == nil ? 0.06 : 0.35), lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}

/// Pastille verticale avec anneau (montée, forme, semaine)
struct RingPill: View {
    let value: Double
    let text: String
    let label: String
    let color: Color
    var num: Int? = nil        // 3.71 : pourcentage à faire défiler (nil = texte fixe, ex. « 15/1 »)
    var delay: Double = 0
    // 3.71 : une seule fois par lancement, pas à chaque retour sur l'accueil (batterie)
    static var played = Set<String>()
    @Environment(\.accessibilityReduceMotion) private var reduce
    @Environment(\.isLuminanceReduced) private var dim
    @State private var k: Double = 1
    var body: some View {
        VStack(spacing: 4) {
            ZStack {
                Circle().stroke(color.opacity(0.22), lineWidth: 5.5)
                Circle().trim(from: 0, to: CGFloat(max(0.02, min(1, value * k))))
                    .stroke(color, style: StrokeStyle(lineWidth: 5.5, lineCap: .round)).rotationEffect(.degrees(-90))
                Group {
                    if let n = num { CountText(v: Double(n) * k) } else { Text(text).opacity(k < 0.5 ? 0.4 : 1) }
                }
                .font(.system(size: 14, weight: .heavy)).minimumScaleFactor(0.6).lineLimit(1).padding(.horizontal, 6)
            }.frame(width: 50, height: 50)
            Text(label).font(.system(size: 10.5, weight: .heavy)).foregroundColor(color).lineLimit(1).minimumScaleFactor(0.8)
        }
        .padding(.vertical, 7)
        .frame(maxWidth: .infinity)
        .background(LinearGradient(colors: [color.opacity(0.22), color.opacity(0.05)], startPoint: .top, endPoint: .bottom))
        .overlay(Capsule().stroke(color.opacity(0.28), lineWidth: 1))
        .clipShape(Capsule())
        .onAppear {
            guard !reduce, !dim, !RingPill.played.contains(label) else { return }
            RingPill.played.insert(label)
            k = 0
            withAnimation(.spring(response: 0.7, dampingFraction: 0.72).delay(delay)) { k = 1 }
        }
    }
}

/// 3.71 : un pourcentage qui défile jusqu'à sa valeur (suit l'animation de l'anneau)
struct CountText: View, Animatable {
    var v: Double
    var animatableData: Double { get { v } set { v = newValue } }
    var body: some View { Text("\(Int(max(0, v).rounded()))%").monospacedDigit() }
}

struct Wide: ButtonStyle {
    var bg: Color = .card
    var fg: Color = .white
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 15, weight: .heavy))
            .foregroundColor(fg)
            .lineLimit(1).minimumScaleFactor(0.75)
            .frame(maxWidth: .infinity, minHeight: 42)
            .background(bg)
            .clipShape(Capsule())
            .opacity(configuration.isPressed ? 0.7 : 1)
    }
}

/// Une option d'un écran de confirmation
struct ConfirmOption {
    let t: String
    var bg: Color = .balle
    var fg: Color = .black
    let action: () -> Void
}

/// Écran de confirmation plein écran, boutons en couleur (remplace les menus système)
struct ConfirmScreen: View {
    let title: String
    var note: String? = nil
    let options: [ConfirmOption]
    var cancel = "Annuler"
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Text(title).font(.system(size: 17, weight: .heavy)).multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                if let n = note { Text(n).font(.system(size: 12, weight: .semibold)).foregroundColor(.secondary).multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true) }
                ForEach(0..<options.count, id: \.self) { i in
                    let o = options[i]
                    Button(o.t) { dismiss(); DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { o.action() } }
                        .buttonStyle(Wide(bg: o.bg, fg: o.fg))
                }
                Button(cancel) { dismiss() }.buttonStyle(Wide())
            }.padding(.top, 4)
        }
    }
}

let terreInk = Color(red: 0.16, green: 0.07, blue: 0.02)

struct Chip: View {
    let t: String
    let on: Bool
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(t).font(.system(size: 13, weight: .bold))
                .foregroundColor(on ? .black : .white)
                .padding(.vertical, 7).frame(maxWidth: .infinity)
                .background(on ? Color.balle : Color.card)
                .clipShape(Capsule())
        }.buttonStyle(.plain)
    }
}

struct BigButton: View {
    let t: String
    let bg: Color
    let fg: Color
    var height: CGFloat = 58
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(t).font(.system(size: 18, weight: .heavy)).foregroundColor(fg)
                .frame(maxWidth: .infinity, minHeight: height)
                .background(bg)
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        }.buttonStyle(.plain)
    }
}

struct Quote: View {
    let t: String
    var body: some View {
        HStack(alignment: .top, spacing: 7) {
            Rectangle().fill(Color.balle).frame(width: 3)
            Text(t).font(.system(size: 12.5, weight: .semibold)).fixedSize(horizontal: false, vertical: true)
        }
    }
}

// MARK: - Racine

struct RootView: View {
    @ObservedObject var vm = MatchVM.shared
    @ObservedObject var tvm = TrainVM.shared
    var body: some View {
        if vm.live != nil {
            MatchView()
        } else if vm.warmup != nil {
            WarmupView()
        } else if tvm.live != nil {
            TrainView()
        } else {
            NavigationStack { HomeView() }
                .onOpenURL { u in
                    if u.host == "start" { Draft.shared.openSetup = true }
                    if u.host == "ace" { PhoneLink.shared.openAce = true } // 4.7 : complications d'Ace
                    if u.host == "train" { if PhoneLink.shared.todayPlan != nil { PhoneLink.shared.openPlay = true } else { startTraining() } } // 3.61.2 : la complication passe aussi par le choix
                }
        }
    }
}

func startTraining() {
    guard MatchVM.shared.live == nil, MatchVM.shared.warmup == nil, TrainVM.shared.live == nil else { return }
    Workout.shared.authorize { TrainVM.shared.begin() }
}

/// Grand bouton de l'accueil : icône à gauche, texte centré (3.34 : centrage symétrique, même axe pour tous)
struct HomeButton: View {
    let icon: String
    let t: String
    let s: String
    let main: Bool
    var body: some View {
        // 3.36 : icône + textes forment un seul bloc, centré dans le bouton (avant : texte centré seul,
        // l'icône collée à gauche décalait visuellement « Entraînement »)
        HStack(spacing: 8) {
            Image(systemName: icon).font(.system(size: 17, weight: .heavy)).foregroundColor(main ? .black : .gazon)
            VStack(alignment: .leading, spacing: 0) {
                Text(t).font(.system(size: 17, weight: .heavy)).lineLimit(1).minimumScaleFactor(0.8)
                Text(s).font(.system(size: 11, weight: .bold)).opacity(0.7).lineLimit(1).minimumScaleFactor(0.8)
            }
        }
        .frame(maxWidth: .infinity)
        .foregroundColor(main ? .black : .white)
        .padding(.horizontal, 10).padding(.vertical, 11)
        .background(main ? Color.balle : Color.gazon.opacity(0.18))
        .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(main ? Color.clear : Color.gazon.opacity(0.35), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
    }
}

/// Bouton de l'Accueil : titre + sous-titre
struct ModeButton: View {
    let t: String
    let s: String
    let main: Bool
    var body: some View {
        VStack(spacing: 1) {
            Text(t).font(.system(size: 15, weight: .heavy))
            Text(s).font(.system(size: 10.5, weight: .semibold)).opacity(0.7)
        }
        .foregroundColor(main ? .black : .white)
        .frame(maxWidth: .infinity, minHeight: 44)
        .background(main ? Color.balle : Color.card)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

// MARK: - 1. Accueil

struct HomeView: View {
    @ObservedObject var link = PhoneLink.shared
    @ObservedObject var draft = Draft.shared
    @State private var play = false
    @State private var forme = false
    var c: WCtx { link.ctx }
    var formV: Int { (c.form ?? []).filter { $0 == "V" }.count }
    var body: some View {
        ScrollView {
            VStack(spacing: 9) {
                // 3.81 (maquette validée) : le jour d'un match, sa carte passe en haut ; sinon l'après-match (3 jours)
                if let dy = c.day { DayCard(day: dy) }
                else if let lm = c.lastM { AfterCard(m: lm) }
                // 3.30 : classement visé, et en face le + pour lancer un match ou un entraînement
                HStack(spacing: 6) {
                    HStack(spacing: 5) {
                        if !c.rank.isEmpty { Circle().fill(Color.balle).frame(width: 10, height: 10) }
                        Text(c.rank.isEmpty ? "montée" : (c.next.isEmpty ? c.rank : "\(c.rank) → \(c.next)"))
                            .font(.system(size: 19, weight: .heavy)).lineLimit(1).minimumScaleFactor(0.6)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    Button { play = true } label: {
                        Image(systemName: "plus").font(.system(size: 18, weight: .heavy)).foregroundColor(.black)
                            .frame(width: 36, height: 36).background(Color.balle).clipShape(Circle())
                    }.buttonStyle(.plain).accessibilityLabel("Lancer un match ou un entraînement")
                }
                if !c.rank.isEmpty {
                    // Les mêmes 3 anneaux que l'accueil de l'iPhone
                    HStack(spacing: 5) {
                        if let r = c.rings {
                            // 3.32 : comme sur l'iPhone : Victoires et Niveau = une page, Forme = une fiche par le bas
                            NavigationLink { VictoiresDetail() } label: { RingPill(value: Double(r.win) / 100, text: "\(r.win)%", label: "Victoires", color: .gazon, num: r.win) }.buttonStyle(.plain)
                            Button { forme = true } label: { RingPill(value: Double(r.form) / 100, text: "\(r.form)%", label: "Forme", color: .balle, num: r.form, delay: 0.09) }.buttonStyle(.plain)
                            NavigationLink { if r.hasLvl == false { VictoiresDetail() } else { NiveauDetail() } } label: { RingPill(value: Double(r.lvlPct) / 100, text: r.lvl, label: r.lvlLabel, color: Color(red: 0.56, green: 0.66, blue: 1), delay: 0.18) }.buttonStyle(.plain)
                        } else {
                            NavigationLink { MonteeDetail() } label: { RingPill(value: Double(c.pct ?? 0) / 100, text: "\(c.pct ?? 0)%", label: "Montée", color: .balle, num: c.pct ?? 0) }.buttonStyle(.plain)
                            NavigationLink { FormeDetail() } label: {
                                RingPill(value: (c.form ?? []).isEmpty ? 0 : Double(formV) / Double((c.form ?? []).count), text: (c.form ?? []).isEmpty ? "–" : "\(formV)/\((c.form ?? []).count)", label: "Forme", color: .gazon)
                            }.buttonStyle(.plain)
                        }
                    }
                    // 3.81 : Ace dit la phrase du moment, comme sur l'iPhone (sinon la phrase courte d'avant)
                    if let a = c.ace, !a.t.isEmpty {
                        NavigationLink { AceDetail() } label: { AceLine(a: a) }.buttonStyle(.plain)
                    } else if !c.short.isEmpty {
                        Text(c.short).font(.system(size: 13, weight: .bold)).foregroundColor(Color(white: 0.8)).multilineTextAlignment(.center)
                    }
                }
                // 3.81 : « Ce qui arrive » en billets complets (avec leur en-tête)
                if !(c.cal ?? []).isEmpty { CalTickets() }
                MetricCards()
                // 3.49 : tes chances de monter (Montée+)
                if let ch = c.chances {
                    NavigationLink { ChancesDetail(ch: ch) } label: { HomeLine(icon: "chart.pie.fill", t: ch.down == true ? "Te maintenir" : "Tes chances", s: "\(ch.p) % d'être \(ch.t)" + (ch.deltaTxt.isEmpty ? "" : " · " + ch.deltaTxt)) }.buttonStyle(.plain)
                }
                if let fol = c.fol, !fol.isEmpty {
                    NavigationLink { CopainsView() } label: { HomeLine(icon: "person.2.fill", t: "Tes copains", s: fol[0].n + " · " + fol[0].s) }.buttonStyle(.plain)
                }
                if c.rank.isEmpty {
                    Text("Ouvre Montée sur ton iPhone pour retrouver ton classement et tes adversaires.")
                        .font(.system(size: 11)).foregroundColor(.secondary).multilineTextAlignment(.center)
                }
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .containerBackground(appGradient, for: .navigation)
        .navigationDestination(isPresented: $draft.openSetup) {
            if link.canPlay { SetupView() } else { PlusView() }
        }
        .navigationDestination(isPresented: $link.openAce) { AceDetail() }
        .sheet(isPresented: $forme) { FormeSheet() }
        .sheet(isPresented: $play) {
            PlaySheet { kind in
                play = false
                if kind == "match" { DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { draft.openSetup = true } }
                else if kind == "seance" { DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { PhoneLink.startSeance(json: PhoneLink.shared.ctx.seance) } }
                else { DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { startTraining() } }
            }
        }
        .task { await link.checkStore() }
        .onAppear { if link.openPlay { link.openPlay = false; play = true } }
        .onChange(of: link.openPlay) { _, v in if v { link.openPlay = false; play = true } }
    }
}

/// 3.30 : le + de l'accueil : Match ou Entraînement
struct PlaySheet: View {
    @ObservedObject var link = PhoneLink.shared
    let pick: (String) -> Void
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 8) {
                    Button { pick("match") } label: { HomeButton(icon: "play.fill", t: "Match", s: "on compte les points", main: true).frame(maxWidth: .infinity) }.buttonStyle(.plain)
                    // 3.61 : un jour de séance, Entraînement demande « Séance du jour » ou « Libre »
                    if let plan = link.todayPlan {
                        NavigationLink { TrainChoiceView(plan: plan, pick: pick) } label: { HomeButton(icon: "heart.fill", t: "Entraînement", s: "séance du jour ou libre", main: false).frame(maxWidth: .infinity) }.buttonStyle(.plain)
                        Text("Ta séance du jour est prête.").font(.system(size: 11, weight: .semibold)).foregroundColor(.gazon).multilineTextAlignment(.center)
                    } else {
                        Button { pick("train") } label: { HomeButton(icon: "heart.fill", t: "Entraînement", s: "sans score · gratuit", main: false).frame(maxWidth: .infinity) }.buttonStyle(.plain)
                    }
                    if !link.hasPlus && !link.freeUsed {
                        Text("1 match au poignet offert chaque mois.").font(.system(size: 11, weight: .semibold)).foregroundColor(.gazon).multilineTextAlignment(.center)
                    }
                }.padding(.horizontal, 2)
            }
            .navigationTitle("Jouer")
            .containerBackground(appGradient, for: .navigation)
        }
    }
}

/// 3.32 : Victoires (page) : % sur 12 mois, V/D, selon l'adversaire
struct VictoiresDetail: View {
    @ObservedObject var link = PhoneLink.shared
    var body: some View {
        let r = link.ctx.rings
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                DetailTitle(t: "Victoires · 12 mois", color: .gazon)
                Text("\(r?.win ?? 0) %").font(.system(size: 30, weight: .heavy))
                if let v = r?.v, let d = r?.d { Text("\(v) V · \(d) D").font(.system(size: 14, weight: .heavy)).foregroundColor(.secondary) }
                BallBar(value: Double(r?.win ?? 0) / 100, color: .gazon)
                ForEach(r?.groups ?? [], id: \.self) { g in
                    let p = g.n > 0 ? Double(g.v) / Double(g.n) : 0
                    VStack(alignment: .leading, spacing: 3) {
                        HStack {
                            Text(g.k).font(.system(size: 12.5, weight: .bold))
                            Spacer(minLength: 4)
                            Text("\(g.v)/\(g.n)").font(.system(size: 13, weight: .heavy)).foregroundColor(p >= 0.5 ? .gazon : .terre)
                        }
                        BallBar(value: p, color: p >= 0.5 ? .gazon : .terre)
                    }.padding(.top, 2)
                }
            }
        }.containerBackground(appGradient, for: .navigation)
    }
}

/// 3.32 : Niveau joué (page)
struct NiveauDetail: View {
    @ObservedObject var link = PhoneLink.shared
    var body: some View {
        let r = link.ctx.rings, blue = Color(red: 0.56, green: 0.66, blue: 1)
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                DetailTitle(t: "Niveau joué", color: blue)
                Text(r?.lvl ?? "–").font(.system(size: 34, weight: .heavy))
                if let cur = r?.cur { Text("ton classement : " + cur).font(.system(size: 13, weight: .bold)).foregroundColor(.secondary) }
                if let say = r?.say { Glass(tint: blue) { Text(say).font(.system(size: 13, weight: .heavy)).fixedSize(horizontal: false, vertical: true) } }
                if let n = r?.lvlN { Text("D'après tes \(n) matchs sur 12 mois.").font(.system(size: 11, weight: .semibold)).foregroundColor(.secondary) }
            }
        }.containerBackground(appGradient, for: .navigation)
    }
}

/// 3.32 : Forme (fiche par le bas) : 6 derniers, la phrase, les séries
struct FormeSheet: View {
    @ObservedObject var link = PhoneLink.shared
    var body: some View {
        let c = link.ctx, f = c.form ?? [], r = c.rings
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                Text("Ta forme").font(.system(size: 17, weight: .heavy))
                HStack(spacing: 3) {
                    // 3.36 : 6 derniers matchs (comme sur l'iPhone) : pastilles un peu plus petites pour tenir sur 40 mm
                    ForEach(Array(f.enumerated()), id: \.offset) { _, x in
                        Text(x).font(.system(size: 11.5, weight: .heavy)).foregroundColor(x == "V" ? .encre : terreInk)
                            .frame(width: 22, height: 22).background(x == "V" ? Color.gazon : Color.terre).clipShape(Circle())
                    }
                }
                if let s = r?.formSay { Text(s).font(.system(size: 13, weight: .heavy)).fixedSize(horizontal: false, vertical: true) }
                HStack(spacing: 6) {
                    if let n = r?.streakN, let k = r?.streakR { StatTile(k: "série en cours", v: "\(n) \(k)") }
                    if let b = r?.best { StatTile(k: "meilleure série", v: "\(b) V") }
                }
            }.padding(.horizontal, 2)
        }
    }
}

/// Couleur d'une stat en % : orange sous le seuil bas, vert au-dessus du seuil haut, bleu entre les deux
func gaugeColor(_ pct: Int, low: Int = 40, high: Int = 60) -> Color {
    pct < low ? .terre : pct >= high ? .gazon : Color(red: 0.56, green: 0.66, blue: 1)
}

/// Mental : 1er set gagné → match, 3e set, tie-breaks… (12 mois)
struct MentalDetail: View {
    @ObservedObject var link = PhoneLink.shared
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 9) {
                DetailTitle(t: "Mental · 12 mois", color: .gazon)
                ForEach(link.ctx.mental ?? [], id: \.self) { m in
                    let p = m.n > 0 ? Int((Double(m.v) * 100 / Double(m.n)).rounded()) : 0
                    VStack(alignment: .leading, spacing: 3) {
                        HStack {
                            Text(m.k).font(.system(size: 12.5, weight: .bold)).lineLimit(1).minimumScaleFactor(0.8)
                            Spacer(minLength: 4)
                            Text("\(m.v)/\(m.n)").font(.system(size: 13, weight: .heavy)).foregroundColor(gaugeColor(p))
                        }
                        BallBar(value: Double(p) / 100, color: gaugeColor(p))
                    }
                }
                Text("D'après les scores de tes matchs.").font(.system(size: 11, weight: .semibold)).foregroundColor(.secondary)
            }
        }.containerBackground(appGradient, for: .navigation)
    }
}

// MARK: - Détails ouverts depuis l'accueil

/// En-tête d'un détail : petit titre en couleur
struct DetailTitle: View {
    let t: String
    let color: Color
    var body: some View { Text(t.uppercased()).font(.system(size: 12, weight: .heavy)).foregroundColor(color).frame(maxWidth: .infinity, alignment: .leading) }
}

/// Barre terminée par une balle de tennis (même dessin que l'iPhone)
struct BallBar: View {
    let value: Double
    var color: Color = .balle
    var body: some View {
        GeometryReader { g in
            let f = CGFloat(max(0, min(1, value))), x = (g.size.width - 18) * f
            ZStack(alignment: .leading) {
                Capsule().fill(Color.white.opacity(0.14)).frame(height: 8)
                Capsule().fill(color).frame(width: x + 9, height: 8)
                ZStack {
                    Circle().fill(color)
                    Path { p in
                        p.move(to: CGPoint(x: 3, y: 4.5)); p.addCurve(to: CGPoint(x: 3, y: 13.5), control1: CGPoint(x: 6.5, y: 7), control2: CGPoint(x: 6.5, y: 11))
                        p.move(to: CGPoint(x: 15, y: 4.5)); p.addCurve(to: CGPoint(x: 15, y: 13.5), control1: CGPoint(x: 11.5, y: 7), control2: CGPoint(x: 11.5, y: 11))
                    }.stroke(Color.black.opacity(0.55), style: StrokeStyle(lineWidth: 1.3, lineCap: .round))
                }.frame(width: 18, height: 18).offset(x: x)
            }.frame(height: 18)
        }.frame(height: 18)
    }
}

struct MonteeDetail: View {
    @ObservedObject var link = PhoneLink.shared
    var body: some View {
        let c = link.ctx
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                DetailTitle(t: "Montée", color: .balle)
                Text("\(c.pct ?? 0) %").font(.system(size: 30, weight: .heavy))
                Text("vers " + c.next + (c.relLabel.map { " · sortie le " + $0 } ?? "")).font(.system(size: 12, weight: .bold)).foregroundColor(.secondary)
                BallBar(value: Double(c.pct ?? 0) / 100)
                Glass {
                    VStack(alignment: .leading, spacing: 3) {
                        if !c.short.isEmpty { Text(c.short).font(.system(size: 13, weight: .heavy)) }
                        if let g = c.gap { Text(g > 0 ? "Il te manque \(g) pts" : "Tu as les points").font(.system(size: 12, weight: .semibold)).foregroundColor(.secondary) }
                    }
                }
            }
        }.containerBackground(appGradient, for: .navigation)
    }
}

struct FormeDetail: View {
    @ObservedObject var link = PhoneLink.shared
    var body: some View {
        let c = link.ctx, f = c.form ?? []
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                DetailTitle(t: "Forme", color: .gazon)
                Text("\(f.filter { $0 == "V" }.count) V sur \(f.count)").font(.system(size: 24, weight: .heavy))
                HStack(spacing: 4) {
                    ForEach(Array(f.enumerated()), id: \.offset) { _, r in
                        Text(r).font(.system(size: 12, weight: .heavy)).foregroundColor(r == "V" ? .encre : terreInk)
                            .frame(width: 26, height: 26).background(r == "V" ? Color.gazon : Color.terre).clipShape(Circle())
                    }
                }
                ForEach(c.recent ?? [], id: \.self) { m in
                    HStack {
                        Text(m.r + " · " + m.opp + (m.rank.isEmpty ? "" : " " + m.rank)).lineLimit(1)
                        Spacer(minLength: 4)
                        Text(m.score).fontWeight(.heavy).lineLimit(1)
                    }.font(.system(size: 12, weight: .semibold))
                    Divider().opacity(0.3)
                }
                if let st = c.streak { Text(st).font(.system(size: 11.5, weight: .semibold)).foregroundColor(.secondary) }
            }
        }.containerBackground(appGradient, for: .navigation)
    }
}

struct ServiceDetail: View {
    @ObservedObject var link = PhoneLink.shared
    var body: some View {
        let sv = link.ctx.serve
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                DetailTitle(t: "Ton service", color: Color(red: 0.56, green: 0.66, blue: 1))
                if let sv = sv {
                    Text(sv.first.map { "\($0) %" } ?? "–").font(.system(size: 30, weight: .heavy))
                    Text("de 1res balles · \(sv.n) match" + (sv.n > 1 ? "s" : "") + " à la montre").font(.system(size: 12, weight: .bold)).foregroundColor(.secondary)
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 6), GridItem(.flexible(), spacing: 6)], spacing: 6) {
                        if let b = sv.bpWon { StatTile(k: "Balles de break", v: "\(b) % gagnées", color: .balle) }
                        if let b = sv.bpSaved { StatTile(k: "À sauver", v: "\(b) % sauvées", color: .gazon) }
                        if let h = sv.held { StatTile(k: "Jeux tenus", v: "\(h) %") }
                        if let d = sv.df { StatTile(k: "Doubles fautes", v: String(format: "%.1f", d).replacingOccurrences(of: ".", with: ",")) }
                    }
                    if let t = sv.trend, t != 0 {
                        Text((t > 0 ? "↗ +" : "↘ ") + "\(t) pts de 1res balles sur tes 3 derniers").font(.system(size: 11, weight: .bold)).foregroundColor(t > 0 ? .gazon : .terre)
                    }
                } else {
                    Text("Compte un match à la montre : ton service s'affichera ici.").font(.system(size: 13, weight: .semibold)).foregroundColor(.secondary)
                }
            }
        }.containerBackground(appGradient, for: .navigation)
    }
}

struct OppDetail: View {
    @ObservedObject var link = PhoneLink.shared
    let nx: WNext
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                let revanche = (nx.fd ?? 0) > (nx.fv ?? 0) && !nx.when.isEmpty
                // 4.2.6 (identité, maquette validée) : date en bleu dur, Ace à côté du nom, balle devant le classement, chances en bleu
                DetailTitle(t: nx.when.isEmpty ? "Consulté récemment" : "Ton match · " + nx.when + (revanche ? " · la revanche" : ""), color: revanche ? .balle : (nx.when.isEmpty ? .secondary : .bleuDur))
                HStack(alignment: .center, spacing: 6) {
                    Text(nx.name).font(.system(size: 19, weight: .heavy)).lineLimit(2).frame(maxWidth: .infinity, alignment: .leading)
                    AceBall(mood: (nx.p ?? 50) >= 40 ? "joie" : "repos", size: 28)
                }
                if !nx.rank.isEmpty {
                    HStack(spacing: 5) {
                        RankTag(r: nx.rank, size: 12).foregroundColor(.secondary)
                        if let p = nx.p { OddsBall(p: p, hex: nx.pc, size: 24) } // 4.14 : la balle des chances
                    }
                }
                // 3.49 (maquette validée) : votre face-à-face en tête
                if let v = nx.fv, let d = nx.fd { FafBlock(v: v, d: d, seq: nx.fseq ?? "", last: nx.last) }
                if nx.mode == "impossible" || nx.mode == "abyssal" {
                    // 3.34 : écart énorme : pas de conseil tactique, le même ton que l'iPhone
                    let imp = nx.mode == "impossible", col: Color = imp ? Color(red: 0.71, green: 0.61, blue: 1) : Color(red: 0.95, green: 0.82, blue: 0.29)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(imp ? "MISSION IMPOSSIBLE" : "L'ÉCART ABYSSAL").font(.system(size: 10, weight: .heavy)).kerning(0.8).foregroundColor(col)
                        Text(imp ? "< 5 %" : "\(nx.gap ?? 5) échelons") // 4.14 : jamais « 0 % ».font(.system(size: 26, weight: .heavy))
                        Text(imp ? "Sur un malentendu, ça peut marcher." : "Le seul qui peut te battre aujourd'hui, c'est toi.")
                            .font(.system(size: 12, weight: .bold)).fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(10).frame(maxWidth: .infinity, alignment: .leading)
                    .background(col.opacity(0.16)).clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                    Glass {
                        Text(imp ? "Objectif : lui prendre un jeu.\nEt une photo à la fin." : "Objectif : gagner sans perdre un set.\nPas d'amortie « pour voir ».")
                            .font(.system(size: 12, weight: .bold)).fixedSize(horizontal: false, vertical: true)
                    }
                } else {
                    HStack(spacing: 6) {
                        if let p = nx.p, nx.fv == nil { OddsBall(p: p, hex: nx.pc, size: 46) } // 4.14 : la balle des chances
                        if !nx.h2h.isEmpty, nx.fv == nil { StatTile(k: "Face-à-face", v: nx.h2h) }
                    }
                    OppCoach(nx: nx)
                }
                NavigationLink {
                    if link.canPlay { ServerView(opp: WOpp(id: (nx.id ?? "").isEmpty ? "new" : nx.id!, name: nx.name, rank: nx.rank, p: nx.p, tip: nx.tip, plan: nx.plan, forts: nx.forts, faibles: nx.faibles)) } else { PlusView() }
                } label: { Label("Lancer le match", systemImage: "play.fill") }
                .buttonStyle(Wide(bg: .balle, fg: .black))
            }
        }.containerBackground(appGradient, for: .navigation)
    }
}

/// 3.42 : le plan de jeu et son jeu, sur la fiche de l'adversaire (Montée+ ou match offert du mois)
/// 3.49 : le face-à-face sur la fiche de l'adversaire : bilan en grand (vert devant, terre derrière), un carré par match
struct FafBlock: View {
    let v: Int; let d: Int; let seq: String; let last: String?
    var col: Color { v > d ? .gazon : v < d ? .terre : .white }
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(alignment: .firstTextBaseline, spacing: 0) {
                Text("\(v)").foregroundColor(col)
                Text(" – ").foregroundColor(.secondary).font(.system(size: 30, weight: .medium))
                Text("\(d)").foregroundColor(col)
            }.font(.system(size: 40, weight: .heavy))
            FafSquares(seq: seq, size: 10)
            if let l = last, !l.isEmpty { Text("Dernier : " + l).font(.system(size: 12, weight: .semibold)).foregroundColor(.secondary) }
        }
    }
}
struct FafSquares: View {
    let seq: String; let size: CGFloat
    var body: some View {
        HStack(spacing: 3) {
            ForEach(Array(seq.suffix(10).enumerated()), id: \.offset) { _, r in
                RoundedRectangle(cornerRadius: size / 3.5, style: .continuous).fill(r == "V" ? Color.gazon : Color.terre.opacity(0.6)).frame(width: size, height: size)
            }
        }
    }
}

/// 3.49 : tes chances de monter (même calcul que l'iPhone)
struct ChancesDetail: View {
    let ch: WChances
    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                DetailTitle(t: ch.down == true ? "Te maintenir" : "Tes chances de monter", color: .balle)
                ZStack {
                    Circle().stroke(Color.card, lineWidth: 10)
                    Circle().trim(from: 0, to: max(0.02, Double(ch.p) / 100)).stroke(Color.balle, style: StrokeStyle(lineWidth: 10, lineCap: .round)).rotationEffect(.degrees(-90))
                    Text("\(ch.p)%").font(.system(size: 28, weight: .heavy))
                }.frame(width: 96, height: 96)
                Text(ch.t + " le " + ch.rel).font(.system(size: 13, weight: .bold)).foregroundColor(.secondary)
                if !ch.deltaTxt.isEmpty { Text(ch.deltaTxt + " cette semaine").font(.system(size: 13, weight: .heavy)).foregroundColor((ch.delta ?? 0) > 0 ? .gazon : .terre) }
            }.frame(maxWidth: .infinity)
        }.containerBackground(appGradient, for: .navigation)
    }
}

struct OppCoach: View {
    @ObservedObject var link = PhoneLink.shared
    let nx: WNext
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if nx.fv == nil, let last = nx.last, !last.isEmpty {
                Text("La dernière fois : " + last).font(.system(size: 11.5, weight: .bold)).foregroundColor(.secondary)
            }
            if let plan = nx.plan, !plan.isEmpty {
                SectionLabel(t: nx.rv == true ? "TA REVANCHE" : "TON PLAN")
                if link.canPlay {
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(Array(plan.filter { ($0.th ?? "") != "obj" && ($0.th ?? "") != "planb" }.prefix(3).enumerated()), id: \.offset) { i, st in
                            HStack(alignment: .top, spacing: 8) {
                                Text("\(i + 1)").font(.system(size: 12, weight: .heavy)).foregroundColor(.black)
                                    .frame(width: 20, height: 20).background(st.k == "pro" ? Color.terre : Color.balle).clipShape(Circle())
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(st.t).font(.system(size: 14, weight: .heavy)).fixedSize(horizontal: false, vertical: true)
                                    if let s = st.s, !s.isEmpty { Text(s).font(.system(size: 11)).foregroundColor(.secondary).lineLimit(2) }
                                }
                            }
                        }
                    }
                } else {
                    Glass {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Le plan au poignet, c'est Montée+").font(.system(size: 13, weight: .heavy)).fixedSize(horizontal: false, vertical: true)
                            Text("Ton match offert du mois est utilisé. Le plan reste sur ton iPhone, gratuit.").font(.system(size: 11)).foregroundColor(.secondary).fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            } else if !nx.tip.isEmpty { Quote(t: nx.tip + (nx.tipS.isEmpty ? "" : " " + nx.tipS)) }
            // 3.56 : tes objectifs de jeu, avec la couleur de leur catégorie
            if let obj = nx.plan?.filter({ ($0.th ?? "") == "obj" }), !obj.isEmpty {
                SectionLabel(t: "TON MATCH DU JOUR")
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(Array(obj.enumerated()), id: \.offset) { _, st in
                        HStack(alignment: .firstTextBaseline, spacing: 6) {
                            Circle().fill(goalColor(st.k)).frame(width: 8, height: 8)
                            Text(st.t).font(.system(size: 14, weight: .heavy)).fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }
            if link.canPlay, (nx.forts?.isEmpty == false || nx.faibles?.isEmpty == false) {
                SectionLabel(t: "SON JEU")
                if let f = nx.forts, !f.isEmpty { Text("Fort · " + f.joined(separator: ", ")).font(.system(size: 12.5, weight: .bold)).foregroundColor(.gazon).fixedSize(horizontal: false, vertical: true) }
                if let w = nx.faibles, !w.isEmpty { Text("Faible · " + w.joined(separator: ", ")).font(.system(size: 12.5, weight: .bold)).foregroundColor(.terre).fixedSize(horizontal: false, vertical: true) }
            }
        }
    }
}

struct DefendDetail: View {
    @ObservedObject var link = PhoneLink.shared
    var body: some View {
        let c = link.ctx, ms = c.defMonths ?? []
        let mx = Double(ms.map { max($0.total, $0.norme) }.max() ?? 1)
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                DetailTitle(t: "À défendre" + ((c.defLabel ?? "").isEmpty ? "" : " · " + (c.defLabel ?? "")), color: .terre)
                Text(((c.defNow ?? 0) > 0 ? "−\(c.defNow ?? 0) pts en " : "Rien en ") + (c.thisMonth ?? "ce moment") + ".\nLes 6 prochains mois :")
                    .font(.system(size: 14, weight: .heavy)).fixedSize(horizontal: false, vertical: true)
                HStack(alignment: .bottom, spacing: 4) {
                    ForEach(Array(ms.enumerated()), id: \.offset) { i, m in
                        VStack(spacing: 2) {
                            RoundedRectangle(cornerRadius: 5).fill(m.total < m.norme ? Color.terre : Color.gazon).opacity(m.lost.isEmpty && i != 0 ? 0.4 : 1)
                                .frame(height: max(6, 70 * Double(m.total) / mx))
                            Text(m.m.replacingOccurrences(of: ".", with: "")).font(.system(size: 9.5, weight: .bold)).foregroundColor(.secondary).lineLimit(1).minimumScaleFactor(0.7)
                        }
                    }
                }.frame(height: 86)
                ForEach(Array(ms.enumerated()), id: \.offset) { _, m in
                    ForEach(m.lost, id: \.self) { w in
                        HStack {
                            Text(m.m + " · " + w.opp + " " + w.rank).lineLimit(1)
                            Spacer(minLength: 4)
                            Text("−\(w.pts)").fontWeight(.heavy).foregroundColor(.terre)
                        }.font(.system(size: 12, weight: .semibold))
                    }
                }
                if ms.allSatisfy({ $0.lost.isEmpty }) { Text("Aucune victoire ne sort d'ici 6 mois.").font(.system(size: 12, weight: .semibold)).foregroundColor(.secondary) }
            }
        }.containerBackground(appGradient, for: .navigation)
    }
}

struct PlusView: View {
    @ObservedObject var link = PhoneLink.shared
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                Text("Montée+").font(.system(size: 20, weight: .heavy)).foregroundColor(.balle)
                Text("Le score au poignet, Faute et Double faute, ton cardio et tes stats de service.")
                    .font(.system(size: 13, weight: .semibold)).fixedSize(horizontal: false, vertical: true)
                Text("Ton match offert du mois est utilisé. Le prochain arrive le 1er du mois, ou abonne-toi dans Montée sur ton iPhone : menu › Montée+.")
                    .font(.system(size: 12)).foregroundColor(.secondary).fixedSize(horizontal: false, vertical: true)
                Button("Déjà abonné ? Vérifier") { Task { await link.checkStore() } }
                    .font(.system(size: 13, weight: .bold))
            }
        }.navigationTitle("Montée+")
    }
}

// MARK: - Cartes de métriques (sous le bouton, on les fait défiler à la couronne)

struct Card<Content: View>: View {
    let title: String
    var color: Color = .balle
    @ViewBuilder let content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title).font(.system(size: 13, weight: .heavy)).foregroundColor(.secondary).padding(.leading, 4)
            Glass {
                VStack(alignment: .leading, spacing: 6) { content }
            }
        }
        .padding(.top, 4)
    }
}

struct KV: View {
    let k: String
    let v: String
    var color: Color = .white
    var body: some View {
        HStack { Text(k).foregroundColor(.secondary); Spacer(minLength: 4); Text(v).fontWeight(.heavy).foregroundColor(color) }
            .font(.system(size: 12.5, weight: .semibold))
    }
}

struct MetricCards: View {
    @ObservedObject var link = PhoneLink.shared
    var c: WCtx { link.ctx }
    var body: some View {
        VStack(spacing: 8) {
            // 3.30 : Mental (remplace « Ton arme n°1 ») : 3 lignes, le détail en barres
            if let ms = c.mental, !ms.isEmpty {
                NavigationLink { MentalDetail() } label: {
                    VStack(alignment: .leading, spacing: 5) {
                        Text("Mental").font(.system(size: 13, weight: .heavy)).foregroundColor(.secondary).padding(.leading, 4)
                        Glass {
                            VStack(spacing: 4) {
                                ForEach(Array(ms.filter { $0.k != "Après avoir perdu le 1er" && $0.k != "Sets gagnés" }.prefix(3)), id: \.self) { m in
                                    let p = m.n > 0 ? Int((Double(m.v) * 100 / Double(m.n)).rounded()) : 0
                                    HStack {
                                        Text(m.k).font(.system(size: 12, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.75)
                                        Spacer(minLength: 4)
                                        Text("\(m.v)/\(m.n)").font(.system(size: 12.5, weight: .heavy)).foregroundColor(gaugeColor(p))
                                    }
                                }
                            }
                        }
                    }.padding(.top, 4)
                }.buttonStyle(.plain)
            }
            if link.hasPlus {
                // Dernière recherche / match programmé : s'ouvre sur sa fiche (et on lance le match)
                if let nx = c.nextOpp {
                    NavigationLink { OppDetail(nx: nx) } label: {
                        Card(title: nx.when.isEmpty ? "Consulté récemment" : "Ton match · " + nx.when) {
                            HStack {
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(nx.name).font(.system(size: 15, weight: .heavy)).lineLimit(1)
                                    Text(nx.rank).font(.system(size: 11.5, weight: .bold)).foregroundColor(.secondary).lineLimit(1)
                                }
                                if let p = nx.p { OddsBall(p: p, hex: nx.pc, size: 30) } // 4.14 : la balle des chances
                                Spacer(minLength: 2)
                                Image(systemName: "chevron.right").font(.system(size: 12, weight: .heavy)).foregroundColor(.secondary)
                            }
                        }
                    }.buttonStyle(.plain)
                }
            } else if c.form != nil {
                Card(title: "Montée+", color: .balle) {
                    Text("La fiche de ton prochain adversaire et le match au poignet sans limite.")
                        .font(.system(size: 12, weight: .semibold)).fixedSize(horizontal: false, vertical: true)
                }
            }
            // À défendre : rien ce mois-ci, ou combien ; le détail montre les 6 prochains mois
            if c.defMonths != nil {
                NavigationLink { DefendDetail() } label: {
                    VStack(alignment: .leading, spacing: 5) {
                        Text("À défendre").font(.system(size: 13, weight: .heavy)).foregroundColor(.secondary).padding(.leading, 4)
                        Glass {
                            HStack {
                                VStack(alignment: .leading, spacing: 1) {
                                    Text((c.defNow ?? 0) > 0 ? "−\(c.defNow ?? 0) pts ce mois-ci" : "✓ Rien ce mois-ci").font(.system(size: 14, weight: .heavy)).foregroundColor((c.defNow ?? 0) > 0 ? .terre : .gazon)
                                    if let d = c.defend, d > 0 { Text("ensuite −\(d) pts" + (c.defendWhen.map { " en " + $0 } ?? "")).font(.system(size: 11.5, weight: .bold)).foregroundColor(.secondary) }
                                }
                                Spacer(minLength: 2)
                                Image(systemName: "chevron.right").font(.system(size: 12, weight: .heavy)).foregroundColor(.secondary)
                            }
                        }
                    }.padding(.top, 4)
                }.buttonStyle(.plain)
            }
            // Calendrier (gratuit)
            if let r = c.rel {
                Card(title: "Calendrier") {
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text("\(max(0, r))").font(.system(size: 28, weight: .heavy))
                        Text(r == 1 ? "jour" : "jours").font(.system(size: 13, weight: .heavy))
                    }
                    if let l = c.relLabel { Text("avant le classement du " + l).font(.system(size: 11)).foregroundColor(.secondary) }
                    if let g = c.gap { KV(k: "Il te manque", v: g > 0 ? "\(g) pts" : "rien", color: .balle) }
                }
            }
        }
    }
}

// MARK: - 2. Type et format

struct SetupView: View {
    @ObservedObject var d = Draft.shared
    @ObservedObject var link = PhoneLink.shared
    var body: some View {
        ScrollView {
            // 3.36 : la façon de compter d'abord ; le format du 3e set se choisit en route, à 1 set partout
            VStack(alignment: .leading, spacing: 7) {
                SectionLabel(t: "COMMENT TU COMPTES ?")
                ModeOption(icon: "hand.tap.fill", t: "Simple", s: "Moi / Lui, juste le score", on: !d.adv) { d.adv = false }
                ModeOption(icon: "arrow.up.arrow.down", t: "Avancé", s: "Gestes · fautes, aces, stats de service", on: d.adv) { d.adv = true }
                SectionLabel(t: "LE MATCH").padding(.top, 4)
                Segmented(a: "Homologué", b: "Libre", first: d.hom) { d.hom = $0 }
                Text(d.hom ? "Compte pour ton classement" : "Sans effet sur ton classement")
                    .font(.system(size: 11, weight: .semibold)).foregroundColor(.secondary).padding(.horizontal, 6)
                NavigationLink {
                    OppListView()
                } label: {
                    Text("Continuer").font(.system(size: 16, weight: .heavy)).foregroundColor(.black).frame(maxWidth: .infinity)
                }
                .buttonStyle(PrimaryStyle(height: 48)).padding(.top, 6)
            }
        }.navigationTitle("Nouveau match")
        .onAppear {
            // 3.40 : un match programmé connaît déjà homologué / libre
            if let p = link.ctx.opps.first(where: { ($0.tag ?? "").hasPrefix("Prévu") }), let h = p.hom { d.hom = h }
        }
    }
}

// MARK: - 3. Contre qui ?

struct OppListView: View {
    @ObservedObject var link = PhoneLink.shared
    var body: some View {
        List {
            ForEach(link.ctx.opps) { o in
                NavigationLink {
                    ServerView(opp: o)
                } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        if let t = o.tag {
                            Text(t.uppercased()).font(.system(size: 10, weight: .heavy))
                                .foregroundColor(t.hasPrefix("Prévu") ? .balle : .secondary)
                        }
                        HStack {
                            Text(o.name).font(.system(size: 15, weight: .bold)).lineLimit(1)
                            Spacer(minLength: 4)
                            Text(o.rank).font(.system(size: 13, weight: .semibold)).foregroundColor(.secondary)
                        }
                    }
                }
                .listRowBackground(RoundedRectangle(cornerRadius: 12).fill((o.tag ?? "").hasPrefix("Prévu") ? Color.balle.opacity(0.2) : Color.card))
            }
            NavigationLink {
                RankView()
            } label: {
                Label("Nouvel adversaire", systemImage: "plus").font(.system(size: 15, weight: .bold)).foregroundColor(.balle)
            }
        }
        .navigationTitle("Contre qui ?")
    }
}

// MARK: - 4. Nouvel adversaire : classement puis nom

struct RankView: View {
    @ObservedObject var d = Draft.shared
    @ObservedObject var link = PhoneLink.shared
    @State private var rank = ""
    var ranks: [String] { d.hom ? RANKS : RANKS + ["Je ne sais pas"] }
    var body: some View {
        VStack(spacing: 6) {
            Picker("Son classement", selection: $rank) {
                ForEach(ranks, id: \.self) { r in Text(r).tag(r) }
            }
            .pickerStyle(.wheel)
            .frame(height: 104)
            NavigationLink {
                NameView(rank: rank == "Je ne sais pas" ? "" : rank)
            } label: {
                Text("OK").font(.system(size: 15, weight: .heavy)).foregroundColor(.black).frame(maxWidth: .infinity)
            }
            .buttonStyle(PrimaryStyle())
        }
        .navigationTitle("Son classement")
        .onAppear { if rank.isEmpty { rank = ranks.contains(link.ctx.rank) ? link.ctx.rank : "15/4" } }
    }
}

struct NameView: View {
    let rank: String
    @State private var name = ""
    var fallback: String { rank.isEmpty ? "Adversaire" : "Adversaire " + rank }
    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                TextField("Son nom (facultatif)", text: $name)
                HStack(spacing: 6) {
                    NavigationLink {
                        ServerView(opp: WOpp(id: "new", name: fallback, rank: rank))
                    } label: {
                        Text("Passer").font(.system(size: 14, weight: .bold)).frame(maxWidth: .infinity)
                    }
                    NavigationLink {
                        ServerView(opp: WOpp(id: "new", name: name.trimmingCharacters(in: .whitespaces).isEmpty ? fallback : name, rank: rank))
                    } label: {
                        Text("OK").font(.system(size: 14, weight: .heavy)).foregroundColor(.black).frame(maxWidth: .infinity)
                    }
                    .buttonStyle(PrimaryStyle())
                }
            }
        }.navigationTitle("Son nom")
    }
}

// MARK: - 5. Qui sert ?

/// Choix du serveur : un tap sélectionne, « Lancer le match » valide (plus de départ par erreur)
struct ServeChoice: View {
    @Binding var srv: Int?
    var body: some View {
        HStack(spacing: 8) {
            pick(0, "Moi")
            pick(1, "Lui")
        }
    }
    func pick(_ v: Int, _ t: String) -> some View {
        Button { srv = v; WKInterfaceDevice.current().play(.click) } label: {
            VStack(spacing: 2) {
                Text(t).font(.system(size: 18, weight: .heavy))
                Text(srv == v ? "sert" : " ").font(.system(size: 10.5, weight: .bold)).opacity(0.75)
            }
            // Pas choisi : les deux pareils (gris). Choisi : Moi en vert, Lui en orange (sa couleur dans les stats)
            .foregroundColor(srv == v ? (v == 0 ? .encre : terreInk) : .white)
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(srv == v ? (v == 0 ? Color.gazon : Color.terre) : Color.card)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }.buttonStyle(.plain)
    }
}

struct ServerView: View {
    let opp: WOpp
    @ObservedObject var d = Draft.shared
    @State private var srv: Int? = nil
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                // 4.7 (maquette validée) : Ace résume ce que l'iPhone sait déjà de l'adversaire
                PreMatchAce(opp: opp)
                Button { warm() } label: {
                    Label("Échauffement d'abord", systemImage: "figure.tennis").font(.system(size: 14, weight: .heavy))
                        .foregroundColor(.white).frame(maxWidth: .infinity, minHeight: 40)
                        .background(Color.card).clipShape(Capsule())
                }.buttonStyle(.plain)
                Text("Ou directement : qui sert ?").font(.system(size: 11.5, weight: .semibold)).foregroundColor(.secondary)
                ServeChoice(srv: $srv)
                Button { if let s = srv { start(s) } } label: {
                    Text("Lancer le match").font(.system(size: 15, weight: .heavy)).foregroundColor(.black).frame(maxWidth: .infinity)
                }
                .buttonStyle(PrimaryStyle())
                .disabled(srv == nil)
                .opacity(srv == nil ? 0.35 : 1)
                if (opp.plan ?? []).isEmpty, let t = opp.tip, !t.isEmpty { Quote(t: t) }
            }
        }
        .navigationTitle("C'est parti")
        .onAppear {
            if let h = opp.hom { d.hom = h }
        }
    }
    func start(_ s: Int) {
        let o = opp, h = d.hom
        Workout.shared.authorize { MatchVM.shared.begin(opp: o, hom: h, fmt: "?", srv0: s) }
    }
    func warm() {
        let o = opp, h = d.hom
        Workout.shared.authorize { MatchVM.shared.beginWarmup(opp: o, hom: h, fmt: "?") }
    }
}

/// 4.7 : ce que rapporte une victoire contre cet adversaire (calculé par l'iPhone), s'il s'agit bien du prochain match
func winPtsFor(_ name: String?) -> Int? {
    guard let w = PhoneLink.shared.ctx.winPts, let n = name else { return nil }
    let a = w.n.lowercased().trimmingCharacters(in: .whitespaces), b = n.lowercased().trimmingCharacters(in: .whitespaces)
    return !a.isEmpty && a == b ? w.g : nil
}

/// 4.7 : avant le match, Ace en 3 lignes : chances et face-à-face, la 1re consigne du plan, ce qu'une victoire rapporte
struct PreMatchAce: View {
    let opp: WOpp
    var body: some View {
        let step = (opp.plan ?? []).first { ($0.th ?? "") != "obj" && ($0.th ?? "") != "planb" }
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top, spacing: 7) {
                AceBall(mood: "concentree", size: 40, replay: true)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 4) {
                        Text(opp.name).font(.system(size: 14, weight: .heavy)).lineLimit(1)
                        if !opp.rank.isEmpty { RankTag(r: opp.rank, size: 12) }
                    }
                    if let p = opp.p { Text("Tes chances \(p) %").font(.system(size: 12, weight: .bold)).foregroundColor(.balle) }
                    if let v = opp.fv, let d = opp.fd, v + d > 0 { Text("Face-à-face \(v)-\(d)").font(.system(size: 11.5, weight: .semibold)).foregroundColor(.secondary) }
                }
            }
            if let st = step {
                VStack(alignment: .leading, spacing: 2) {
                    Eyebrow(t: "Ton plan")
                    Text(st.t).font(.system(size: 13.5, weight: .heavy)).fixedSize(horizontal: false, vertical: true)
                    if let sub = st.s, !sub.isEmpty { Text(sub).font(.system(size: 11, weight: .semibold)).foregroundColor(.secondary).fixedSize(horizontal: false, vertical: true) }
                }
                .padding(.horizontal, 10).padding(.vertical, 8).frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color.card))
            }
            if opp.hom != false, let g = winPtsFor(opp.name) {
                VStack(alignment: .leading, spacing: 2) {
                    Eyebrow(t: "Si tu gagnes", color: .secondary)
                    Text("+\(g) pts au bilan").font(.system(size: 14, weight: .heavy)).foregroundColor(.gazon)
                }
                .padding(.horizontal, 10).padding(.vertical, 8).frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color.card))
            }
        }
    }
}

/// Pendant l'échauffement : chrono, cardio, puis qui sert et on lance
struct WarmupView: View {
    @ObservedObject var vm = MatchVM.shared
    @ObservedObject var w = Workout.shared
    @State private var srv: Int? = nil
    @State private var askCancel = false
    var body: some View {
        let wu = vm.warmup
        ScrollView {
            VStack(alignment: .leading, spacing: 7) {
                if wu?.guided == true {
                    GuidedWarm(wu: wu, bpm: w.bpm)
                } else {
                Text("Échauffement").font(.system(size: 13, weight: .heavy)).foregroundColor(.balle)
                TimelineView(.periodic(from: .now, by: 1)) { c in
                    let s = Int(c.date.timeIntervalSince(wu?.t0 ?? c.date))
                    HStack(alignment: .firstTextBaseline) {
                        Text(String(format: "%d:%02d", s / 60, s % 60)).font(.system(size: 30, weight: .heavy)).monospacedDigit()
                        Spacer()
                        if w.bpm > 0 { Text("♥ \(Int(w.bpm))").font(.system(size: 14, weight: .bold)).foregroundColor(.red) }
                    }
                }
                }
                if !(wu?.opp.name ?? "").isEmpty {
                    Text("contre " + (wu?.opp.name ?? "")).font(.system(size: 11.5, weight: .semibold)).foregroundColor(.secondary).lineLimit(1)
                }
                Text("Qui sert ?").font(.system(size: 13, weight: .heavy)).padding(.top, 2)
                ServeChoice(srv: $srv)
                Button { go() } label: {
                    Text("Lancer le match").font(.system(size: 15, weight: .heavy)).foregroundColor(.black).frame(maxWidth: .infinity)
                }
                .buttonStyle(PrimaryStyle())
                .disabled(srv == nil)
                .opacity(srv == nil ? 0.35 : 1)
                Button("Annuler") { askCancel = true }.buttonStyle(Wide(fg: .secondary))
            }
        }
        .fullScreenCover(isPresented: $askCancel) {
            ConfirmScreen(title: "Annuler l'échauffement ?", note: "Rien ne sera enregistré.",
                          options: [ConfirmOption(t: "Annuler l'échauffement", bg: .terre, fg: terreInk) { vm.cancelWarmup() }], cancel: "Continuer")
        }
    }
    func go() {
        guard let s = srv, let wu = vm.warmup else { return }
        vm.begin(opp: wu.opp, hom: wu.hom, fmt: wu.fmt, srv0: s)
    }
}

/// 3.55 : échauffement guidé : l'étape, le temps qui reste, puis ta phrase du plan de jeu
struct GuidedWarm: View {
    let wu: WarmUp?
    let bpm: Double
    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { c in
            let e = Int(c.date.timeIntervalSince(wu?.t0 ?? c.date))
            let st = warmStep(e)
            VStack(alignment: .leading, spacing: 5) {
                if st.k < WARM_STEPS.count {
                    let x = WARM_STEPS[st.k]
                    Text("Étape \(st.k + 1) sur \(WARM_STEPS.count) · " + x.t).font(.system(size: 13, weight: .heavy)).foregroundColor(.balle).lineLimit(1)
                    HStack(alignment: .firstTextBaseline) {
                        Text(String(format: "%d:%02d", st.left / 60, st.left % 60)).font(.system(size: 30, weight: .heavy)).monospacedDigit()
                        Spacer()
                        if bpm > 0 { Text("♥ \(Int(bpm))").font(.system(size: 14, weight: .bold)).foregroundColor(.red) }
                    }
                    if st.k == WARM_STEPS.count - 1 { Quote(t: phrase) }
                    Text(x.s).font(.system(size: 11.5, weight: .semibold)).foregroundColor(.secondary).fixedSize(horizontal: false, vertical: true)
                } else {
                    Text("Prêt. À toi de jouer.").font(.system(size: 15, weight: .heavy)).foregroundColor(.balle)
                    Quote(t: phrase)
                }
            }
        }
    }
    var phrase: String {
        if let t = wu?.opp.plan?.first?.t, !t.isEmpty { return t }
        if let t = wu?.opp.tip, !t.isEmpty { return t }
        return "Premier jeu, première balle avec de la marge, et fais-le jouer."
    }
}

// MARK: - Pendant le match (3.34)
// Plus de pages à faire glisser : l'écran de score seul, ↶ en bas à gauche, ••• en bas à droite.
// Deux façons de compter : simple (boutons Moi / Lui) ou avancé (gestes ↓ toi, ↑ lui, ← faute, → ace).

struct MatchView: View {
    @ObservedObject var vm = MatchVM.shared
    var body: some View {
        let M = vm.state
        if M.winner != nil || vm.live?.forced != nil {
            EndView(M: M)
        } else if vm.needsThird {
            ThirdSetView(M: M)
        } else if vm.showChange {
            ChangeView(M: M)
        } else {
            ScoreView(M: M)
        }
    }
}

/// Taille commune des petits ronds du bas (↶, ta photo, •••)
let CORNER: CGFloat = 34

/// Petit bouton rond du bas de l'écran
struct CornerButton: View {
    let icon: String
    var enabled = true
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Image(systemName: icon).font(.system(size: 14, weight: .heavy))
                .foregroundColor(enabled ? .white : .secondary)
                .frame(width: CORNER, height: CORNER)
                .background(Circle().fill(Color.white.opacity(0.16)))
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
    }
}

/// Ta photo (envoyée par l'iPhone), sinon ton initiale dans un badge vert : même taille que les boutons
struct MePhoto: View {
    @ObservedObject var link = PhoneLink.shared
    var body: some View {
        Group {
            if let b = link.ctx.photo, let d = Data(base64Encoded: b), let img = UIImage(data: d) {
                Image(uiImage: img).resizable().scaledToFill()
            } else {
                Text(link.ctx.initial ?? String(link.ctx.name.prefix(1)).uppercased())
                    .font(.system(size: 15, weight: .heavy)).foregroundColor(.encre)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.gazon)
            }
        }
        .frame(width: CORNER, height: CORNER)
        .clipShape(Circle())
        .accessibilityHidden(true)
    }
}

/// Chevron horizontal (point pour lui en haut, point pour toi en bas)
struct HChevron: Shape {
    let up: Bool
    func path(in r: CGRect) -> Path {
        var p = Path()
        if up {
            p.move(to: CGPoint(x: r.minX, y: r.maxY)); p.addLine(to: CGPoint(x: r.midX, y: r.minY)); p.addLine(to: CGPoint(x: r.maxX, y: r.maxY))
        } else {
            p.move(to: CGPoint(x: r.minX, y: r.minY)); p.addLine(to: CGPoint(x: r.midX, y: r.maxY)); p.addLine(to: CGPoint(x: r.maxX, y: r.minY))
        }
        return p
    }
}
/// Chevron vertical (faute à gauche, ace à droite)
struct VChevron: Shape {
    let left: Bool
    func path(in r: CGRect) -> Path {
        var p = Path()
        if left {
            p.move(to: CGPoint(x: r.maxX, y: r.minY)); p.addLine(to: CGPoint(x: r.minX, y: r.midY)); p.addLine(to: CGPoint(x: r.maxX, y: r.maxY))
        } else {
            p.move(to: CGPoint(x: r.minX, y: r.minY)); p.addLine(to: CGPoint(x: r.maxX, y: r.midY)); p.addLine(to: CGPoint(x: r.minX, y: r.maxY))
        }
        return p
    }
}

/// Indication d'un côté : chevron + libellé vertical
struct SideHint: View {
    let text: String
    let color: Color
    let left: Bool
    var body: some View {
        HStack(spacing: 2) {
            if left { chevron }
            Text(text).font(.system(size: 9.5, weight: .heavy)).kerning(0.6).foregroundColor(color)
                .fixedSize().rotationEffect(.degrees(left ? -90 : 90)).frame(width: 12, height: 96)
            if !left { chevron }
        }
        .accessibilityHidden(true)
    }
    var chevron: some View { VChevron(left: left).stroke(color, style: StrokeStyle(lineWidth: 2.2, lineCap: .round, lineJoin: .round)).frame(width: 8, height: 92) }
}

struct ScoreView: View {
    let M: MatchState
    @ObservedObject var vm = MatchVM.shared
    @ObservedObject var d = Draft.shared
    @State private var menu = false
    var body: some View {
        VStack(spacing: 0) {
            if d.adv { AdvScore(M: M) } else { SimpleScore(M: M) }
            HStack {
                CornerButton(icon: "arrow.uturn.backward", enabled: !M.last.isEmpty) { vm.undo() }
                    .accessibilityLabel("Annuler le dernier point")
                Spacer()
                if d.adv { MePhoto() }
                Spacer()
                CornerButton(icon: "ellipsis") { menu = true }
                    .accessibilityLabel("Commandes du match")
            }
            .padding(.horizontal, 6)
        }
        .toolbar(.hidden, for: .navigationBar)
        .fullScreenCover(isPresented: $menu) { MatchMenu() }
    }
}

/// En-tête (3.36) : chrono à gauche, ♥ bpm à droite dans la couleur de la zone, « SUPER TB » au milieu
struct ScoreHeader: View {
    let M: MatchState
    @ObservedObject var vm = MatchVM.shared
    @ObservedObject var w = Workout.shared
    var body: some View {
        let b = Int(w.bpm.rounded())
        HStack(spacing: 4) {
            TimelineView(.periodic(from: .now, by: 1)) { c in
                Text(vm.elapsed(c.date)).font(.system(size: 13, weight: .heavy)).monospacedDigit()
            }
            .frame(width: 58, alignment: .leading)
            Spacer(minLength: 0)
            if let imp = M.importance, !imp.mine, !(M.inTB && M.superTB) {
                // 3.56 (maquette 9) : point important à sauver : le rappel tête et corps
                Text("RESPIRE").font(.system(size: 10, weight: .heavy)).kerning(0.4).foregroundColor(goalColor("tet"))
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(Capsule().fill(goalColor("tet").opacity(0.16)))
                    .fixedSize()
            }
            if M.inTB && M.superTB {
                Text("SUPER TB").font(.system(size: 10, weight: .heavy)).kerning(0.4).foregroundColor(.balle)
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(Capsule().fill(Color.balle.opacity(0.16)))
                    .fixedSize()
            }
            Spacer(minLength: 0)
            Text(b > 0 ? "♥ \(b)" : "♥ --").font(.system(size: 13, weight: .heavy)).monospacedDigit()
                .foregroundColor(b > 0 ? ZONE_COLORS[zoneOf(b, userThr(w.maxHR))] : .secondary)
                .frame(width: 58, alignment: .trailing)
        }
        .padding(.horizontal, 14)
    }
}

/// Une ligne du score : nom, sets, jeux, points (le point de pastille = qui sert)
struct ScoreLine: View {
    let M: MatchState
    let who: Int
    // 3.71 : le point glisse quand il change ; jeu gagné = le chiffre gonfle et la ligne s'éclaire (avec la vibration existante)
    @Environment(\.accessibilityReduceMotion) private var reduce
    @Environment(\.isLuminanceReduced) private var dim
    @State private var pop: CGFloat = 0
    var body: some View {
        let col: Color = who == 0 ? .gazon : .terre
        HStack(spacing: 7) {
            Text(who == 0 ? "TOI" : "LUI").font(.system(size: 10.5, weight: .heavy)).foregroundColor(col)
                .frame(width: 24, alignment: .trailing)
            ForEach(Array(M.sets.enumerated()), id: \.offset) { _, s in
                Text("\(who == 0 ? s.a : s.b)").font(.system(size: 15, weight: .heavy)).foregroundColor(.secondary)
            }
            if !M.inTB || !M.superTB { Text("\(M.games[who])").font(.system(size: 15, weight: .heavy)).scaleEffect(1 + 0.45 * pop) }
            Text(M.pointText(who)).font(.system(size: 30, weight: .heavy)).monospacedDigit()
                .contentTransition(.numericText())
                .animation(reduce || dim ? nil : .snappy(duration: 0.22), value: M.pointText(who))
                .frame(minWidth: 44)
            Circle().fill(Color.balle).frame(width: 7, height: 7).opacity(M.server == who ? 1 : 0)
        }
        .background(RoundedRectangle(cornerRadius: 12).fill(col.opacity(0.28 * pop)).padding(.horizontal, -6))
        .onChange(of: M.games[who]) { old, new in
            guard new > old, !reduce, !dim else { return }
            pop = 1
            withAnimation(.easeOut(duration: 0.4)) { pop = 0 }
        }
    }
}

/// Mode avancé : on glisse vers celui qui gagne le point ; faute à gauche, ace à droite
struct AdvScore: View {
    let M: MatchState
    @ObservedObject var vm = MatchVM.shared
    var body: some View {
        VStack(spacing: 2) {
            ScoreHeader(M: M)
            HChevron(up: true).stroke(Color.terre, style: StrokeStyle(lineWidth: 2.2, lineCap: .round, lineJoin: .round)).frame(width: 110, height: 9).padding(.top, 2)
            Text("POINT POUR LUI").font(.system(size: 9.5, weight: .heavy)).kerning(0.5).foregroundColor(.terre)
            Spacer(minLength: 4)
            ScoreLine(M: M, who: 1)
            ScoreLine(M: M, who: 0)
            Spacer(minLength: 4)
            Text("POINT POUR TOI").font(.system(size: 9.5, weight: .heavy)).kerning(0.5).foregroundColor(.gazon).padding(.top, 2)
            HChevron(up: false).stroke(Color.gazon, style: StrokeStyle(lineWidth: 2.2, lineCap: .round, lineJoin: .round)).frame(width: 110, height: 9)
                .padding(.bottom, 6) // 3.35 : de l'air avant la rangée ↶ / photo / •••
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .overlay(alignment: .leading) { SideHint(text: M.second ? "DOUBLE FAUTE" : "FAUTE", color: .terre, left: true) }
        .overlay(alignment: .trailing) { SideHint(text: "ACE", color: .balle, left: false) }
        .background(
            RadialGradient(colors: [Color.terre.opacity(M.second ? 0.24 : 0), .clear], center: .leading, startRadius: 0, endRadius: 120)
        )
        .contentShape(Rectangle())
        .gesture(
            DragGesture(minimumDistance: 18).onEnded { g in
                let dx = g.translation.width, dy = g.translation.height
                if abs(dy) >= abs(dx) {
                    vm.tap(dy > 0 ? .me : .him)              // ↓ toi (en bas), ↑ lui (en haut)
                } else if dx < 0 {
                    vm.tap(.fault)                            // ← faute (2e faute = double faute)
                } else {
                    vm.tap(.ace)                              // → ace / service gagnant : point au serveur
                }
            }
        )
        .accessibilityElement(children: .combine)
        .accessibilityAction(named: "Point pour toi") { vm.tap(.me) }
        .accessibilityAction(named: "Point pour lui") { vm.tap(.him) }
        .accessibilityAction(named: "Faute") { vm.tap(.fault) }
    }
}

/// Mode simple : le score et deux gros boutons Moi / Lui
struct SimpleScore: View {
    let M: MatchState
    @ObservedObject var vm = MatchVM.shared
    var body: some View {
        VStack(spacing: 5) {
            ScoreHeader(M: M)
            row(0)
            row(1)
            Spacer(minLength: 2)
            HStack(spacing: 6) {
                BigButton(t: "Moi", bg: .gazon, fg: .encre, height: 54) { vm.tap(.me) }
                BigButton(t: "Lui", bg: .terre, fg: terreInk, height: 54) { vm.tap(.him) }
            }
        }
    }
    func row(_ who: Int) -> some View {
        HStack(spacing: 8) {
            Text(who == 0 ? "Toi" : "Lui").font(.system(size: 14, weight: .bold))
            if M.server == who { Circle().fill(Color.balle).frame(width: 7, height: 7) }
            Spacer()
            ForEach(Array(M.sets.enumerated()), id: \.offset) { _, s in
                Text("\(who == 0 ? s.a : s.b)").font(.system(size: 17, weight: .heavy)).foregroundColor(.secondary)
            }
            if !M.inTB || !M.superTB { Text("\(M.games[who])").font(.system(size: 17, weight: .heavy)) }
            Text(M.pointText(who)).font(.system(size: 19, weight: .heavy))
                .foregroundColor(who == 0 ? .black : .white)
                .frame(minWidth: 38, minHeight: 27)
                .background(who == 0 ? Color.balle : Color.card)
                .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
        }
        .padding(.leading, 10).padding(.trailing, 4).padding(.vertical, 3)
        .background(Color.white.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

/// Une tuile de commande, même dessin que l'entraînement
struct CtrlTile: View {
    let icon: String
    var bg: Color = Color.white.opacity(0.16)
    var fg: Color = .white
    var height: CGFloat = 60
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Image(systemName: icon).font(.system(size: height > 50 ? 24 : 18, weight: .heavy)).foregroundColor(fg)
                .frame(maxWidth: .infinity, minHeight: height).background(bg)
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        }.buttonStyle(.plain)
    }
}

/// Le bouton ••• : les commandes du match, dans le style de l'entraînement
struct MatchMenu: View {
    @ObservedObject var vm = MatchVM.shared
    @ObservedObject var w = Workout.shared
    @ObservedObject var d = Draft.shared
    @Environment(\.dismiss) private var dismiss
    @State private var askEnd = false
    @State private var askCancel = false
    @State private var askServer = false
    @State private var showStats = false
    @State private var showMode = false
    @State private var showThird = false
    var body: some View {
        let M = vm.state
        ScrollView {
            // 3.36 : chaque tuile dit ce qu'elle fait ; le score en rappel ; les réglages en lignes en dessous
            VStack(spacing: 8) {
                Text(setsLine(M) + " · " + M.pointText(0) + "-" + M.pointText(1))
                    .font(.system(size: 11.5, weight: .heavy)).foregroundColor(.secondary).monospacedDigit()
                HStack(spacing: 8) {
                    MenuTile(icon: "xmark", t: "Abandon", bg: Color.terre.opacity(0.22), fg: .terre) { askCancel = true }
                    MenuTile(icon: vm.paused ? "play.fill" : "pause.fill", t: vm.paused ? "Reprendre" : "Pause",
                             s: vm.paused ? "chrono arrêté" : "stoppe le chrono") { vm.togglePause() }
                }
                HStack(spacing: 8) {
                    MenuTile(icon: "arrow.left.arrow.right", t: "Serveur", s: M.server == 0 ? "c'est toi" : "c'est lui") { askServer = true }
                    MenuTile(icon: "chart.bar.fill", t: "Stats") { showStats = true }
                }
                Button { askEnd = true } label: {
                    Label("Terminer", systemImage: "stop.fill").font(.system(size: 16, weight: .heavy)).foregroundColor(.balle)
                        .frame(maxWidth: .infinity, minHeight: 46).background(Color.balle.opacity(0.2))
                        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(Color.balle.opacity(0.45), lineWidth: 1))
                        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                }.buttonStyle(.plain)
                SectionLabel(t: "RÉGLAGES").frame(maxWidth: .infinity, alignment: .leading).padding(.top, 6)
                SettingRow(k: "Comptage", v: d.adv ? "Avancé" : "Simple") { showMode = true }
                if vm.thirdReached {
                    SettingRow(k: "3e set", v: vm.live?.fmt == "stb" ? "Super TB" : "Classique") { showThird = true }
                }
            }
            .padding(.top, 0) // 3.42.1 : les boutons remontent juste sous la croix
        }
        .fullScreenCover(isPresented: $askEnd) {
            ConfirmScreen(title: "Le match s'arrête", note: "Abandon, pluie… Tu as :",
                          options: [ConfirmOption(t: "Gagné", bg: .gazon, fg: .encre) { vm.stop(result: 0) },
                                    ConfirmOption(t: "Perdu", bg: .terre, fg: terreInk) { vm.stop(result: 1) }])
        }
        .fullScreenCover(isPresented: $askCancel) {
            ConfirmScreen(title: "Annuler ce match ?", note: "Rien ne sera enregistré.",
                          options: [ConfirmOption(t: "Annuler le match", bg: .terre, fg: terreInk) { vm.cancel() }], cancel: "Continuer")
        }
        .fullScreenCover(isPresented: $askServer) {
            // Confirmation : changer de serveur en plein match peut tout décaler
            let next = 1 - M.server
            ConfirmScreen(title: "Changer de serveur ?",
                          note: "Le score reste " + scoreNow(M) + ".\nC'est " + (next == 0 ? "toi" : "lui") + " qui servira ce jeu.",
                          options: [ConfirmOption(t: next == 0 ? "Oui, je sers" : "Oui, il sert", bg: .balle, fg: .black) { vm.switchServer() }])
        }
        .fullScreenCover(isPresented: $showStats) { StatsView(M: M) }
        .fullScreenCover(isPresented: $showMode) { ModeView() }
        .fullScreenCover(isPresented: $showThird) { ThirdSetView(M: M, editing: true) }
    }
    func setsLine(_ M: MatchState) -> String {
        let s = M.scoreText
        let g = "\(M.games[0])-\(M.games[1])"
        return s.isEmpty ? g : s + " · " + g
    }
    func scoreNow(_ M: MatchState) -> String {
        "\(M.games[0])-\(M.games[1]), " + M.pointText(0) + "-" + M.pointText(1)
    }
}

/// « Façon de compter » : simple ou avancé, en plein match, sans toucher au score
struct ModeView: View {
    @ObservedObject var d = Draft.shared
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Text("Façon de compter").font(.system(size: 15, weight: .heavy))
                ModeOption(icon: "hand.tap.fill", t: "Simple", s: "Boutons Moi / Lui", on: !d.adv) { d.adv = false; dismiss() }
                ModeOption(icon: "arrow.up.arrow.down", t: "Avancé", s: "Gestes · fautes et aces", on: d.adv) { d.adv = true; dismiss() }
                Text("Le score ne bouge pas. Les stats de service ne comptent qu'en avancé.")
                    .font(.system(size: 11, weight: .semibold)).foregroundColor(.secondary).multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

/// Une option de « Façon de compter » (aussi au lancement du match)
struct ModeOption: View {
    var icon: String? = nil
    let t: String
    let s: String
    let on: Bool
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 9) {
                if let i = icon {
                    Image(systemName: i).font(.system(size: 17, weight: .heavy)).foregroundColor(on ? .balle : .secondary).frame(width: 24)
                }
                VStack(alignment: .leading, spacing: 1) {
                    Text(t).font(.system(size: 15, weight: .heavy))
                    Text(s).font(.system(size: 11, weight: .bold)).foregroundColor(.secondary).fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 2)
                ZStack {
                    if on {
                        Circle().fill(Color.balle).frame(width: 20, height: 20)
                        Image(systemName: "checkmark").font(.system(size: 10, weight: .black)).foregroundColor(.black)
                    } else {
                        Circle().stroke(Color.white.opacity(0.25), lineWidth: 2).frame(width: 18, height: 18)
                    }
                }
            }
            .padding(.horizontal, 11).padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                ZStack {
                    Color.card
                    if on { RadialGradient(colors: [Color.balle.opacity(0.22), .clear], center: .topLeading, startRadius: 0, endRadius: 130) }
                }
            )
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(on ? Color.balle : .clear, lineWidth: 1.5))
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        }.buttonStyle(.plain)
    }
}

/// Petit titre de section, en capitales
struct SectionLabel: View {
    let t: String
    var body: some View {
        Text(t).font(.system(size: 10.5, weight: .heavy)).kerning(0.8).foregroundColor(.secondary).padding(.horizontal, 4)
    }
}

/// Deux choix côte à côte (Homologué / Libre)
struct Segmented: View {
    let a: String
    let b: String
    let first: Bool
    let pick: (Bool) -> Void
    var body: some View {
        HStack(spacing: 0) {
            seg(a, first) { pick(true) }
            seg(b, !first) { pick(false) }
        }
        .padding(3)
        .background(Capsule().fill(Color.card))
    }
    func seg(_ t: String, _ on: Bool, _ act: @escaping () -> Void) -> some View {
        Button(action: act) {
            Text(t).font(.system(size: 13, weight: .heavy)).foregroundColor(on ? .black : .secondary)
                .frame(maxWidth: .infinity, minHeight: 32)
                .background(Capsule().fill(on ? Color.white : .clear))
        }.buttonStyle(.plain)
    }
}

/// Une tuile du menu du match : icône + mot (+ petit état)
struct MenuTile: View {
    let icon: String
    let t: String
    var s: String? = nil
    var bg: Color = Color.white.opacity(0.10)
    var fg: Color = .white
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            VStack(spacing: 2) {
                Image(systemName: icon).font(.system(size: 18, weight: .heavy))
                Text(t).font(.system(size: 12.5, weight: .heavy)).lineLimit(1).minimumScaleFactor(0.8)
                if let s = s { Text(s).font(.system(size: 9.5, weight: .bold)).opacity(0.6).lineLimit(1).minimumScaleFactor(0.8) }
            }
            .foregroundColor(fg)
            .frame(maxWidth: .infinity, minHeight: 60)
            .background(bg)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        }.buttonStyle(.plain)
        .accessibilityLabel(t)
    }
}

/// Une ligne de réglage : libellé à gauche, valeur › à droite
struct SettingRow: View {
    let k: String
    let v: String
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack {
                Text(k).font(.system(size: 12.5, weight: .heavy)).foregroundColor(.secondary)
                Spacer()
                Text(v).font(.system(size: 13, weight: .heavy))
                Image(systemName: "chevron.right").font(.system(size: 11, weight: .heavy)).foregroundColor(.secondary)
            }
            .padding(.horizontal, 14).frame(minHeight: 44)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color.card))
        }.buttonStyle(.plain)
    }
}

/// 3.36 : à 1 set partout, le format du 3e (set classique par défaut). Aussi depuis le menu pour corriger.
struct ThirdSetView: View {
    let M: MatchState
    var editing = false
    @ObservedObject var vm = MatchVM.shared
    @Environment(\.dismiss) private var dismiss
    @State private var stb = false
    var body: some View {
        ScrollView {
            VStack(spacing: 7) {
                VStack(spacing: 1) {
                    Text(M.sets.prefix(2).map { "\($0.a)-\($0.b)" }.joined(separator: " · "))
                        .font(.system(size: 10.5, weight: .heavy)).kerning(0.6).foregroundColor(.secondary)
                    Text("1 set partout").font(.system(size: 19, weight: .heavy))
                    Text("Le 3e se joue comment ?").font(.system(size: 12, weight: .bold)).foregroundColor(.secondary)
                }
                ModeOption(icon: "rectangle.split.2x1", t: "Set classique", s: "Jeux, jusqu'à 6", on: !stb) { stb = false }
                ModeOption(icon: "bolt", t: "Super tie-break", s: "En 10 points", on: stb) { stb = true }
                Button {
                    vm.setThird(stb ? "stb" : "full")
                    if editing { dismiss() }
                } label: {
                    Text("Valider").font(.system(size: 16, weight: .heavy)).foregroundColor(.black).frame(maxWidth: .infinity)
                }
                .buttonStyle(PrimaryStyle(height: 48))
                if editing {
                    Text("Les points déjà joués dans le 3e sont recomptés dans le nouveau format.")
                        .font(.system(size: 10.5, weight: .semibold)).foregroundColor(.secondary).multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                } else if !M.last.isEmpty {
                    Button { vm.undo() } label: {
                        Label("Annuler le dernier point", systemImage: "arrow.uturn.backward")
                            .font(.system(size: 11.5, weight: .bold)).foregroundColor(.secondary)
                    }.buttonStyle(.plain)
                }
            }
        }
        .toolbar(editing ? .automatic : .hidden, for: .navigationBar)
        .onAppear { stb = vm.live?.fmt == "stb" }
    }
}

/// Toi à gauche, lui à droite (3.36) : chiffres collés aux bords, libellé au centre,
/// le meilleur en blanc, l'autre en gris, et une barre verte / orange qui penche vers celui qui fait mieux
struct DuelRows: View {
    let M: MatchState
    var body: some View {
        let a = M.stats[0], b = M.stats[1]
        VStack(spacing: 7) {
            HStack {
                Text("● TOI").foregroundColor(.gazon)
                Spacer()
                Text("LUI ●").foregroundColor(.terre)
            }
            .font(.system(size: 10, weight: .heavy)).kerning(0.6)
            row(pct(a.firstIn, a.pts), "1res balles", pct(b.firstIn, b.pts), rate(a.firstIn, a.pts), rate(b.firstIn, b.pts), true)
            row("\(a.df)", "doubles fautes", "\(b.df)", Double(a.df), Double(b.df), false)
            row(a.games > 0 ? "\(a.held)/\(a.games)" : "–", "jeux de service", b.games > 0 ? "\(b.held)/\(b.games)" : "–",
                rate(a.held, a.games), rate(b.held, b.games), true)
            if a.bpFaced + b.bpFaced > 0 {
                // Balles de break converties : les tiennes sur son service, les siennes sur le tien
                row(b.bpFaced > 0 ? "\(b.bpFaced - b.bpSaved)/\(b.bpFaced)" : "–", "balles de break",
                    a.bpFaced > 0 ? "\(a.bpFaced - a.bpSaved)/\(a.bpFaced)" : "–",
                    Double(b.bpFaced - b.bpSaved), Double(a.bpFaced - a.bpSaved), true)
            }
        }
    }
    func rate(_ x: Int, _ n: Int) -> Double? { n > 0 ? Double(x) / Double(n) : nil }
    func row(_ l: String, _ k: String, _ r: String, _ lv: Double?, _ rv: Double?, _ higher: Bool) -> some View {
        // Part de vert : 0,5 si égalité ou rien à comparer
        var share = 0.5
        if let x = lv, let y = rv, x + y > 0 { share = higher ? x / (x + y) : y / (x + y) }
        let better: Int? = (lv == nil || rv == nil || lv == rv) ? nil : ((higher ? lv! > rv! : lv! < rv!) ? 0 : 1)
        return VStack(spacing: 3) {
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(l).font(.system(size: 17, weight: .heavy)).monospacedDigit()
                    .foregroundColor(better == 1 ? .secondary : .white)
                    .frame(width: 50, alignment: .leading)
                Text(k).font(.system(size: 10.5, weight: .bold)).foregroundColor(.secondary)
                    .lineLimit(1).minimumScaleFactor(0.75).frame(maxWidth: .infinity)
                Text(r).font(.system(size: 17, weight: .heavy)).monospacedDigit()
                    .foregroundColor(better == 0 ? .secondary : .white)
                    .frame(width: 50, alignment: .trailing)
            }
            GeometryReader { g in
                HStack(spacing: 2) {
                    Capsule().fill(Color.gazon).frame(width: max(0, (g.size.width - 2) * share))
                    Capsule().fill(Color.terre)
                }
            }.frame(height: 4)
        }
    }
}

struct ChangeView: View {
    let M: MatchState
    @ObservedObject var vm = MatchVM.shared
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                Text(M.setBreak ? "FIN DU SET" : "CHANGEMENT DE CÔTÉ").font(.system(size: 10.5, weight: .heavy)).kerning(0.8).foregroundColor(.balle)
                TimelineView(.periodic(from: .now, by: 1)) { c in
                    let left = max(0, M.rest - Int(c.date.timeIntervalSince(vm.live?.changeAt ?? c.date)))
                    VStack(alignment: .leading, spacing: 5) {
                        HStack(alignment: .lastTextBaseline) {
                            Text(left > 0 ? String(format: "%d:%02d", left / 60, left % 60) : "C'est reparti")
                                .font(.system(size: left > 0 ? 40 : 24, weight: .heavy)).monospacedDigit()
                                .foregroundColor(left > 0 ? .white : .gazon)
                            Spacer(minLength: 4)
                            Text(scoreNow).font(.system(size: 13, weight: .heavy)).foregroundColor(.secondary).monospacedDigit()
                        }
                        if M.rest > 0 {
                            GeometryReader { g in
                                ZStack(alignment: .leading) {
                                    Capsule().fill(Color.white.opacity(0.12))
                                    Capsule().fill(left > 10 ? Color.gazon : Color.balle)
                                        .frame(width: g.size.width * CGFloat(left) / CGFloat(max(1, M.rest)))
                                }
                            }.frame(height: 6)
                        }
                    }
                }
                if let c = vm.cue(M) {
                    // 3.42 : une seule carte, choisie selon le score ou les chiffres du match
                    // 4.7 (maquette validée) : c'est Ace qui la dit, avec sa tête du moment ; carte neutre, la couleur en accent
                    HStack(alignment: .top, spacing: 7) {
                        AceBall(mood: cueMood(c), size: 38, replay: true)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(c.fromWatch ? "CE QUE DIT TA MONTRE" : "MAINTENANT").font(.system(size: 9.5, weight: .heavy)).kerning(0.6)
                                .foregroundColor(c.fromWatch ? .gazon : .balle)
                            Text(c.t).font(.system(size: 16, weight: .heavy)).fixedSize(horizontal: false, vertical: true)
                            if !c.s.isEmpty { Text(c.s).font(.system(size: 11.5, weight: .semibold)).foregroundColor(Color(white: 0.8)).fixedSize(horizontal: false, vertical: true) }
                        }
                    }
                    .padding(.vertical, 9).padding(.leading, 6).padding(.trailing, 10).frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Color.card))
                }
                // 3.47 (retour testeur) : les 3 consignes de ton plan, toujours sous les yeux au changement de côté
                if let plan = vm.live?.plan, !plan.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("TON PLAN").font(.system(size: 10, weight: .heavy)).kerning(0.8).foregroundColor(.secondary)
                        ForEach(Array(plan.filter { ($0.th ?? "") != "obj" && ($0.th ?? "") != "planb" }.prefix(3).enumerated()), id: \.offset) { i, st in
                            HStack(alignment: .firstTextBaseline, spacing: 6) {
                                Text("\(i + 1)").font(.system(size: 11, weight: .heavy)).foregroundColor(.black)
                                    .frame(width: 18, height: 18).background(Circle().fill(Color.balle))
                                Text(st.t).font(.system(size: 13.5, weight: .bold)).fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                    .padding(10).frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color.card))
                }
                DuelRows(M: M)
                if vm.cue(M) == nil, (vm.live?.plan ?? []).isEmpty, let t = changeLine(M) { Quote(t: t) }
                Button { vm.dismissChange() } label: {
                    Text("Reprendre").font(.system(size: 16, weight: .heavy)).foregroundColor(.black).frame(maxWidth: .infinity)
                }
                .buttonStyle(PrimaryStyle(height: 46))
                // 3.47 (retour testeur) : un point donné par erreur juste avant le changement de côté se corrige ici
                Button { vm.undo() } label: {
                    Label("Annuler le dernier point", systemImage: "arrow.uturn.backward").font(.system(size: 13, weight: .bold)).frame(maxWidth: .infinity)
                }
                .buttonStyle(Wide(fg: .secondary))
            }
        }
    }
    /// « 6-4 · 2-1 » : sets terminés puis jeux en cours
    var scoreNow: String {
        var parts = M.sets.map { "\($0.a)-\($0.b)" }
        if M.games[0] + M.games[1] > 0 || parts.isEmpty { parts.append("\(M.games[0])-\(M.games[1])") }
        return parts.joined(separator: " · ")
    }
}

struct StatsView: View {
    let M: MatchState
    @ObservedObject var w = Workout.shared
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                Text("Au service").font(.system(size: 13, weight: .heavy)).foregroundColor(.balle)
                DuelRows(M: M)
                if w.avg > 0 {
                    Text("Cardio moyen \(Int(w.avg)) · max \(Int(w.maxBpm))").font(.system(size: 12, weight: .semibold)).foregroundColor(.secondary)
                }
                if w.kcal > 0 { Text("\(Int(w.kcal)) kcal").font(.system(size: 12, weight: .semibold)).foregroundColor(.secondary) }
            }
        }
    }
}

// MARK: - Fin du match

/// 3.71 : l'anneau de victoire se ferme puis la coche se trace (en même temps que la double vibration « succès »)
struct VictoryMark: View {
    @Environment(\.accessibilityReduceMotion) private var reduce
    @State private var ring: CGFloat = 1
    @State private var tick: CGFloat = 1
    var body: some View {
        ZStack {
            Circle().stroke(Color.gazon.opacity(0.2), lineWidth: 4)
            Circle().trim(from: 0, to: ring).stroke(Color.gazon, style: StrokeStyle(lineWidth: 4, lineCap: .round)).rotationEffect(.degrees(-90))
            Path { p in p.move(to: CGPoint(x: 9, y: 17)); p.addLine(to: CGPoint(x: 14, y: 22)); p.addLine(to: CGPoint(x: 24, y: 11)) }
                .trim(from: 0, to: tick).stroke(Color.gazon, style: StrokeStyle(lineWidth: 3.5, lineCap: .round, lineJoin: .round))
        }
        .frame(width: 33, height: 33)
        .accessibilityHidden(true)
        .onAppear {
            guard !reduce else { return }
            ring = 0; tick = 0
            withAnimation(.easeOut(duration: 0.6)) { ring = 1 }
            withAnimation(.easeOut(duration: 0.3).delay(0.45)) { tick = 1 }
        }
    }
}

struct EndView: View {
    let M: MatchState
    @ObservedObject var vm = MatchVM.shared
    @ObservedObject var w = Workout.shared
    var won: Bool { (vm.live?.forced ?? M.winner ?? 0) == 0 }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 8) {
                    if won { VictoryMark() }
                    Text(won ? "Victoire" : "Défaite").font(.system(size: won ? 17 : 13, weight: .heavy)).foregroundColor(won ? .balle : .terre)
                }
                Text(scoreLine).font(.system(size: 24, weight: .heavy)).minimumScaleFactor(0.6).lineLimit(1)
                Text("contre " + (vm.live?.name ?? "")).font(.system(size: 12, weight: .semibold)).foregroundColor(.secondary).lineLimit(1)
                // 4.7 (maquette validée) : Ace réagit (rire ou rebond) et dit ce que le résultat change
                HStack(alignment: .top, spacing: 7) {
                    AceBall(mood: won ? "rire" : "rebond", size: 36, replay: true)
                    Text(aceEnd).font(.system(size: 12, weight: .bold)).fixedSize(horizontal: false, vertical: true)
                }
                .padding(.vertical, 6).padding(.leading, 5).padding(.trailing, 9).frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color.card))
                kv("Durée" + (w.avg > 0 ? " · cardio" : ""), vm.elapsed() + (w.avg > 0 ? " · \(Int(w.avg))" : ""))
                let me = M.stats[0], him = M.stats[1]
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 6), GridItem(.flexible(), spacing: 6)], spacing: 6) {
                    if him.bpFaced > 0 { StatTile(k: "Balles de break", v: "\(him.bpFaced - him.bpSaved)/\(him.bpFaced) gagnées", color: .balle) }
                    if me.bpFaced > 0 { StatTile(k: "À sauver", v: "\(me.bpSaved)/\(me.bpFaced) sauvées", color: .gazon) }
                    StatTile(k: "1res balles", v: pct(me.firstIn, me.pts))
                    StatTile(k: "Doubles fautes", v: "\(me.df)")
                }
                if vm.live?.sent == true {
                    Text("✓ Envoyé à l'iPhone · séance Tennis enregistrée").font(.system(size: 12, weight: .bold)).foregroundColor(.gazon)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(vm.live?.hom == false ? "Match libre : sans effet sur le classement." : "Le résumé t'attend sur ton iPhone.")
                        .font(.system(size: 11)).foregroundColor(.secondary).fixedSize(horizontal: false, vertical: true)
                    Button("Fermer") { vm.close() }.buttonStyle(Wide())
                } else {
                    Button { vm.finish() } label: {
                        Text("Enregistrer").font(.system(size: 15, weight: .heavy)).foregroundColor(.black).frame(maxWidth: .infinity)
                    }
                    .buttonStyle(PrimaryStyle())
                    Button { vm.undo() } label: {
                        Label("Annuler le dernier point", systemImage: "arrow.uturn.backward")
                    }.buttonStyle(Wide())
                }
            }
        }
    }
    /// La phrase d'Ace en fin de match : les points (calcul de l'iPhone) si c'est le match prévu, sinon le chiffre qui a compté
    var aceEnd: String {
        let me = M.stats[0], him = M.stats[1]
        let free = vm.live?.hom == false
        if won {
            if !free, let g = winPtsFor(vm.live?.name) { return "Bien joué ! +\(g) pts au bilan quand Ten'Up aura le résultat." }
            if him.bpFaced > 0, him.bpFaced - him.bpSaved >= 2 { return "Bien joué ! \(him.bpFaced - him.bpSaved) breaks : ton retour a fait la différence." }
            return "Bien joué ! Le résumé t'attend sur ton iPhone."
        }
        if me.games >= 3, me.held * 10 >= me.games * 6 { return "Dur. Ce qu'on garde : ton service a tenu (\(me.held) jeux sur \(me.games)). On repart." }
        if me.pts >= 12, me.firstIn * 100 >= me.pts * 60 { return "Dur. Ce qu'on garde : \(me.firstIn * 100 / max(1, me.pts)) % de 1res balles. On repart." }
        return "Dur. On regarde ça ensemble sur ton iPhone, et on repart."
    }
    var scoreLine: String {
        var s = M.scoreText
        if vm.live?.forced != nil && (M.games[0] + M.games[1]) > 0 { s += (s.isEmpty ? "" : " ") + "\(M.games[0])-\(M.games[1])" }
        return s.isEmpty ? "–" : s
    }
    func kv(_ k: String, _ v: String) -> some View {
        HStack { Text(k).foregroundColor(.secondary); Spacer(); Text(v).fontWeight(.bold) }.font(.system(size: 12.5))
    }
}


// MARK: - 3.46.5 : « À venir » et « Tes copains »

/// Une ligne de l'accueil : icône, titre, aperçu
struct HomeLine: View {
    let icon: String; let t: String; let s: String
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: icon).font(.system(size: 14, weight: .bold)).foregroundColor(.balle).frame(width: 28, height: 28).background(Color.balle.opacity(0.18)).clipShape(Circle())
            VStack(alignment: .leading, spacing: 1) {
                Text(t).font(.system(size: 14, weight: .heavy))
                Text(s).font(.system(size: 11, weight: .semibold)).foregroundColor(.secondary).lineLimit(1)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.system(size: 11, weight: .bold)).foregroundColor(.secondary)
        }
        .padding(.horizontal, 10).padding(.vertical, 8)
        .background(RoundedRectangle(cornerRadius: 14).fill(Color.card))
    }
}

/// Les 3 prochains matchs ou événements ; toucher un match lance le mode match contre cet adversaire
struct AVenirView: View {
    @ObservedObject var link = PhoneLink.shared
    func opp(_ x: WCal) -> WOpp? { guard let id = x.oid, !id.isEmpty else { return nil }; return link.ctx.opps.first { $0.id == id } }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 6) {
                ForEach(link.ctx.cal ?? [], id: \.self) { x in
                    if let o = opp(x) {
                        NavigationLink { if link.canPlay { ServerView(opp: o) } else { PlusView() } } label: { CalRow(x: x, play: true) }.buttonStyle(.plain)
                    } else {
                        CalRow(x: x, play: false)
                    }
                }
            }
        }.navigationTitle("À venir")
    }
}
struct CalRow: View {
    let x: WCal; let play: Bool
    var body: some View {
        HStack(alignment: .center, spacing: 8) {
            VStack(spacing: 0) {
                Text(x.d).font(.system(size: 18, weight: .heavy))
                Text(x.w).font(.system(size: 9, weight: .heavy)).foregroundColor(.secondary)
            }.frame(width: 34)
            VStack(alignment: .leading, spacing: 1) {
                Text(x.t).font(.system(size: 13, weight: .bold)).lineLimit(2)
                if let s = x.s, !s.isEmpty { Text(s).font(.system(size: 10.5, weight: .semibold)).foregroundColor(.secondary).lineLimit(1) }
                if let st = x.st { Text(st).font(.system(size: 11, weight: .heavy)).foregroundColor(.gazon) }
            }
            Spacer(minLength: 0)
            if play { Image(systemName: "play.circle.fill").font(.system(size: 20)).foregroundColor(.balle) }
        }
        .padding(8).background(RoundedRectangle(cornerRadius: 12).fill(Color.card))
    }
}
/// Les joueurs suivis : classement et ce qui a bougé
struct CopainsView: View {
    @ObservedObject var link = PhoneLink.shared
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 6) {
                ForEach(link.ctx.fol ?? [], id: \.self) { f in
                    HStack(spacing: 8) {
                        Text(String(f.n.split(separator: " ").compactMap { $0.first }.prefix(2))).font(.system(size: 11, weight: .heavy))
                            .frame(width: 28, height: 28).background(Color.card.opacity(0.9)).clipShape(Circle())
                        VStack(alignment: .leading, spacing: 1) {
                            Text(f.n).font(.system(size: 13, weight: .bold)).lineLimit(1)
                            Text(f.s).font(.system(size: 10.5, weight: .semibold)).foregroundColor(.secondary).lineLimit(2)
                        }
                        Spacer(minLength: 0)
                        Text(((f.up ?? 0) > 0 ? "↗ " : (f.up ?? 0) < 0 ? "↘ " : "") + f.r).font(.system(size: 12, weight: .heavy))
                            .foregroundColor((f.up ?? 0) > 0 ? .gazon : (f.up ?? 0) < 0 ? .terre : .primary)
                    }
                    .padding(8).background(RoundedRectangle(cornerRadius: 12).fill(Color.card))
                }
            }
        }.navigationTitle("Tes copains")
    }
}


/// 3.56 : couleur d'une catégorie d'objectif (les mêmes que le profil du compétiteur sur l'iPhone)
func goalColor(_ k: String?) -> Color {
    switch k ?? "" {
    case "sol": return Color(red: 0.91, green: 0.54, blue: 0.37)   // solidité
    case "cor": return Color(red: 0.30, green: 0.79, blue: 0.75)   // endurance
    case "tet": return Color(red: 0.66, green: 0.55, blue: 1.0)    // mental
    default: return Color(red: 0.95, green: 0.76, blue: 0.31)      // tactique
    }
}

/// Ace : joue son humeur une fois par lancement (pas en boucle), pose finale directe si « Réduire les animations » ou poignet baissé.
/// 4.7 (Yann : « bien animé ») : ensuite il vit un peu tant que l'écran est allumé (respiration, clignement, regard), tout s'arrête poignet baissé.
/// `replay` : le moment se rejoue à chaque apparition (moments du match, fin de séance), pas une seule fois par lancement.
struct AceBall: View {
    var mood: String = "repos"
    var size: CGFloat = 40
    var replay: Bool = false
    var live: Bool = true
    static var played = Set<String>()
    @Environment(\.accessibilityReduceMotion) private var reduce
    @Environment(\.isLuminanceReduced) private var dim
    @State private var t0: Date? = nil
    var dur: Double { mood == "rebond" || mood == "fier" ? 1.9 : mood == "parle" ? 2.2 : 1.6 }
    var alive: Bool { live && !reduce && !dim }

    func pose(at d: Date) -> AcePose {
        let end = AceMoves.end(mood)
        if let s = t0 {
            let u = min(1, d.timeIntervalSince(s) / dur)
            let full = mood == "repos" || mood == "joie"
            return AceMoves.pose(mood, full ? u : u * end)
        }
        var p = AceMoves.pose(mood == "parle" ? "repos" : mood, mood == "parle" ? 0 : end)
        guard alive else { return p }
        // la petite vie : respiration lente, un clignement toutes les 4 s environ, le regard qui bouge doucement
        let t = d.timeIntervalSinceReferenceDate
        let br = sin(t / 0.65) * 0.014
        p.sy *= 1 + br; p.sx *= 1 - br * 0.6; p.y -= max(0, br) * 60
        let ph = t.truncatingRemainder(dividingBy: 4.3)
        if ph < 0.14 { p.open = min(p.open, max(0.08, abs(1 - ph / 0.07))) }
        let g = sin(t / 2.7) * 3
        p.lx += g; p.fx += g * 0.4
        return p
    }

    func start() {
        guard !reduce, !dim else { return }
        if !replay { guard !AceBall.played.contains(mood) else { return }; AceBall.played.insert(mood) }
        let s = Date(); t0 = s
        DispatchQueue.main.asyncAfter(deadline: .now() + dur + 0.1) { if t0 == s { t0 = nil } }
    }

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / (t0 == nil ? 20 : 30), paused: t0 == nil && !alive)) { tl in
            let p = pose(at: tl.date)
            Canvas { g, sz in AceDraw.draw(g, sz, p) }
        }
        .frame(width: size, height: size * 1.1)
        .accessibilityHidden(true)
        .onAppear { start() }
        .onChange(of: mood) { _, _ in start() }
    }
}

/// 4.7 : la tête d'Ace selon la consigne du changement de côté (set perdu : il s'écrase puis rebondit)
func cueMood(_ c: Cue) -> String {
    switch c.id {
    case "set-lost": return "rebond"
    case "set-won": return "joie"
    case "m-won", "s-strong": return "fier"
    case "m-lost", "m-sfs", "m-rfs": return "concentree"
    default: return c.fromWatch ? "parle" : "concentree"
    }
}

/// La phrase d'Ace sur l'accueil (remplace les lignes grises) ; toucher ouvre sa réponse en cartes
struct AceLine: View {
    let a: WAce
    var body: some View {
        HStack(alignment: .center, spacing: 8) {
            AceBall(mood: a.m ?? "repos", size: 34)
            Text(a.t).font(.system(size: 13, weight: .bold)).lineLimit(3).minimumScaleFactor(0.85)
                .frame(maxWidth: .infinity, alignment: .leading)
            Image(systemName: "chevron.right").font(.system(size: 11, weight: .bold)).foregroundColor(.secondary)
        }
        .padding(.horizontal, 10).padding(.vertical, 7)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color.card))
    }
}

/// Petit titre de carte en capitales (couleur d'accent)
struct Eyebrow: View {
    let t: String
    var color: Color = .balle
    var body: some View {
        Text(t.uppercased()).font(.system(size: 10, weight: .heavy)).kerning(0.6).foregroundColor(color).lineLimit(1)
    }
}

/// Classement avec la petite balle jaune devant
struct RankTag: View {
    let r: String
    var size: CGFloat = 12
    var body: some View {
        HStack(spacing: 3) {
            Circle().fill(Color.balle).frame(width: size * 0.55, height: size * 0.55)
            Text(r).font(.system(size: size, weight: .heavy))
        }
    }
}

/// 4.7 (maquettes validées par Yann le 25/11) : la conversation avec Ace. Ses questions du moment en tuiles,
/// comme sur l'iPhone, et ses réponses toutes prêtes (calculées par l'iPhone : mêmes chiffres). Pas de micro.
struct AceDetail: View {
    @ObservedObject var link = PhoneLink.shared
    var body: some View {
        let c = link.ctx
        let qs = c.aceQs ?? []
        ScrollView {
            VStack(alignment: .leading, spacing: 7) {
                HStack(alignment: .top, spacing: 8) {
                    AceBall(mood: c.ace?.m ?? "joie", size: 44)
                    Text(c.ace?.t.isEmpty == false ? c.ace!.t : "Salut ! Tu veux savoir quoi ?")
                        .font(.system(size: 13, weight: .bold)).fixedSize(horizontal: false, vertical: true)
                }
                if qs.isEmpty {
                    AceLegacyCards()
                } else {
                    ForEach(qs) { q in AceTileLink(q: q) }
                }
                Text("Le détail complet est dans Montée, sur ton iPhone.").font(.system(size: 10.5, weight: .semibold)).foregroundColor(.secondary)
            }
        }.containerBackground(appGradient, for: .navigation)
    }
}

/// Picto et couleur d'une tuile (mêmes repères que les tuiles d'Ace sur l'iPhone)
func aceTileLook(_ q: WAceQ) -> (String, Color) {
    switch q.ic ?? "" {
    case "versus", "li": return ("calendar", Color(red: 0.56, green: 0.66, blue: 1))
    case "po", "to": return ("trophy.fill", Color(red: 0.56, green: 0.66, blue: 1))
    case "chart": return ("arrow.up", .balle)
    case "so": return ("rectangle.portrait.and.arrow.right", .terre)
    case "check": return ("checkmark", .gazon)
    case "back": return ("arrow.uturn.backward", .terre)
    case "spark": return ("chart.line.uptrend.xyaxis", .gazon)
    case "user": return ("person.fill", Color(red: 0.79, green: 0.65, blue: 1))
    case "warn": return ("exclamationmark.triangle.fill", .terre)
    case "edit": return ("pencil", .gazon)
    case "book": return ("book.fill", Color(red: 0.56, green: 0.66, blue: 1))
    case "heart": return ("heart.fill", .balle)
    case "info": return ("eye.fill", Color(red: 0.79, green: 0.65, blue: 1))
    default: return ("target", Color(red: 0.79, green: 0.65, blue: 1))
    }
}

func aceTone(_ k: String?) -> Color {
    switch k ?? "" { case "g": return .gazon; case "y": return .balle; case "r": return .terre; default: return .white }
}

/// Une tuile : picto teinté, titre, chiffre clé (flouté si Montée+ fermé, avec le « + » jaune)
struct AceTile: View {
    let q: WAceQ
    var body: some View {
        let lk = aceTileLook(q)
        HStack(spacing: 8) {
            Image(systemName: lk.0).font(.system(size: 12, weight: .heavy)).foregroundColor(lk.1)
                .frame(width: 28, height: 28).background(Circle().fill(lk.1.opacity(0.16)))
            VStack(alignment: .leading, spacing: 1) {
                Text(q.t).font(.system(size: 12.5, weight: .heavy)).lineLimit(2)
                if let v = q.v, !v.isEmpty {
                    Text(v).font(.system(size: 11, weight: .bold)).foregroundColor(lk.1).lineLimit(1)
                        .blur(radius: q.lk == true ? 3.5 : 0)
                }
            }
            Spacer(minLength: 0)
            if q.pl == true { Text("+").font(.system(size: 12, weight: .black)).foregroundColor(.balle) }
        }
        .padding(.vertical, 7).padding(.leading, 7).padding(.trailing, 9)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color.card))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(q.lk == true ? q.t + ", Montée+" : q.t + (q.v.map { ", " + $0 } ?? ""))
    }
}

struct AceTileLink: View {
    let q: WAceQ
    var body: some View {
        NavigationLink { if q.lk == true { AcePlusView() } else { AceAnswer(q: q) } } label: { AceTile(q: q) }.buttonStyle(.plain)
    }
}

/// La réponse : ta question dans une bulle jaune, Ace et sa phrase, 2 ou 3 cartes, puis 2 autres questions
struct AceAnswer: View {
    let q: WAceQ
    @ObservedObject var link = PhoneLink.shared
    var body: some View {
        let others = (link.ctx.aceQs ?? []).filter { $0.id != q.id && $0.lk != true }.prefix(2)
        let a = q.a ?? []
        ScrollView {
            VStack(alignment: .leading, spacing: 7) {
                HStack {
                    Spacer(minLength: 24)
                    Text(q.q).font(.system(size: 12, weight: .heavy)).foregroundColor(Color(red: 0.08, green: 0.09, blue: 0.06))
                        .padding(.horizontal, 9).padding(.vertical, 6)
                        .background(UnevenRoundedRectangle(topLeadingRadius: 14, bottomLeadingRadius: 14, bottomTrailingRadius: 4, topTrailingRadius: 14, style: .continuous).fill(Color.balle))
                }
                HStack(alignment: .top, spacing: 8) {
                    AceBall(mood: q.m ?? "repos", size: 40, replay: true)
                    Text(a.first ?? "Ouvre Montée sur ton iPhone : je te prépare la réponse.").font(.system(size: 13, weight: .bold)).fixedSize(horizontal: false, vertical: true)
                }
                if a.count > 1 { Text(a[1]).font(.system(size: 11.5, weight: .semibold)).foregroundColor(Color(white: 0.8)).fixedSize(horizontal: false, vertical: true) }
                ForEach(Array((q.k ?? []).enumerated()), id: \.offset) { _, k in AceCardView(k: k) }
                if !others.isEmpty {
                    Text("Et ensuite ?").font(.system(size: 12.5, weight: .heavy)).foregroundColor(.secondary).padding(.leading, 4).padding(.top, 2)
                    ForEach(Array(others)) { o in AceTileLink(q: o) }
                }
                Text("Le détail complet est dans Montée, sur ton iPhone.").font(.system(size: 10.5, weight: .semibold)).foregroundColor(.secondary)
            }
        }.containerBackground(appGradient, for: .navigation)
    }
}

/// Une carte de réponse : en-tête, grand chiffre et sa ligne, puis les lignes (classement avec la balle jaune)
struct AceCardView: View {
    let k: WAceCard
    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            if let h = k.h, !h.isEmpty { Eyebrow(t: h) }
            if let b = k.b, !b.isEmpty { Text(b).font(.system(size: 22, weight: .heavy)).foregroundColor(aceTone(k.bc)).lineLimit(1).minimumScaleFactor(0.6) }
            if let l = k.l, !l.isEmpty { Text(l).font(.system(size: 11, weight: .semibold)).foregroundColor(.secondary).fixedSize(horizontal: false, vertical: true) }
            ForEach(Array((k.r ?? []).enumerated()), id: \.offset) { _, r in
                HStack(alignment: .center, spacing: 6) {
                    VStack(alignment: .leading, spacing: 1) {
                        HStack(spacing: 4) {
                            Text(r.l ?? "").font(.system(size: 12, weight: .heavy)).lineLimit(2)
                            if let rk = r.rk, !rk.isEmpty { RankTag(r: rk, size: 11) }
                        }
                        if let sv = r.s, !sv.isEmpty { Text(sv).font(.system(size: 10.5, weight: .semibold)).foregroundColor(.secondary).lineLimit(2) }
                    }
                    Spacer(minLength: 2)
                    if let v = r.v, !v.isEmpty { Text(v).font(.system(size: 13, weight: .heavy)).foregroundColor(aceTone(r.c)) }
                }.padding(.top, 2)
            }
        }
        .padding(.horizontal, 10).padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color.card))
    }
}

/// Une réponse Montée+ fermée : le titre se lit, la réponse s'ouvre avec l'abonnement (comme sur l'iPhone)
struct AcePlusView: View {
    @ObservedObject var link = PhoneLink.shared
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .top, spacing: 8) {
                    AceBall(mood: "joie", size: 40)
                    Text("Cette réponse est dans Montée+.").font(.system(size: 13, weight: .bold)).fixedSize(horizontal: false, vertical: true)
                }
                Text("Abonne-toi dans Montée sur ton iPhone : menu › Montée+. Un mois d'essai offert.")
                    .font(.system(size: 12)).foregroundColor(.secondary).fixedSize(horizontal: false, vertical: true)
                Button("Déjà abonné ? Vérifier") { Task { await link.checkStore() } }.font(.system(size: 13, weight: .bold))
            }
        }.containerBackground(appGradient, for: .navigation)
    }
}

/// Avant la 4.7 (iPhone pas encore à jour, pas de questions reçues) : les deux cartes fixes d'avant
struct AceLegacyCards: View {
    @ObservedObject var link = PhoneLink.shared
    var body: some View {
        let c = link.ctx
            VStack(alignment: .leading, spacing: 8) {
                if !c.next.isEmpty, let g = c.gap {
                    Glass {
                        VStack(alignment: .leading, spacing: 3) {
                            Eyebrow(t: "Pour " + c.next)
                            Text(g > 0 ? "\(g) pts" : "Tu as les points").font(.system(size: 22, weight: .heavy))
                            BallBar(value: Double(c.pct ?? 0) / 100)
                            if !c.short.isEmpty { Text(c.short).font(.system(size: 11.5, weight: .semibold)).foregroundColor(.secondary).fixedSize(horizontal: false, vertical: true) }
                        }
                    }
                }
                if let nx = c.nextOpp, !nx.when.isEmpty {
                    NavigationLink { OppDetail(nx: nx) } label: {
                        Glass {
                            VStack(alignment: .leading, spacing: 3) {
                                Eyebrow(t: "Ton prochain match · " + nx.when)
                                Text(nx.name).font(.system(size: 15, weight: .heavy)).lineLimit(1)
                                HStack(spacing: 6) {
                                    if !nx.rank.isEmpty { RankTag(r: nx.rank, size: 11.5) }
                                    if let p = nx.p { Text("· tes chances \(p) %").font(.system(size: 11.5, weight: .bold)).foregroundColor(.secondary) }
                                }
                            }
                        }
                    }.buttonStyle(.plain)
                } else {
                    Glass {
                        VStack(alignment: .leading, spacing: 3) {
                            Eyebrow(t: "Ton prochain match", color: .secondary)
                            Text("Pas encore prévu").font(.system(size: 14, weight: .heavy))
                            Text("Ajoute-le sur l'iPhone").font(.system(size: 11.5, weight: .semibold)).foregroundColor(.secondary)
                        }
                    }
                }
            }
    }
}

/// Un billet de « Ce qui arrive » : en-tête (jour ou sorte), titre, détail, enjeu
struct CalTicket: View {
    let x: WCal
    let play: Bool
    var head: String {
        let day = x.w + " " + x.d
        if let e = x.e, !e.isEmpty { return e + " · " + day }
        return day
    }
    /// Le détail sans l'en-tête (déjà en haut du billet)
    var sub: String {
        let s = x.s ?? ""
        guard let e = x.e, !e.isEmpty else { return s }
        if s == e { return "" }
        if s.hasPrefix(e + " · ") { return String(s.dropFirst(e.count + 3)) }
        return s
    }
    var body: some View {
        HStack(alignment: .center, spacing: 6) {
            VStack(alignment: .leading, spacing: 1) {
                // 4.2.6 (identité, maquette validée) : dates en bleu dur, badge presque gagné en jaune balle (sans contour),
                // balle devant le classement, points en vert gazon et chances en bleu
                Eyebrow(t: x.k == "badge" ? (x.e ?? head) : head, color: x.k == "badge" || x.k == "rel" ? .balle : .bleuDur)
                CalTitle(t: x.t)
                if !sub.isEmpty { Text(sub).font(.system(size: 10.5, weight: .semibold)).foregroundColor(.secondary).lineLimit(1) }
                if let st = x.st, !st.isEmpty { StakeLine(st: st) }
            }
            Spacer(minLength: 0)
            if play { Image(systemName: "play.circle.fill").font(.system(size: 20)).foregroundColor(.balle) }
        }
        .padding(.horizontal, 10).padding(.vertical, 8)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color.card))
    }
}

/// 4.2.6 : titre d'un billet, avec la petite balle devant un classement final (« Un 15/4 »)
struct CalTitle: View {
    let t: String
    var body: some View {
        let parts = t.split(separator: " ").map(String.init)
        if parts.count >= 2, let last = parts.last, RANKS.contains(last) {
            HStack(spacing: 4) {
                Text(parts.dropLast().joined(separator: " ")).font(.system(size: 13.5, weight: .heavy)).lineLimit(1)
                RankTag(r: last, size: 13.5)
            }
        } else {
            Text(t).font(.system(size: 13.5, weight: .heavy)).lineLimit(2)
        }
    }
}

/// 4.2.6 : l'enjeu d'un billet (« +5 pts · 68 % ») : les points en vert gazon, les chances en bleu dur
struct StakeLine: View {
    let st: String
    var body: some View {
        let parts = st.components(separatedBy: " · ")
        HStack(spacing: 3) {
            ForEach(Array(parts.enumerated()), id: \.offset) { i, s in
                if i > 0 { Text("·").foregroundColor(.secondary) }
                Text(s).foregroundColor(s.contains("%") ? .bleuDur : s.contains("pt") ? .gazon : .balle)
            }
        }.font(.system(size: 11, weight: .heavy)).lineLimit(1)
    }
}

/// « Ce qui arrive » sur l'accueil : les billets glissent un par un à l'ouverture (une fois par lancement)
struct CalTickets: View {
    @ObservedObject var link = PhoneLink.shared
    static var shown = false
    @Environment(\.accessibilityReduceMotion) private var reduce
    @State private var on = true
    var items: [WCal] { Array((link.ctx.cal ?? []).prefix(3)) }
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text("Ce qui arrive").font(.system(size: 13, weight: .heavy)).foregroundColor(.secondary).padding(.leading, 4)
            ForEach(Array(items.enumerated()), id: \.offset) { i, x in
                row(x)
                    .opacity(on ? 1 : 0).offset(x: on ? 0 : 24)
                    .animation(.spring(response: 0.5, dampingFraction: 0.8).delay(0.08 * Double(i) + 0.2), value: on)
            }
            if (link.ctx.cal ?? []).count > 3 {
                NavigationLink { AVenirView() } label: {
                    Text("Tout voir").font(.system(size: 12, weight: .heavy)).foregroundColor(.balle).frame(maxWidth: .infinity)
                }.buttonStyle(.plain).padding(.top, 2)
            }
        }
        .padding(.top, 4)
        .onAppear {
            guard !reduce, !CalTickets.shown else { return }
            CalTickets.shown = true
            on = false
            DispatchQueue.main.async { on = true }
        }
    }
    @ViewBuilder func row(_ x: WCal) -> some View {
        if let id = x.oid, !id.isEmpty, let o = link.opp(for: id) {
            NavigationLink { if link.canPlay { ServerView(opp: o) } else { PlusView() } } label: { CalTicket(x: x, play: true) }.buttonStyle(.plain)
        } else {
            CalTicket(x: x, play: false)
        }
    }
}

/// Le jour d'un match : la carte du match en haut de l'accueil, adversaire déjà chargé dans « Lancer le match »
struct DayCard: View {
    @ObservedObject var link = PhoneLink.shared
    let day: WDay
    var opp: WOpp? {
        guard let id = day.oid, !id.isEmpty else { return nil }
        return link.opp(for: id)
    }
    var head: String {
        var s = "Jour de match"
        if let t = day.time, !t.isEmpty { s += " · " + t }
        return s
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top, spacing: 6) {
                VStack(alignment: .leading, spacing: 2) {
                    Eyebrow(t: head)
                    if let s = day.s, !s.isEmpty { Text(s).font(.system(size: 10.5, weight: .semibold)).foregroundColor(.secondary).lineLimit(1) }
                    Text(day.t).font(.system(size: 16, weight: .heavy)).lineLimit(2).minimumScaleFactor(0.8)
                    if let r = day.r, !r.isEmpty { RankTag(r: r, size: 12) }
                }
                Spacer(minLength: 0)
                AceBall(mood: "concentree", size: 34)
            }
            HStack(spacing: 5) {
                if let st = day.st, !st.isEmpty { StatTile(k: day.k == "team" ? "Enjeu" : "Tes chances", v: st, color: .balle) }
                if let o = opp, let v = o.fv, let d = o.fd { StatTile(k: "Face-à-face", v: "\(v) – \(d)") }
            }
            if let o = opp {
                NavigationLink { if link.canPlay { ServerView(opp: o) } else { PlusView() } } label: { Label("Lancer le match", systemImage: "play.fill") }
                    .buttonStyle(Wide(bg: .balle, fg: .black))
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(Color.card))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(Color.balle.opacity(0.35), lineWidth: 1))
    }
}

/// Après le match (3 jours) : Ace joie ou déçu ; après une victoire, les points et la jauge ; après une défaite, pas de chiffre qui fait mal
struct AfterCard: View {
    @ObservedObject var link = PhoneLink.shared
    let m: WLastM
    @Environment(\.accessibilityReduceMotion) private var reduce
    @State private var k: Double = 1
    var win: Bool { m.r == "V" }
    var head: String {
        let w = win ? "Victoire" : "Défaite"
        guard let d = m.when, !d.isEmpty else { return w }
        return w + " · " + d
    }
    var body: some View {
        let c = link.ctx
        VStack(alignment: .leading, spacing: 5) {
            HStack(alignment: .center, spacing: 8) {
                AceBall(mood: win ? "joie" : "decue", size: 38)
                VStack(alignment: .leading, spacing: 1) {
                    Eyebrow(t: head, color: win ? .gazon : .secondary)
                    if let s = m.score, !s.isEmpty { Text(s).font(.system(size: 16, weight: .heavy)).lineLimit(1).minimumScaleFactor(0.7) }
                }
            }
            HStack(spacing: 4) {
                Text(win ? "contre" : "face à").font(.system(size: 11.5, weight: .semibold)).foregroundColor(.secondary)
                Text(m.opp).font(.system(size: 11.5, weight: .bold)).lineLimit(1)
                if let r = m.rank, !r.isEmpty { RankTag(r: r, size: 11.5) }
            }
            if win {
                if let p = m.pts, p.hasPrefix("+") {
                    Text(p + " pts").font(.system(size: 20, weight: .heavy)).foregroundColor(.balle)
                }
                if let pc = c.pct, !c.next.isEmpty {
                    BallBar(value: Double(pc) / 100 * k)
                    if let g = c.gap { Text(g > 0 ? "il te manque \(g) pts pour \(c.next)" : "tu as les points pour \(c.next)").font(.system(size: 10.5, weight: .semibold)).foregroundColor(.secondary) }
                }
            } else {
                Text("Ça arrive. On regarde ensemble ce qui a manqué sur l'iPhone.").font(.system(size: 11.5, weight: .semibold)).foregroundColor(.secondary).fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(Color.card))
        .onAppear {
            guard win, !reduce, !AceBall.played.contains("jauge") else { return }
            AceBall.played.insert("jauge")
            k = 0.6
            withAnimation(.easeOut(duration: 1.1).delay(0.5)) { k = 1 }
        }
    }
}
