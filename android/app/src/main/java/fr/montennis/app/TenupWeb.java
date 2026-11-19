package fr.montennis.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

/**
 * Une WebView sur le vrai site tenup.fft.fr. Quand une page Ten'Up est chargée, on y exécute
 * le script de lecture de Montée (le même que le favori) avec la session de l'utilisateur.
 * À créer et utiliser sur le fil principal.
 */
final class TenupWeb {
    interface Listener {
        /** Reçoit le texte renvoyé par le script ; renvoyer true pour arrêter. */
        boolean onResult(String text);
    }

    static final String HOME = "https://tenup.fft.fr/";

    final WebView web;
    private final String script;
    private final Handler main = new Handler(Looper.getMainLooper());
    private boolean running = false;
    private boolean finished = false;
    private int token = 0;
    Listener listener;
    /** Appelé à chaque page chargée (sert à repérer la page de blocage anti-robots). */
    Runnable onPage;

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface", "AddJavascriptInterface"})
    TenupWeb(Context ctx, String script) {
        this.script = script;
        web = new WebView(ctx);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportMultipleWindows(false);
        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(web, true);
        web.addJavascriptInterface(new Bridge(), "MonteeBridge");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                CookieManager.getInstance().flush();
                if (onPage != null) onPage.run();
                runScript();
            }
        });
    }

    void load() {
        // Une taille réelle : sans elle, certaines pages ne finissent pas de se charger hors écran
        web.measure(View.MeasureSpec.makeMeasureSpec(400, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(800, View.MeasureSpec.EXACTLY));
        web.layout(0, 0, 400, 800);
        // 3.47 : la page d'accueil toujours redemandée au site (jamais une vieille page de maintenance gardée en cache)
        java.util.Map<String, String> h = new java.util.HashMap<>();
        h.put("Cache-Control", "no-cache");
        h.put("Pragma", "no-cache");
        web.loadUrl(HOME, h);
    }

    /** Lecture silencieuse depuis l'app ouverte : la WebView est posée hors de l'écran, comme sur iPhone. */
    void attachHidden(Activity activity) {
        if (activity == null) return;
        ViewGroup content = activity.findViewById(android.R.id.content);
        if (content == null) return;
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(400, 800);
        web.setTranslationX(-10000f);
        content.addView(web, lp);
    }

    /** Exécute le script Montée, uniquement sur tenup.fft.fr. */
    void runScript() {
        if (running || finished) return;
        String url = web.getUrl();
        if (url == null) return;
        String host = Uri.parse(url).getHost();
        if (host == null || !host.endsWith("tenup.fft.fr")) return;
        running = true;
        final int t = ++token;
        String js = "(async function(){" + script + "\n})().then(function(r){MonteeBridge.post(" + t + ",typeof r==='string'?r:'MONTEE-ERR erreur inconnue');},"
                + "function(e){MonteeBridge.post(" + t + ",'MONTEE-ERR '+((e&&e.message)||e));});void 0;";
        web.evaluateJavascript(js, null);
        // si la page change en cours de route, on autorise un nouvel essai
        main.postDelayed(() -> { if (token == t) running = false; }, 20000);
    }

    void stop() {
        finished = true;
        listener = null;
    }

    void destroy() {
        stop();
        try {
            web.stopLoading();
            if (web.getParent() instanceof ViewGroup) ((ViewGroup) web.getParent()).removeView(web);
            web.removeJavascriptInterface("MonteeBridge");
            web.destroy();
        } catch (Exception ignored) {
        }
    }

    private final class Bridge {
        @JavascriptInterface
        public void post(final int t, final String text) {
            main.post(() -> {
                if (t != token) return;
                running = false;
                if (finished) return;
                Listener l = listener;
                if (l != null && l.onResult(text == null ? "MONTEE-ERR réponse vide" : text)) finished = true;
            });
        }
    }
}
