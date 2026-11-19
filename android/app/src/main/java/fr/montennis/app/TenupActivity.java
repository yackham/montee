package fr.montennis.app;

import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

/** Écran de connexion : la vraie page Ten'Up ; Montée lit le palmarès dès que l'utilisateur est connecté. */
public class TenupActivity extends AppCompatActivity {
    interface Callback {
        void done(String text);
    }

    /** Renseignés par le plugin juste avant d'ouvrir l'écran. */
    static String script;
    static Callback callback;

    private TenupWeb tw;
    private TextView status;
    private final Handler main = new Handler(Looper.getMainLooper());
    private Runnable tick;
    private boolean closed = false;
    private boolean blocked = false;

    private int dp(int v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (script == null) { finish(); return; }
        int linen = Color.rgb(246, 242, 236), green = Color.rgb(31, 92, 63);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(linen);

        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(dp(20), dp(12), dp(8), dp(12));

        LinearLayout texts = new LinearLayout(this);
        texts.setOrientation(LinearLayout.VERTICAL);
        TextView title = new TextView(this);
        title.setText("Connecte-toi à Ten'Up");
        title.setTextColor(Color.rgb(18, 18, 18));
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
        title.setTypeface(title.getTypeface(), android.graphics.Typeface.BOLD);
        status = new TextView(this);
        status.setText("Ferme les fenêtres de Ten'Up (cookies, appli), puis connecte-toi : Montée récupère ton palmarès tout seul.");
        status.setTextColor(Color.rgb(98, 91, 85));
        status.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        texts.addView(title);
        texts.addView(status);
        bar.addView(texts, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));

        Button cancel = new Button(this);
        cancel.setText("Annuler");
        cancel.setAllCaps(false);
        cancel.setTextColor(green);
        cancel.setBackgroundColor(Color.TRANSPARENT);
        cancel.setOnClickListener(v -> close(null));
        bar.addView(cancel);

        tw = new TenupWeb(this, script);
        root.addView(bar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        root.addView(tw.web, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(root);

        // Bord à bord (Android 15) : on laisse la place aux barres système
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets b = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.ime());
            v.setPadding(b.left, b.top, b.right, b.bottom);
            return WindowInsetsCompat.CONSUMED;
        });

        tw.listener = text -> {
            if (text.startsWith("MONTEE1")) { close(text); return true; }
            return false;
        };
        int wv = webViewMajor();
        if (wv > 0 && wv < 100) status.setText("Le moteur web de ce téléphone est trop ancien (version " + wv + ") : mets à jour « Android System WebView » et Chrome dans le Play Store.");
        tw.onPage = () -> tw.web.evaluateJavascript(
                "((document.body&&/temporarily restricted|unusual activity|acc[eè]s.*restreint/i.test(document.body.innerText))||document.querySelector('iframe[src*=\\'captcha-delivery\\']'))?'1':'0'",
                v -> {
                    if (v != null && v.contains("1")) {
                        blocked = true;
                        status.setText("Ten'Up bloque temporairement ce réseau ou cet appareil. Réessaie plus tard, en wifi ou en 4G.");
                    } else {
                        blocked = false;
                    }
                });
        tw.load();
        // La connexion peut aboutir sans rechargement complet : on réessaie régulièrement (sans insister).
        tick = new Runnable() {
            @Override
            public void run() {
                if (closed) return;
                if (!blocked) tw.runScript();
                main.postDelayed(this, 12000);
            }
        };
        main.postDelayed(tick, 12000);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (tw.web.canGoBack()) tw.web.goBack();
                else close(null);
            }
        });
    }

    /** Version principale du moteur web Android (ex. 103), 0 si inconnue. */
    private static int webViewMajor() {
        try {
            if (android.os.Build.VERSION.SDK_INT < 26) return 0;
            android.content.pm.PackageInfo p = android.webkit.WebView.getCurrentWebViewPackage();
            if (p == null || p.versionName == null) return 0;
            return Integer.parseInt(p.versionName.split("\\.")[0]);
        } catch (Exception e) {
            return 0;
        }
    }

    private void close(String text) {
        if (closed) return;
        closed = true;
        main.removeCallbacksAndMessages(null);
        Callback c = callback;
        callback = null;
        script = null;
        if (c != null) c.done(text);
        finish();
    }

    @Override
    protected void onDestroy() {
        if (!closed) {
            closed = true;
            main.removeCallbacksAndMessages(null);
            Callback c = callback;
            callback = null;
            if (c != null) c.done(null);
        }
        if (tw != null) tw.destroy();
        super.onDestroy();
    }
}
