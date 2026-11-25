package fr.montennis.app;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

/**
 * 4.6.0 : une page Ten'Up ouverte dans Montée (inscription, paiement, indispos), avec la session du joueur.
 * Montée ne lit ni ne remplit rien sur cette page. Téléphone, mail, appli bancaire : ouverts à part.
 */
public class TenupPageActivity extends AppCompatActivity {
    interface Callback { void closed(); }

    static String url;
    static String title;
    static Callback callback;

    private WebView web;
    private boolean closed = false;

    private int dp(int v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (url == null) { finish(); return; }
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
        TextView t = new TextView(this);
        t.setText(title != null ? title : "Ten'Up");
        t.setTextColor(Color.rgb(18, 18, 18));
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
        t.setTypeface(t.getTypeface(), android.graphics.Typeface.BOLD);
        TextView sub = new TextView(this);
        sub.setText("Sur Ten'Up, avec ta connexion. Montée ne voit pas ton paiement.");
        sub.setTextColor(Color.rgb(98, 91, 85));
        sub.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        texts.addView(t);
        texts.addView(sub);
        bar.addView(texts, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        Button close = new Button(this);
        close.setText("Fermer");
        close.setAllCaps(false);
        close.setTextColor(green);
        close.setBackgroundColor(Color.TRANSPARENT);
        close.setOnClickListener(v -> close());
        bar.addView(close);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setSupportMultipleWindows(false);
        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(web, true);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                String sc = u.getScheme() == null ? "" : u.getScheme().toLowerCase();
                if (sc.equals("https") || sc.equals("http") || sc.equals("about") || sc.equals("blob") || sc.equals("data")) return false;
                try {
                    Intent i = sc.equals("intent") ? Intent.parseUri(u.toString(), Intent.URI_INTENT_SCHEME) : new Intent(Intent.ACTION_VIEW, u);
                    startActivity(i);
                } catch (Exception ignored) {
                }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String u) {
                CookieManager.getInstance().flush();
            }
        });
        root.addView(bar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        root.addView(web, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(root);
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets b = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.ime());
            v.setPadding(b.left, b.top, b.right, b.bottom);
            return WindowInsetsCompat.CONSUMED;
        });
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (web.canGoBack()) web.goBack();
                else close();
            }
        });
        web.loadUrl(url);
    }

    private void close() {
        if (closed) return;
        closed = true;
        Callback c = callback;
        callback = null;
        url = null;
        if (c != null) c.closed();
        finish();
    }

    @Override
    protected void onDestroy() {
        if (!closed) {
            closed = true;
            Callback c = callback;
            callback = null;
            if (c != null) c.closed();
        }
        if (web != null) {
            try {
                if (web.getParent() instanceof ViewGroup) ((ViewGroup) web.getParent()).removeView(web);
                web.destroy();
            } catch (Exception ignored) {
            }
        }
        super.onDestroy();
    }
}
