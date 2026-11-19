package fr.montennis.app;

import android.annotation.SuppressLint;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/** Calcule le texte de la notification avec le même moteur que l'app (engine.js, tenup.js, summary.js). */
final class MonteeSummary {
    private MonteeSummary() {}

    static String asset(Context ctx, String path) {
        try (InputStream in = ctx.getAssets().open(path)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toString("UTF-8");
        } catch (Exception e) {
            return "";
        }
    }

    /** À appeler hors du fil principal. Renvoie {titre1, texte1, titre2, texte2…} ou null ; met à jour l'état mémorisé. */
    @SuppressLint("SetJavaScriptEnabled")
    static String[] compute(final Context ctx, String payload, String state) {
        final String src = asset(ctx, "public/engine.js") + "\n;" + asset(ctx, "public/tenup.js") + "\n;" + asset(ctx, "public/summary.js")
                + "\n;monteeSummary(" + JSONObject.quote(payload) + "," + JSONObject.quote(state == null ? "{}" : state) + ",null);";
        final String[] value = {null};
        final CountDownLatch latch = new CountDownLatch(1);
        final Handler main = new Handler(Looper.getMainLooper());
        final WebView[] holder = {null};
        main.post(() -> {
            WebView w = new WebView(ctx);
            holder[0] = w;
            w.getSettings().setJavaScriptEnabled(true);
            w.setWebViewClient(new WebViewClient() {
                boolean done = false;

                @Override
                public void onPageFinished(WebView view, String url) {
                    if (done) return;
                    done = true;
                    view.evaluateJavascript(src, v -> { value[0] = v; latch.countDown(); });
                }
            });
            w.loadDataWithBaseURL("https://localhost/", "<html><body></body></html>", "text/html", "utf-8", null);
        });
        try { latch.await(20, TimeUnit.SECONDS); } catch (InterruptedException ignored) {}
        main.post(() -> { if (holder[0] != null) holder[0].destroy(); });
        try {
            String v = value[0];
            if (v == null || !v.startsWith("\"")) return null;
            String json = new JSONArray("[" + v + "]").getString(0);
            JSONObject o = new JSONObject(json);
            if (o.has("state")) MonteeStore.put(ctx, "state", o.getString("state"));
            // 3.49 : la notification principale + les autres (poule, joueurs suivis, jalons…), 4 au plus par relance
            java.util.ArrayList<String> out = new java.util.ArrayList<>();
            if (o.has("title") && o.has("body")) { out.add(o.getString("title")); out.add(o.getString("body")); }
            JSONArray more = o.optJSONArray("more");
            if (more != null) for (int i = 0; i < more.length(); i++) {
                JSONObject m = more.optJSONObject(i);
                if (m != null && m.has("title") && m.has("body")) { out.add(m.getString("title")); out.add(m.getString("body")); }
            }
            if (out.isEmpty()) return null;
            return out.subList(0, Math.min(out.size(), 8)).toArray(new String[0]);
        } catch (Exception e) {
            return null;
        }
    }
}
