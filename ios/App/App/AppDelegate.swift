import UIKit
import Capacitor
import WebKit
import JavaScriptCore
import BackgroundTasks
import UserNotifications
import HealthKit
import StoreKit
import WidgetKit
import WatchConnectivity

// Montée — partie native iPhone.
// - TenupPlugin : connexion à Ten'Up dans une vraie page web (WKWebView), puis lecture du
//   palmarès avec la session du joueur, comme le fait le site lui-même.
// - Actualisation silencieuse (à l'ouverture et en arrière-plan) et notifications locales.
// Aucun serveur : les identifiants restent dans la WKWebView, les données sur le téléphone.

let kRefreshTaskId = "fr.montennis.app.refresh"

@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: kRefreshTaskId, using: nil) { task in
            if let refresh = task as? BGAppRefreshTask {
                MonteeBackground.handle(task: refresh)
            } else {
                task.setTaskCompleted(success: true)
            }
        }
        // Apple Santé : la surveillance des nouvelles séances doit être lancée dès le démarrage
        MonteeHealth.startObserver()
        // Montée+ : achats validés hors de l'app (renouvellement, code d'offre…)
        MonteeStoreKit.listen()
        // Apple Watch : contexte envoyé à la montre, matchs reçus d'elle
        WatchLink.shared.start()
        return true
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        MonteeBackground.schedule()
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Toucher un widget : montee://open/… ou montee://slot/… ; la page l'exécute
        if url.scheme == "montee" {
            MonteeStore.action = url.absoluteString
            NotificationCenter.default.post(name: .monteeWidgetAction, object: nil)
            return true
        }
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}

// Contrôleur principal : enregistre le plugin Ten'Up auprès de Capacitor,
// et suit le thème de l'app (couleur de fond, icônes de la barre d'état).
class MainViewController: CAPBridgeViewController {
    var barStyle: UIStatusBarStyle = .darkContent

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(TenupPlugin())
        applyTheme(color: UIColor(red: 0.965, green: 0.949, blue: 0.925, alpha: 1), light: true)
    }

    override var preferredStatusBarStyle: UIStatusBarStyle { barStyle }

    /// Fond derrière la page (visible quand on tire l'écran) et couleur des icônes de la barre d'état.
    func applyTheme(color: UIColor, light: Bool) {
        barStyle = light ? .darkContent : .lightContent
        view.backgroundColor = color
        webView?.backgroundColor = color
        webView?.isOpaque = false
        webView?.scrollView.backgroundColor = color
        // Ne pas forcer clair/sombre ici : la page (thème « Auto ») lit le mode sombre de l'iPhone
        // à travers la WebView. Forcer .light faisait croire à la page que l'iPhone était en clair
        // et bloquait tout le monde sur le thème Lin.
        setNeedsStatusBarAppearanceUpdate()
    }
}

extension UIColor {
    /// Couleur depuis « #RRGGBB ».
    convenience init?(hex: String) {
        var h = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if h.hasPrefix("#") { h.removeFirst() }
        guard h.count == 6, let v = UInt32(h, radix: 16) else { return nil }
        self.init(red: CGFloat((v >> 16) & 0xFF) / 255, green: CGFloat((v >> 8) & 0xFF) / 255, blue: CGFloat(v & 0xFF) / 255, alpha: 1)
    }
}

extension Notification.Name {
    static let monteeWidgetAction = Notification.Name("monteeWidgetAction")
}

// MARK: - Widgets : dossier partagé avec l'extension (groupe d'apps)

enum MonteeWidgetsShared {
    static let group = "group.fr.montennis.app"
    static var dir: URL? {
        guard let base = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) else { return nil }
        let u = base.appendingPathComponent("widgets", isDirectory: true)
        try? FileManager.default.createDirectory(at: u, withIntermediateDirectories: true)
        return u
    }
    /// Widget posé (kind WidgetKit + taille) → nom du dessin côté app (mêmes noms que sur Android)
    static func artKind(_ kind: String, _ family: WidgetFamily) -> String? {
        switch (kind, family) {
        case ("MonteeMain", .systemSmall): return "classement"
        case ("MonteeMain", .systemMedium): return "sortie"
        case ("MonteeMain", .systemLarge): return "tableau"
        case ("MonteeCordage", _): return "cordage"
        case ("MonteeDefend", _): return "defend"
        case ("MonteeObjectif", _): return "objectif"
        case ("MonteeSemaine", _): return "semaine"
        case ("MonteeAdversaire", .systemSmall): return "adversaire2"
        case ("MonteeAdversaire", _): return "adversaire"
        case ("MonteeSuivis", .systemSmall): return "suivis2"
        case ("MonteeSuivis", .systemLarge): return "suivis3"
        case ("MonteeSuivis", _): return "suivis"
        case ("MonteeFaf", .systemSmall): return "faf1"
        case ("MonteeFaf", .systemMedium): return "faf2"
        case ("MonteeFaf", _): return "faf"
        default: return nil
        }
    }
    static func familyKey(_ f: WidgetFamily) -> String {
        switch f {
        case .systemSmall: return "small"
        case .systemMedium: return "medium"
        case .systemLarge: return "large"
        default: return "other"
        }
    }
    /// Taille du widget en points : celle mesurée par l'extension, sinon les tailles standard d'Apple.
    static func size(_ f: WidgetFamily) -> [Double] {
        let k = familyKey(f)
        if let s = UserDefaults(suiteName: group)?.array(forKey: "montee.size." + k) as? [Double], s.count == 2 { return s }
        let w = Double(min(UIScreen.main.bounds.width, UIScreen.main.bounds.height))
        let h = Double(max(UIScreen.main.bounds.width, UIScreen.main.bounds.height))
        let sm: Double, mw: Double, lh: Double
        if w >= 428 { sm = 170; mw = 364; lh = 382 }
        else if w >= 414 { sm = h >= 896 ? 169 : 159; mw = h >= 896 ? 360 : 348; lh = h >= 896 ? 379 : 357 }
        else if w >= 390 { sm = 158; mw = 338; lh = 354 }
        else if w >= 375 { sm = h >= 812 ? 155 : 148; mw = h >= 812 ? 329 : 321; lh = h >= 812 ? 345 : 324 }
        else { sm = 141; mw = 292; lh = 311 }
        switch f {
        case .systemSmall: return [sm, sm]
        case .systemMedium: return [mw, sm]
        default: return [mw, lh]
        }
    }
}

/// Photographie du HTML d'un widget dans une WKWebView cachée (derrière la page), un widget à la fois.
final class WidgetRenderer: NSObject, WKNavigationDelegate {
    struct Item { let kind: String; let html: String; let w: CGFloat; let h: CGFloat }
    static let shared = WidgetRenderer()
    static func num(_ v: Any?) -> Double? {
        if let d = v as? Double { return d }
        if let i = v as? Int { return Double(i) }
        if let n = v as? NSNumber { return n.doubleValue }
        return nil
    }

    private var queue = [Item]()
    private var current: Item?
    private var web: WKWebView?
    private var dir: URL?
    private var waiting = [() -> Void]()
    private var serial = 0
    private var tries = 0

    /// Photo ratée (page pas encore peinte, app passée en arrière-plan) : image vide ou d'une seule couleur.
    /// On ne l'écrit jamais, sinon le widget devient un carré gris jusqu'au prochain rendu.
    static func isBlank(_ img: UIImage) -> Bool {
        guard let cg = img.cgImage else { return true }
        let n = 12
        var px = [UInt8](repeating: 0, count: n * n * 4)
        guard let ctx = CGContext(data: &px, width: n, height: n, bitsPerComponent: 8, bytesPerRow: n * 4,
                                  space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return true }
        ctx.interpolationQuality = .medium
        ctx.draw(cg, in: CGRect(x: 0, y: 0, width: n, height: n))
        var lo = 255, hi = 0, alpha = 0
        for i in stride(from: 0, to: px.count, by: 4) {
            let l = (Int(px[i]) * 3 + Int(px[i + 1]) * 6 + Int(px[i + 2])) / 10
            lo = min(lo, l); hi = max(hi, l); alpha += Int(px[i + 3])
        }
        return alpha / (n * n) < 40 || hi - lo < 12
    }

    func render(_ items: [Item], in host: UIView, dir: URL, completion: @escaping () -> Void) {
        waiting.append(completion)
        self.dir = dir
        // Déjà en cours : on remplace simplement la suite par la nouvelle demande
        queue = items
        if current != nil { return }
        if web == nil {
            let wv = WKWebView(frame: CGRect(x: 0, y: 0, width: 170, height: 170), configuration: WKWebViewConfiguration())
            wv.isOpaque = false
            wv.backgroundColor = .clear
            wv.scrollView.backgroundColor = .clear
            wv.scrollView.isScrollEnabled = false
            // Sans ça, iOS décale la page sous la barre d'état (zone de sécurité) : bande grise en haut du widget
            wv.scrollView.contentInsetAdjustmentBehavior = .never
            wv.scrollView.contentInset = .zero
            wv.insetsLayoutMarginsFromSafeArea = false
            wv.isUserInteractionEnabled = false
            wv.navigationDelegate = self
            host.insertSubview(wv, at: 0) // sous la page : invisible, mais bien dessinée
            web = wv
        }
        next()
    }

    private func next() {
        guard let wv = web, !queue.isEmpty else { finish(); return }
        // App en arrière-plan : la WKWebView ne peint plus, on reprendra à la prochaine ouverture
        if UIApplication.shared.applicationState == .background { queue.removeAll(); finish(); return }
        let it = queue.removeFirst()
        current = it
        tries = 0
        serial += 1
        let my = serial
        // Posée au milieu de l'écran (toujours sous la page) : en haut, la zone de sécurité de la barre d'état
        // décalait parfois le dessin vers le bas (bande grise en haut du widget « Ta semaine »)
        wv.frame = CGRect(x: 0, y: 200, width: it.w, height: it.h)
        wv.scrollView.contentInset = .zero
        wv.scrollView.contentOffset = .zero
        wv.loadHTMLString(it.html, baseURL: nil)
        // Garde-fou : on passe au suivant si la page ne répond pas
        DispatchQueue.main.asyncAfter(deadline: .now() + 6) { [weak self] in
            guard let self = self, self.serial == my, self.current != nil else { return }
            self.current = nil
            self.next()
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        shoot(serial, delay: 0.35)
    }

    /// Attend la police embarquée, puis photographie ; une page encore vide est reprise deux fois
    private func shoot(_ my: Int, delay: Double) {
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
            guard let self = self, self.serial == my, let it = self.current, let wv = self.web else { return }
            wv.scrollView.contentOffset = .zero
            let conf = WKSnapshotConfiguration()
            conf.rect = CGRect(x: 0, y: 0, width: it.w, height: it.h)
            conf.snapshotWidth = NSNumber(value: Double(it.w))
            wv.takeSnapshot(with: conf) { img, _ in
                guard self.serial == my else { return }
                let blank = img.map { WidgetRenderer.isBlank($0) } ?? true
                if blank && self.tries < 2 && UIApplication.shared.applicationState != .background {
                    self.tries += 1
                    self.shoot(my, delay: 0.6)
                    return
                }
                if !blank, let img = img, let png = img.pngData(), let d = self.dir {
                    try? png.write(to: d.appendingPathComponent(it.kind + ".png"), options: .atomic)
                    WidgetCenter.shared.reloadAllTimelines()
                }
                self.current = nil
                self.next()
            }
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        current = nil
        next()
    }

    private func finish() {
        current = nil
        web?.removeFromSuperview()
        web = nil
        let w = waiting
        waiting = []
        w.forEach { $0() }
    }
}

// MARK: - Mémoire locale partagée entre l'app et l'arrière-plan

enum MonteeStore {
    private static let d = UserDefaults.standard
    static var script: String? {
        get { d.string(forKey: "montee.script") }
        set { d.set(newValue, forKey: "montee.script") }
    }
    static var state: String? {
        get { d.string(forKey: "montee.state") }
        set { d.set(newValue, forKey: "montee.state") }
    }
    static var pending: String? {
        get { d.string(forKey: "montee.pending") }
        set { d.set(newValue, forKey: "montee.pending") }
    }
    static var action: String? {
        get { d.string(forKey: "montee.action") }
        set { d.set(newValue, forKey: "montee.action") }
    }
    static var expiredNotified: Bool {
        get { d.bool(forKey: "montee.expiredNotified") }
        set { d.set(newValue, forKey: "montee.expiredNotified") }
    }
}

// MARK: - Lecture de Ten'Up dans une WKWebView

final class TenupFetcher: NSObject, WKNavigationDelegate {
    static let home = URL(string: "https://tenup.fft.fr/")!
    static let refuseCookies = """
    (function () {
      if (window.__monteeCmp) return; window.__monteeCmp = 1;
      var re = /^(tout refuser|refuser tout|tout rejeter|refuser|continuer sans accepter|reject all|decline all|deny all)$/i, done = false;
      var css = document.createElement('style');
      css.textContent = '#didomi-host,#onetrust-consent-sdk,#tarteaucitronRoot,#axeptio_overlay,#usercentrics-root,.fc-consent-root,#cmpbox,#cmpbox2,#CybotCookiebotDialog,.qc-cmp2-container{display:none!important}';
      (document.head || document.documentElement).appendChild(css);
      function tryRefuse() {
        if (done) return true;
        var els = document.querySelectorAll('button,a,[role=button],input[type=button],input[type=submit],span');
        for (var i = 0; i < els.length; i++) {
          var t = (els[i].innerText || els[i].value || '').replace(/\\s+/g, ' ').trim();
          if (t && t.length < 40 && re.test(t)) { try { els[i].click(); done = true; return true; } catch (e) {} }
        }
        return false;
      }
      var n = 0, iv = setInterval(function () { if (tryRefuse() || ++n > 60) clearInterval(iv); }, 250);
      try { new MutationObserver(function (m, o) { if (tryRefuse()) o.disconnect(); }).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
    })();
    """
    let webView: WKWebView
    private let script: String
    private var running = false
    private(set) var finished = false
    /// Appelé avec le texte renvoyé par le script ; renvoyer true pour arrêter.
    var onResult: ((String) -> Bool)?

    init(script: String, frame: CGRect = CGRect(x: 0, y: 0, width: 390, height: 844)) {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()   // cookies Ten'Up conservés entre deux lancements
        // Montée ne fait aucun suivi publicitaire : le bandeau de cookies du site est refusé automatiquement
        // (« Tout refuser »), seuls les cookies nécessaires à la connexion sont gardés.
        config.userContentController.addUserScript(WKUserScript(source: TenupFetcher.refuseCookies, injectionTime: .atDocumentEnd, forMainFrameOnly: false))
        webView = WKWebView(frame: frame, configuration: config)
        self.script = script
        super.init()
        webView.navigationDelegate = self
        webView.allowsBackForwardNavigationGestures = true
    }

    func load(_ url: URL = TenupFetcher.home) {
        // 3.47 : toujours redemandée au site (jamais une vieille page de maintenance gardée en cache)
        webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30))
    }

    func stop() {
        finished = true
        webView.stopLoading()
        webView.navigationDelegate = nil
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        runScript()
    }

    /// Exécute le script Montée dans la page, uniquement sur tenup.fft.fr.
    func runScript() {
        guard !running, !finished, let host = webView.url?.host, host.hasSuffix("tenup.fft.fr") else { return }
        running = true
        webView.callAsyncJavaScript(script, arguments: [:], in: nil, in: .page) { [weak self] result in
            guard let self = self else { return }
            self.running = false
            if self.finished { return }
            var text = "MONTEE-ERR erreur inconnue"
            switch result {
            case .success(let value):
                if let s = value as? String { text = s }
            case .failure(let error):
                text = "MONTEE-ERR " + error.localizedDescription
            }
            if self.onResult?(text) == true { self.finished = true }
        }
    }
}

// Fenêtre de connexion : la vraie page Ten'Up, Montée lit le palmarès dès que c'est possible.
final class TenupConnectViewController: UIViewController {
    let fetcher: TenupFetcher
    var onDone: ((String?) -> Void)?
    private let status = UILabel()
    private var timer: Timer?
    private var closed = false

    init(script: String) {
        fetcher = TenupFetcher(script: script)
        super.init(nibName: nil, bundle: nil)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) non utilisé") }

    override func viewDidLoad() {
        super.viewDidLoad()
        let linen = UIColor(red: 0.965, green: 0.949, blue: 0.925, alpha: 1)
        // Bandeau toujours clair : on ignore le mode sombre de l'iPhone (sinon titre blanc sur fond clair)
        overrideUserInterfaceStyle = .light
        view.backgroundColor = linen

        let bar = UIView()
        bar.backgroundColor = linen
        let title = UILabel()
        title.text = "Connecte-toi à Ten'Up"
        title.font = .systemFont(ofSize: 17, weight: .semibold)
        title.textColor = UIColor(red: 0.07, green: 0.07, blue: 0.07, alpha: 1)
        status.text = "Montée récupère ton palmarès dès que tu es connecté."
        status.font = .systemFont(ofSize: 13)
        status.textColor = UIColor(red: 0.38, green: 0.36, blue: 0.33, alpha: 1)
        status.numberOfLines = 2
        let close = UIButton(type: .system)
        close.setTitle("Annuler", for: .normal)
        close.titleLabel?.font = .systemFont(ofSize: 17)
        close.tintColor = UIColor(red: 0.12, green: 0.36, blue: 0.25, alpha: 1)
        close.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)

        let web = fetcher.webView
        for v in [bar, web] as [UIView] { v.translatesAutoresizingMaskIntoConstraints = false; view.addSubview(v) }
        for v in [title, status, close] as [UIView] { v.translatesAutoresizingMaskIntoConstraints = false; bar.addSubview(v) }
        NSLayoutConstraint.activate([
            bar.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            bar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            title.topAnchor.constraint(equalTo: bar.topAnchor, constant: 14),
            title.leadingAnchor.constraint(equalTo: bar.leadingAnchor, constant: 20),
            close.centerYAnchor.constraint(equalTo: title.centerYAnchor),
            close.trailingAnchor.constraint(equalTo: bar.trailingAnchor, constant: -16),
            status.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 4),
            status.leadingAnchor.constraint(equalTo: bar.leadingAnchor, constant: 20),
            status.trailingAnchor.constraint(equalTo: bar.trailingAnchor, constant: -20),
            status.bottomAnchor.constraint(equalTo: bar.bottomAnchor, constant: -12),
            web.topAnchor.constraint(equalTo: bar.bottomAnchor),
            web.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            web.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        fetcher.onResult = { [weak self] text in
            guard let self = self else { return true }
            if text.hasPrefix("MONTEE1") { self.finish(text); return true }
            return false
        }
        fetcher.load()
        // La connexion peut se terminer sans rechargement complet : on réessaie régulièrement.
        timer = Timer.scheduledTimer(withTimeInterval: 12, repeats: true) { [weak self] _ in self?.fetcher.runScript() }
    }

    @objc private func cancelTapped() { finish(nil) }

    private func finish(_ text: String?) {
        if closed { return }
        closed = true
        timer?.invalidate()
        timer = nil
        fetcher.stop()
        let callback = onDone
        dismiss(animated: true) { callback?(text) }
    }
}

// Lecture silencieuse (WKWebView invisible), avec délai maximum.
enum TenupSilentRefresh {
    private static var current: TenupFetcher?

    static func run(script: String, timeout: TimeInterval = 25, completion: @escaping (String) -> Void) {
        DispatchQueue.main.async {
            current?.stop()
            let fetcher = TenupFetcher(script: script)
            current = fetcher
            var done = false
            let finish: (String) -> Void = { text in
                if done { return }
                done = true
                fetcher.onResult = nil
                fetcher.stop()
                fetcher.webView.removeFromSuperview()
                if current === fetcher { current = nil }
                completion(text)
            }
            fetcher.onResult = { text in finish(text); return true }
            // Une WKWebView attachée à une fenêtre exécute son JavaScript de façon plus fiable.
            if let window = UIApplication.shared.connectedScenes
                .compactMap({ ($0 as? UIWindowScene)?.windows.first }).first {
                fetcher.webView.isHidden = true
                window.addSubview(fetcher.webView)
            }
            fetcher.load()
            DispatchQueue.main.asyncAfter(deadline: .now() + timeout) { finish("MONTEE-ERR délai dépassé") }
        }
    }
}

// MARK: - Plugin Capacitor appelé depuis l'app web

@objc(TenupPlugin)
public class TenupPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TenupPlugin"
    public let jsName = "Tenup"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "connect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "refresh", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "query", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takePending", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "logout", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resetWeb", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takeAction", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setWidgets", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "widgetInfo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setWidgetImages", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "renderWidgets", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "shareText", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "shareImage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setBars", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "haptic", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "healthStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "healthRequest", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "healthSettings", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "healthRead", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "healthSync", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "healthHR", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "healthProfile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "storeProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "storeBuy", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "storeOwned", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "storeManage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "watchSync", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "watchTake", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "watchStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "watchWarm", returnType: CAPPluginReturnPromise)
    ]

    override public func load() {
        NotificationCenter.default.addObserver(self, selector: #selector(watchMatchArrived), name: WatchLink.matchArrived, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(widgetActionArrived), name: .monteeWidgetAction, object: nil)
    }
    @objc func widgetActionArrived() { notifyListeners("widgetAction", data: [:]) }
    @objc func watchMatchArrived() { notifyListeners("watchMatch", data: [:]) }

    // ---------- Montée+ : achats intégrés (StoreKit 2, vérifiés par Apple, sans serveur) ----------
    @objc func storeProducts(_ call: CAPPluginCall) {
        let ids = call.getArray("ids", String.self) ?? []
        Task {
            var out = [[String: Any]]()
            if let ps = try? await Product.products(for: ids) {
                for p in ps { out.append(["id": p.id, "price": p.displayPrice]) }
            }
            call.resolve(["products": out])
        }
    }
    @objc func storeBuy(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else { call.reject("produit manquant"); return }
        Task {
            do {
                guard let p = try await Product.products(for: [id]).first else { call.resolve(["state": "error"]); return }
                let r = try await p.purchase()
                switch r {
                case .success(let v):
                    if case .verified(let t) = v {
                        await t.finish()
                        let ids = await MonteeStoreKit.owned()
                        call.resolve(["state": "ok", "ids": ids])
                    } else {
                        call.resolve(["state": "error"])
                    }
                case .userCancelled:
                    call.resolve(["state": "cancel"])
                case .pending:
                    call.resolve(["state": "pending"])
                @unknown default:
                    call.resolve(["state": "error"])
                }
            } catch {
                call.resolve(["state": "error", "message": error.localizedDescription])
            }
        }
    }
    /// Achats et abonnements actifs ; restore = true relance la synchro avec l'App Store (« Restaurer mes achats »).
    @objc func storeOwned(_ call: CAPPluginCall) {
        let restore = call.getBool("restore") ?? false
        Task {
            if restore { try? await AppStore.sync() }
            let ids = await MonteeStoreKit.owned()
            call.resolve(["ids": ids])
        }
    }
    /// Gérer / résilier l'abonnement (feuille Apple)
    @objc func storeManage(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let scene = UIApplication.shared.connectedScenes.first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene {
                Task { try? await AppStore.showManageSubscriptions(in: scene); call.resolve() }
            } else if let url = URL(string: "https://apps.apple.com/account/subscriptions") {
                UIApplication.shared.open(url); call.resolve()
            } else { call.resolve() }
        }
    }

    // ---------- Apple Watch ----------
    /// Données affichées par la montre (classement, adversaires, Montée+), en JSON
    @objc func watchSync(_ call: CAPPluginCall) {
        WatchLink.shared.push(call.getString("json") ?? "{}")
        call.resolve()
    }
    /// Matchs comptés à la montre, pas encore repris par l'app (une seule fois)
    @objc func watchTake(_ call: CAPPluginCall) {
        call.resolve(["items": WatchLink.shared.take()])
    }
    @objc func watchStatus(_ call: CAPPluginCall) {
        let s = WCSession.isSupported() ? WCSession.default : nil
        call.resolve(["supported": s != nil, "paired": s?.isPaired ?? false, "installed": s?.isWatchAppInstalled ?? false])
    }

    /// 3.55 : échauffement guidé. Ouvre Montée sur la montre (séance tennis) puis lui dit quel adversaire.
    @objc func watchWarm(_ call: CAPPluginCall) {
        let oid = call.getString("oid") ?? ""
        guard WCSession.isSupported(), WCSession.default.isPaired, WCSession.default.isWatchAppInstalled else {
            call.resolve(["ok": false]); return
        }
        let cfg = HKWorkoutConfiguration()
        cfg.activityType = .tennis
        cfg.locationType = .outdoor
        MonteeHealth.store.startWatchApp(with: cfg) { ok, _ in
            WatchLink.shared.warm(oid)
            call.resolve(["ok": ok])
        }
    }

    // ---------- Widgets ----------
    /// Action demandée en touchant un widget (une seule fois).
    @objc func takeAction(_ call: CAPPluginCall) {
        if let a = MonteeStore.action { MonteeStore.action = nil; call.resolve(["action": a]) } else { call.resolve() }
    }
    /// Données seules (sert aux widgets d'écran verrouillé).
    @objc func setWidgets(_ call: CAPPluginCall) {
        if let dir = MonteeWidgetsShared.dir, let data = call.getString("data") {
            try? data.write(to: dir.appendingPathComponent("data.json"), atomically: true, encoding: .utf8)
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve()
    }
    /// Widgets posés sur l'écran d'accueil et leur taille, pour que la page ne dessine que ceux-là.
    @objc func widgetInfo(_ call: CAPPluginCall) {
        WidgetCenter.shared.getCurrentConfigurations { result in
            var kinds = [String](), sizes = [String: Any]()
            if case .success(let list) = result {
                for w in list {
                    guard let k = MonteeWidgetsShared.artKind(w.kind, w.family), !kinds.contains(k) else { continue }
                    kinds.append(k)
                    sizes[k] = MonteeWidgetsShared.size(w.family)
                }
            }
            DispatchQueue.main.async {
                call.resolve(["kinds": kinds, "sizes": sizes, "density": Double(UIScreen.main.scale)])
            }
        }
    }
    /// iPhone : la page envoie le HTML de chaque widget, l'app le photographie (WKWebView) en PNG.
    /// (Safari interdit de relire un canvas où l'on a dessiné du HTML, d'où ce rendu natif.)
    @objc func renderWidgets(_ call: CAPPluginCall) {
        guard let dir = MonteeWidgetsShared.dir else { call.resolve(); return }
        if let data = call.getString("data") {
            try? data.write(to: dir.appendingPathComponent("data.json"), atomically: true, encoding: .utf8)
        }
        var items = [WidgetRenderer.Item]()
        if let obj = call.getObject("items") {
            for (k, v) in obj {
                guard let o = v as? JSObject, let html = o["html"] as? String else { continue }
                let w = WidgetRenderer.num(o["w"]) ?? 170, h = WidgetRenderer.num(o["h"]) ?? 170
                items.append(WidgetRenderer.Item(kind: k, html: html, w: CGFloat(w), h: CGFloat(h)))
            }
        }
        DispatchQueue.main.async {
            guard !items.isEmpty, let host = self.bridge?.viewController?.view else {
                WidgetCenter.shared.reloadAllTimelines(); call.resolve(); return
            }
            WidgetRenderer.shared.render(items, in: host, dir: dir) {
                WidgetCenter.shared.reloadAllTimelines()
                call.resolve()
            }
        }
    }

    /// Images des widgets dessinées par la page (PNG en base64) + données.
    @objc func setWidgetImages(_ call: CAPPluginCall) {
        guard let dir = MonteeWidgetsShared.dir else { call.resolve(); return }
        if let data = call.getString("data") {
            try? data.write(to: dir.appendingPathComponent("data.json"), atomically: true, encoding: .utf8)
        }
        if let images = call.getObject("images") {
            for (k, v) in images {
                guard let b64 = v as? String else { continue }
                let clean = b64.components(separatedBy: ",").last ?? b64
                if let bytes = Data(base64Encoded: clean) {
                    try? bytes.write(to: dir.appendingPathComponent(k + ".png"), options: .atomic)
                }
            }
        }
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }

    /// Sauvegarde : fichier temporaire puis feuille de partage iOS (Fichiers, AirDrop, Mail…).
    @objc func saveFile(_ call: CAPPluginCall) {
        let name = call.getString("name") ?? "montee.json"
        let content = call.getString("content") ?? ""
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(name)
        do {
            try content.write(to: url, atomically: true, encoding: .utf8)
        } catch {
            call.reject("Impossible d'écrire le fichier")
            return
        }
        DispatchQueue.main.async {
            guard let vc = self.bridge?.viewController else { call.reject("pas d'écran"); return }
            let share = UIActivityViewController(activityItems: [url], applicationActivities: nil)
            if let pop = share.popoverPresentationController {
                pop.sourceView = vc.view
                pop.sourceRect = CGRect(x: vc.view.bounds.midX, y: vc.view.bounds.maxY - 80, width: 1, height: 1)
            }
            share.completionWithItemsHandler = { _, done, _, _ in call.resolve(["saved": done, "shared": true]) }
            vc.present(share, animated: true)
        }
    }

    /// Partager Montée : feuille de partage iOS avec un texte (et son lien).
    @objc func shareText(_ call: CAPPluginCall) {
        let text = call.getString("text") ?? ""
        DispatchQueue.main.async {
            guard let vc = self.bridge?.viewController else { call.reject("pas d'écran"); return }
            let share = UIActivityViewController(activityItems: [text], applicationActivities: nil)
            if let pop = share.popoverPresentationController {
                pop.sourceView = vc.view
                pop.sourceRect = CGRect(x: vc.view.bounds.midX, y: vc.view.bounds.maxY - 80, width: 1, height: 1)
            }
            share.completionWithItemsHandler = { _, done, _, _ in call.resolve(["shared": done]) }
            vc.present(share, animated: true)
        }
    }

    /// Carte du mois : image PNG (base64) partagée via la feuille iOS (Instagram, Messages, Photos…).
    @objc func shareImage(_ call: CAPPluginCall) {
        let b64 = call.getString("base64") ?? ""
        guard let data = Data(base64Encoded: b64), let img = UIImage(data: data) else { call.reject("Image illisible"); return }
        let text = call.getString("text")
        DispatchQueue.main.async {
            guard let vc = self.bridge?.viewController else { call.reject("pas d'écran"); return }
            var items: [Any] = [img]
            if let t = text, !t.isEmpty { items.append(t) }
            let share = UIActivityViewController(activityItems: items, applicationActivities: nil)
            if let pop = share.popoverPresentationController {
                pop.sourceView = vc.view
                pop.sourceRect = CGRect(x: vc.view.bounds.midX, y: vc.view.bounds.maxY - 80, width: 1, height: 1)
            }
            share.completionWithItemsHandler = { _, done, _, _ in call.resolve(["shared": done]) }
            vc.present(share, animated: true)
        }
    }

    /// Thème : couleur de fond et icônes de la barre d'état.
    @objc func setBars(_ call: CAPPluginCall) {
        let color = UIColor(hex: call.getString("color") ?? "#F6F2EC") ?? .systemBackground
        let light = call.getBool("light") ?? true
        DispatchQueue.main.async {
            (self.bridge?.viewController as? MainViewController)?.applyTheme(color: color, light: light)
            call.resolve()
        }
    }

    /// Retour haptique discret (le Taptic Engine de l'iPhone).
    @objc func haptic(_ call: CAPPluginCall) {
        let style = call.getString("style") ?? "light"
        DispatchQueue.main.async {
            switch style {
            case "success", "warning", "error":
                let g = UINotificationFeedbackGenerator()
                g.notificationOccurred(style == "success" ? .success : style == "warning" ? .warning : .error)
            case "selection":
                UISelectionFeedbackGenerator().selectionChanged()
            case "medium":
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            default:
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
            }
            call.resolve()
        }
    }

    @objc func connect(_ call: CAPPluginCall) {
        guard let script = call.getString("script"), !script.isEmpty else { call.reject("script manquant"); return }
        MonteeStore.script = script
        DispatchQueue.main.async {
            let vc = TenupConnectViewController(script: script)
            vc.modalPresentationStyle = .pageSheet
            vc.isModalInPresentation = true
            vc.onDone = { text in
                if let t = text {
                    MonteeStore.expiredNotified = false
                    call.resolve(["data": t])
                } else {
                    call.resolve(["cancelled": true])
                }
            }
            self.bridge?.viewController?.present(vc, animated: true)
        }
    }

    @objc func refresh(_ call: CAPPluginCall) {
        let script = call.getString("script") ?? MonteeStore.script ?? ""
        if script.isEmpty { call.reject("script manquant"); return }
        MonteeStore.script = script
        TenupSilentRefresh.run(script: script) { text in
            call.resolve(["data": text])
        }
    }

    /// Requête ponctuelle sur Ten'Up (recherche de joueur, fiche d'un joueur) : le script n'est pas mémorisé.
    @objc func query(_ call: CAPPluginCall) {
        let script = call.getString("script") ?? ""
        if script.isEmpty { call.reject("script manquant"); return }
        TenupSilentRefresh.run(script: script, timeout: 30) { text in
            call.resolve(["data": text])
        }
    }

    // MARK: Apple Santé (lecture seule des séances d'entraînement)

    @objc func healthStatus(_ call: CAPPluginCall) {
        call.resolve([
            "supported": MonteeHealth.available,
            "granted": MonteeHealth.asked,
            "background": MonteeHealth.asked,
            "bgPossible": true,
            "ios": true,
            "hr": MonteeHealth.hrAsked
        ])
    }

    @objc func healthProfile(_ call: CAPPluginCall) {
        MonteeHealth.profile { r in call.resolve(r) }
    }

    @objc func healthHR(_ call: CAPPluginCall) {
        guard let a = call.getDouble("start"), let b = call.getDouble("end"), b > a else { call.resolve(["error": "dates"]); return }
        MonteeHealth.heartRate(start: Date(timeIntervalSince1970: a / 1000), end: Date(timeIntervalSince1970: b / 1000)) { r in call.resolve(r) }
    }

    @objc func healthRequest(_ call: CAPPluginCall) {
        guard MonteeHealth.available else { call.reject("Apple Santé indisponible sur cet appareil"); return }
        MonteeHealth.request { ok in call.resolve(["granted": ok]) }
    }

    /// iOS n'ouvre pas directement la page Santé de l'app : on ouvre les Réglages de Montée.
    @objc func healthSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
            call.resolve()
        }
    }

    @objc func healthRead(_ call: CAPPluginCall) {
        let days = call.getInt("days") ?? 30
        MonteeHealth.read(days: days) { list in
            if let list = list { call.resolve(["sessions": MonteeHealth.json(list)]) }
            else { call.resolve(["error": "lecture impossible"]) }
        }
    }

    @objc func healthSync(_ call: CAPPluginCall) {
        let d = UserDefaults.standard
        d.set(call.getBool("on") ?? false, forKey: "montee.healthOn")
        d.set(call.getBool("notify") ?? true, forKey: "montee.healthNotify")
        if let k = call.getString("known") { d.set(k, forKey: "montee.healthKnown") }
        if let m = call.getString("matchDays") { d.set(m, forKey: "montee.healthMatchDays") }
        if let s = call.getString("since") { d.set(s, forKey: "montee.healthSince") }
        MonteeHealth.startObserver()
        call.resolve()
    }

    @objc func setState(_ call: CAPPluginCall) {
        if let state = call.getString("state") { MonteeStore.state = state }
        if let script = call.getString("script"), !script.isEmpty { MonteeStore.script = script }
        MonteeBackground.schedule()
        call.resolve()
    }

    @objc func takePending(_ call: CAPPluginCall) {
        if let pending = MonteeStore.pending {
            MonteeStore.pending = nil
            call.resolve(["data": pending])
        } else {
            call.resolve()
        }
    }

    /// 3.47 : Ten'Up resté sur sa page de maintenance ou sa file d'attente : on vide le cache de la page Ten'Up
    /// (pages gardées, service workers, file d'attente Queue-it) sans toucher à la connexion.
    @objc func resetWeb(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let store = WKWebsiteDataStore.default()
            let cache: Set<String> = [WKWebsiteDataTypeDiskCache, WKWebsiteDataTypeMemoryCache, WKWebsiteDataTypeOfflineWebApplicationCache, WKWebsiteDataTypeServiceWorkerRegistrations, WKWebsiteDataTypeFetchCache]
            let all = WKWebsiteDataStore.allWebsiteDataTypes()
            store.fetchDataRecords(ofTypes: all) { records in
                let tenup = records.filter { $0.displayName.contains("fft.fr") }
                let queue = records.filter { $0.displayName.contains("queue-it") }
                store.removeData(ofTypes: cache, for: tenup) {
                    store.removeData(ofTypes: all, for: queue) {
                        store.httpCookieStore.getAllCookies { cookies in
                            let q = cookies.filter { $0.name.lowercased().hasPrefix("queueit") }
                            let g = DispatchGroup()
                            for c in q { g.enter(); store.httpCookieStore.delete(c) { g.leave() } }
                            g.notify(queue: .main) { call.resolve() }
                        }
                    }
                }
            }
        }
    }

    @objc func logout(_ call: CAPPluginCall) {
        MonteeStore.state = nil
        MonteeStore.pending = nil
        DispatchQueue.main.async {
            let store = WKWebsiteDataStore.default()
            let types = WKWebsiteDataStore.allWebsiteDataTypes()
            store.fetchDataRecords(ofTypes: types) { records in
                let tenup = records.filter { $0.displayName.contains("fft.fr") || $0.displayName.contains("queue-it") }
                store.removeData(ofTypes: types, for: tenup) { call.resolve() }
            }
        }
    }
}

// MARK: - Arrière-plan : nouveaux matchs et notifications

enum MonteeSummary {
    /// Calcule le résumé avec le même moteur que l'app (engine.js, tenup.js, summary.js).
    static func compute(payload: String, state: String) -> [(title: String, body: String)] {
        guard let ctx = JSContext() else { return [] }
        for name in ["engine", "tenup", "summary"] {
            if let url = Bundle.main.url(forResource: name, withExtension: "js", subdirectory: "public"),
               let source = try? String(contentsOf: url, encoding: .utf8) {
                ctx.evaluateScript(source)
            }
        }
        guard let fn = ctx.objectForKeyedSubscript("monteeSummary"), !fn.isUndefined,
              let res = fn.call(withArguments: [payload, state]), !res.isUndefined, !res.isNull,
              let json = res.toString(), let data = json.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return [] }
        if let newState = obj["state"] as? String { MonteeStore.state = newState }
        var out: [(title: String, body: String)] = []
        if let title = obj["title"] as? String, let body = obj["body"] as? String { out.append((title: title, body: body)) }
        // 3.43.2 : profil de compétiteur qui bouge, joueurs suivis (au plus 4 notifications par relance)
        if let more = obj["more"] as? [[String: Any]] {
            for m in more {
                if let t = m["title"] as? String, let b = m["body"] as? String { out.append((title: t, body: b)) }
            }
        }
        return Array(out.prefix(4))
    }
}

enum MonteeBackground {
    static func schedule() {
        let request = BGAppRefreshTaskRequest(identifier: kRefreshTaskId)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 3 * 3600)
        try? BGTaskScheduler.shared.submit(request)
    }

    static func handle(task: BGAppRefreshTask) {
        schedule()
        guard let script = MonteeStore.script, MonteeStore.state != nil else {
            task.setTaskCompleted(success: true)
            return
        }
        var completed = false
        task.expirationHandler = {
            DispatchQueue.main.async {
                if !completed { completed = true; task.setTaskCompleted(success: false) }
            }
        }
        TenupSilentRefresh.run(script: script, timeout: 22) { text in
            DispatchQueue.main.async {
                if completed { return }
                completed = true
                if text.hasPrefix("MONTEE1") {
                    // 3.43.2 : une relance « joueurs suivis » n'écrase pas un palmarès pas encore importé
                    if !(text.contains("\"folOnly\":true") && MonteeStore.pending != nil) { MonteeStore.pending = text }
                    for note in MonteeSummary.compute(payload: text, state: MonteeStore.state ?? "{}") {
                        notify(title: note.title, body: note.body)
                    }
                } else if text.contains("connecte-toi") && !MonteeStore.expiredNotified {
                    MonteeStore.expiredNotified = true
                    notify(title: "Ten'Up t'a déconnecté", body: "Ouvre Montée et reconnecte-toi pour suivre tes nouveaux matchs.")
                }
                task.setTaskCompleted(success: true)
            }
        }
    }

    static func notify(title: String, body: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        let request = UNNotificationRequest(identifier: "montee-\(UUID().uuidString)", content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request, withCompletionHandler: nil)
    }
}

// MARK: - Apple Santé : séances de tennis (lecture seule, rien n'est envoyé ailleurs)

enum MonteeHealth {
    static let store = HKHealthStore()
    static let workoutType = HKObjectType.workoutType()
    static var observer: HKObserverQuery?

    static var available: Bool { HKHealthStore.isHealthDataAvailable() }
    /// iOS ne dit jamais si la lecture a été acceptée : on retient seulement que la demande a été faite.
    static var asked: Bool {
        get { UserDefaults.standard.bool(forKey: "montee.healthAsked") }
        set { UserDefaults.standard.set(newValue, forKey: "montee.healthAsked") }
    }

    /// 3.53 : fréquence cardiaque et énergie, pour la courbe cardio des matchs (demandées en plus des séances)
    static let hrType = HKQuantityType.quantityType(forIdentifier: .heartRate)!
    static let energyType = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned)!
    /// 3.53.3 : pour les zones cardio (Karvonen) : FC de repos et date de naissance
    static let restType = HKQuantityType.quantityType(forIdentifier: .restingHeartRate)!
    static let birthType = HKObjectType.characteristicType(forIdentifier: .dateOfBirth)!
    static var hrAsked: Bool {
        get { UserDefaults.standard.bool(forKey: "montee.healthHRAsked") }
        set { UserDefaults.standard.set(newValue, forKey: "montee.healthHRAsked") }
    }

    static func request(completion: @escaping (Bool) -> Void) {
        store.requestAuthorization(toShare: nil, read: [workoutType, hrType, energyType, restType, birthType]) { ok, _ in
            DispatchQueue.main.async {
                if ok { MonteeHealth.asked = true; MonteeHealth.hrAsked = true }
                completion(ok)
            }
        }
    }

    /// Année de naissance et FC de repos moyenne des 30 derniers jours (rien si non autorisé)
    static func profile(completion: @escaping ([String: Any]) -> Void) {
        guard available else { completion(["error": "indisponible"]); return }
        var out: [String: Any] = [:]
        if let c = try? store.dateOfBirthComponents(), let y = c.year { out["year"] = y }
        let end = Date(), start = end.addingTimeInterval(-30 * 86400)
        let pred = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
        let bpm = HKUnit.count().unitDivided(by: .minute())
        let q = HKStatisticsQuery(quantityType: restType, quantitySamplePredicate: pred, options: .discreteAverage) { _, st, _ in
            if let v = st?.averageQuantity()?.doubleValue(for: bpm) { out["rest"] = v }
            // 3.53.3 : ta FC max mesurée sur 12 mois (toutes activités), comme la « plage » de l'app Santé
            let p2 = HKQuery.predicateForSamples(withStart: end.addingTimeInterval(-365 * 86400), end: end, options: [])
            let q2 = HKStatisticsQuery(quantityType: hrType, quantitySamplePredicate: p2, options: .discreteMax) { _, st2, _ in
                if let v = st2?.maximumQuantity()?.doubleValue(for: bpm) { out["max"] = v }
                DispatchQueue.main.async { completion(out) }
            }
            MonteeHealth.store.execute(q2)
        }
        store.execute(q)
    }

    /// Fréquence cardiaque entre deux instants : points (secondes depuis le début, bpm) et énergie active.
    static func heartRate(start: Date, end: Date, completion: @escaping ([String: Any]) -> Void) {
        guard available else { completion(["error": "indisponible"]); return }
        let pred = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)
        let unit = HKUnit.count().unitDivided(by: .minute())
        let q = HKSampleQuery(sampleType: hrType, predicate: pred, limit: 5000, sortDescriptors: [sort]) { _, samples, error in
            if error != nil { DispatchQueue.main.async { completion(["error": "lecture impossible"]) }; return }
            var t: [Int] = [], v: [Int] = [], watch = false
            for s in samples ?? [] {
                guard let qs = s as? HKQuantitySample else { continue }
                t.append(Int(qs.startDate.timeIntervalSince(start)))
                v.append(Int(qs.quantity.doubleValue(for: unit).rounded()))
                let m = ((qs.device?.model ?? "") + " " + (qs.device?.name ?? "")).lowercased()
                if m.contains("watch") { watch = true }
            }
            let eq = HKStatisticsQuery(quantityType: energyType, quantitySamplePredicate: pred, options: .cumulativeSum) { _, st, _ in
                let kcal = st?.sumQuantity()?.doubleValue(for: .kilocalorie()) ?? 0
                DispatchQueue.main.async { completion(["t": t, "v": v, "kcal": kcal, "watch": watch]) }
            }
            MonteeHealth.store.execute(eq)
        }
        MonteeHealth.store.execute(q)
    }

    static func typeName(_ t: HKWorkoutActivityType) -> String {
        switch t {
        case .tennis: return "TENNIS"
        case .running: return "RUNNING"
        case .walking: return "WALKING"
        case .cycling: return "BIKING"
        case .traditionalStrengthTraining, .functionalStrengthTraining: return "STRENGTH_TRAINING"
        case .badminton: return "BADMINTON"
        case .squash: return "SQUASH"
        case .racquetball: return "RACQUETBALL"
        case .tableTennis: return "TABLE_TENNIS"
        case .swimming: return "SWIMMING_POOL"
        case .yoga: return "YOGA"
        case .highIntensityIntervalTraining: return "HIGH_INTENSITY_INTERVAL_TRAINING"
        case .soccer: return "SOCCER"
        case .basketball: return "BASKETBALL"
        case .hiking: return "HIKING"
        case .elliptical: return "ELLIPTICAL"
        case .pilates: return "PILATES"
        default: return "OTHER_WORKOUT"
        }
    }

    /// Séances d'entraînement des `days` derniers jours (le tri tennis / autres se fait dans l'app).
    static func read(days: Int, completion: @escaping ([[String: Any]]?) -> Void) {
        guard available else { completion(nil); return }
        let end = Date()
        let start = end.addingTimeInterval(-Double(max(1, days)) * 86400)
        let pred = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)
        let q = HKSampleQuery(sampleType: workoutType, predicate: pred, limit: 500, sortDescriptors: [sort]) { _, samples, error in
            if error != nil {
                DispatchQueue.main.async { completion(nil) }
                return
            }
            var out: [[String: Any]] = []
            for s in samples ?? [] {
                guard let w = s as? HKWorkout else { continue }
                let src = w.sourceRevision.source
                var o: [String: Any] = [
                    "id": w.uuid.uuidString,
                    "start": NSNumber(value: Int64(w.startDate.timeIntervalSince1970 * 1000)),
                    "end": NSNumber(value: Int64(w.endDate.timeIntervalSince1970 * 1000)),
                    "tennis": w.workoutActivityType == .tennis,
                    "typeName": MonteeHealth.typeName(w.workoutActivityType),
                    "origin": src.bundleIdentifier,
                    "device": w.device?.name ?? src.name
                ]
                let model = (w.device?.model ?? "") + " " + (w.device?.name ?? "")
                if model.lowercased().contains("watch") { o["deviceType"] = 1 }
                out.append(o)
            }
            DispatchQueue.main.async { completion(out) }
        }
        store.execute(q)
    }

    static func json(_ v: Any) -> String {
        guard JSONSerialization.isValidJSONObject(v),
              let d = try? JSONSerialization.data(withJSONObject: v, options: []),
              let s = String(data: d, encoding: .utf8) else { return "[]" }
        return s
    }

    static func idSet(_ key: String) -> Set<String> {
        guard let s = UserDefaults.standard.string(forKey: key), let d = s.data(using: .utf8),
              let a = try? JSONSerialization.jsonObject(with: d, options: []) as? [String] else { return [] }
        return Set(a)
    }

    /// Nouvelle séance détectée en arrière-plan : notification (iOS réveille l'app, environ toutes les heures au plus).
    static func startObserver() {
        let d = UserDefaults.standard
        let on = available && asked && d.bool(forKey: "montee.healthOn") && d.object(forKey: "montee.healthNotify") as? Bool != false
        if !on {
            if let o = observer { store.stop(o); observer = nil }
            store.disableBackgroundDelivery(for: workoutType) { _, _ in }
            return
        }
        if observer != nil { return }
        let q = HKObserverQuery(sampleType: workoutType, predicate: nil) { _, done, error in
            if error != nil { done(); return }
            MonteeHealth.check { done() }
        }
        observer = q
        store.execute(q)
        store.enableBackgroundDelivery(for: workoutType, frequency: .hourly) { _, _ in }
    }

    static func check(done: @escaping () -> Void) {
        MonteeHealth.read(days: 3) { list in
            guard let list = list else { done(); return }
            let d = UserDefaults.standard
            let known = MonteeHealth.idSet("montee.healthKnown")
            var notified = MonteeHealth.idSet("montee.healthNotified")
            let matchDays = MonteeHealth.idSet("montee.healthMatchDays")
            let since = Double(d.string(forKey: "montee.healthSince") ?? "0") ?? 0
            let f = DateFormatter()
            f.dateFormat = "yyyy-MM-dd"
            f.locale = Locale(identifier: "fr_FR")
            var best: [String: Any]? = nil
            var count = 0
            for o in list {
                guard let id = o["id"] as? String, (o["tennis"] as? Bool) == true else { continue }
                let start = (o["start"] as? NSNumber)?.doubleValue ?? 0
                let end = (o["end"] as? NSNumber)?.doubleValue ?? 0
                if known.contains(id) || notified.contains(id) || start < since || end - start < 600000 { continue }
                if matchDays.contains(f.string(from: Date(timeIntervalSince1970: start / 1000))) { continue }
                count += 1
                notified.insert(id)
                if best == nil || start > ((best?["start"] as? NSNumber)?.doubleValue ?? 0) { best = o }
            }
            if let b = best {
                d.set(MonteeHealth.json(Array(notified)), forKey: "montee.healthNotified")
                let start = Date(timeIntervalSince1970: ((b["start"] as? NSNumber)?.doubleValue ?? 0) / 1000)
                let end = Date(timeIntervalSince1970: ((b["end"] as? NSNumber)?.doubleValue ?? 0) / 1000)
                let mins = max(0, Int(end.timeIntervalSince(start) / 60))
                let dur = mins >= 60 ? "\(mins / 60) h" + (mins % 60 > 0 ? String(format: " %02d", mins % 60) : "") : "\(mins) min"
                let h = DateFormatter()
                h.locale = Locale(identifier: "fr_FR")
                h.dateFormat = "EEEE d MMMM, H 'h'"
                let w0 = h.string(from: start)
                let when = Calendar.current.isDateInToday(start) ? "Aujourd'hui" : Calendar.current.isDateInYesterday(start) ? "Hier" : w0.prefix(1).uppercased() + String(w0.dropFirst())
                MonteeBackground.notify(title: count > 1 ? "\(count) nouvelles séances de tennis" : "Nouvelle séance de tennis",
                                        body: "\(when) · \(dur). Ouvre Montée pour l'ajouter à tes entraînements, avec ta raquette.")
            }
            done()
        }
    }
}


// MARK: - Montée+ (StoreKit 2)

enum MonteeStoreKit {
    static var updates: Task<Void, Never>?
    static func listen() {
        updates = Task.detached {
            for await r in Transaction.updates {
                if case .verified(let t) = r { await t.finish() }
            }
        }
    }
    /// Produits actifs : achat à vie, ou abonnement en cours (non remboursé, non expiré)
    static func owned() async -> [String] {
        var ids = [String]()
        for await r in Transaction.currentEntitlements {
            if case .verified(let t) = r, t.revocationDate == nil {
                if let exp = t.expirationDate, exp < Date() { continue }
                ids.append(t.productID)
            }
        }
        return ids
    }
}

// MARK: - Apple Watch (WatchConnectivity)

/// Envoie à la montre le contexte préparé par l'app web, reçoit les matchs comptés au poignet.
final class WatchLink: NSObject, WCSessionDelegate {
    static let shared = WatchLink()
    static let matchArrived = Notification.Name("monteeWatchMatch")
    private let pendingKey = "montee.watch.pending"
    private var lastJson: String?

    func start() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    func push(_ json: String) {
        lastJson = json
        send()
    }

    private func send() {
        guard WCSession.isSupported(), let json = lastJson else { return }
        let s = WCSession.default
        guard s.activationState == .activated, s.isPaired, s.isWatchAppInstalled else { return }
        try? s.updateApplicationContext(["json": json, "at": Date().timeIntervalSince1970])
    }

    /// 3.55 : l'échauffement guidé. En direct si la montre est joignable, sinon en file (reçu à l'ouverture).
    func warm(_ oid: String) {
        guard WCSession.isSupported() else { return }
        let s = WCSession.default
        guard s.activationState == .activated else { return }
        let msg: [String: Any] = ["warm": oid, "at": Date().timeIntervalSince1970]
        if s.isReachable {
            s.sendMessage(msg, replyHandler: nil) { _ in _ = s.transferUserInfo(msg) }
        } else {
            _ = s.transferUserInfo(msg)
        }
    }

    func take() -> [String] {
        let d = UserDefaults.standard
        let items = d.stringArray(forKey: pendingKey) ?? []
        d.removeObject(forKey: pendingKey)
        return items
    }

    private func store(_ json: String) {
        let d = UserDefaults.standard
        var items = d.stringArray(forKey: pendingKey) ?? []
        items.append(json)
        d.set(items, forKey: pendingKey)
        DispatchQueue.main.async { NotificationCenter.default.post(name: WatchLink.matchArrived, object: nil) }
    }

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        DispatchQueue.main.async { self.send() }
    }
    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) { WCSession.default.activate() }
    func sessionWatchStateDidChange(_ session: WCSession) {
        DispatchQueue.main.async { self.send() }
    }
    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        if let j = userInfo["match"] as? String { store(j) }
    }
    func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
        // 3.47 : un match envoyé en direct quand l'iPhone est joignable (plus rapide que la file d'attente du système)
        if let j = message["match"] as? String { store(j); replyHandler(["ok": 1]); return }
        // La montre demande le contexte (premier lancement)
        if message["hello"] != nil, let j = lastJson { replyHandler(["json": j]) } else { replyHandler([:]) }
    }
}
