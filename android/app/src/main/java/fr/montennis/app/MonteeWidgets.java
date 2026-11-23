package fr.montennis.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;

/**
 * Widgets de l'écran d'accueil. L'app web dessine chaque widget en image (widgets.js,
 * aux couleurs du thème choisi) et l'envoie ici (Tenup.setWidgetImages) ; on ne fait que l'afficher.
 * Toucher un widget ouvre Montée sur le bon écran.
 */
public final class MonteeWidgets {
    private MonteeWidgets() {}

    /** Fournisseurs et nom du dessin correspondant (même nom que dans widgets.js). */
    static final Class<?>[] ALL = {
            WidgetClassement.class, WidgetSortie.class, WidgetCordage.class, WidgetForme.class, WidgetMini.class,
            WidgetSemaine.class, WidgetTableau.class, WidgetTruc.class, WidgetDefend.class, WidgetSac.class,
            WidgetJoueurs.class, WidgetAdversaire.class, WidgetObjectif.class, WidgetFaf.class,
            // 3.81
            WidgetAce.class, WidgetAvenir.class, WidgetEquipe.class, WidgetChances.class, WidgetSuivis.class
    };
    static final String[] KINDS = {"classement", "sortie", "cordage", "forme", "mini", "semaine", "tableau", "truc", "defend", "sac", "joueurs", "adversaire", "objectif", "faf", "ace", "avenir", "equipe", "chances", "suivis"};

    static String kindOf(Class<?> c) {
        for (int i = 0; i < ALL.length; i++) if (ALL[i] == c) return KINDS[i];
        return "classement";
    }

    static JSONObject data(Context ctx) {
        try {
            String s = MonteeStore.get(ctx, "widgets");
            return s == null ? new JSONObject() : new JSONObject(s);
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    static File imageFile(Context ctx, String kind) {
        File dir = new File(ctx.getFilesDir(), "widgets");
        if (!dir.exists()) dir.mkdirs();
        return new File(dir, kind + ".png");
    }

    /** Enregistre les images reçues de l'app web (base64 PNG). */
    static void saveImage(Context ctx, String kind, String b64) {
        try (FileOutputStream out = new FileOutputStream(imageFile(ctx, kind))) {
            out.write(Base64.decode(b64, Base64.DEFAULT));
        } catch (Exception ignored) {
        }
    }

    /** Widgets posés sur l'écran d'accueil, et leur taille en dp (la plus grande par type). */
    static JSONObject info(Context ctx) {
        JSONObject r = new JSONObject();
        try {
            AppWidgetManager m = AppWidgetManager.getInstance(ctx);
            org.json.JSONArray kinds = new org.json.JSONArray();
            JSONObject sizes = new JSONObject();
            for (int i = 0; i < ALL.length; i++) {
                int[] ids = m.getAppWidgetIds(new ComponentName(ctx, ALL[i]));
                if (ids == null || ids.length == 0) continue;
                kinds.put(KINDS[i]);
                int w = 0, h = 0;
                for (int id : ids) {
                    Bundle o = m.getAppWidgetOptions(id);
                    // en portrait : largeur mini, hauteur maxi
                    w = Math.max(w, o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0));
                    h = Math.max(h, o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0));
                }
                if (w > 40 && h > 40) sizes.put(KINDS[i], new org.json.JSONArray().put(w).put(h));
            }
            r.put("kinds", kinds);
            r.put("sizes", sizes);
            r.put("density", ctx.getResources().getDisplayMetrics().density);
        } catch (Exception ignored) {
        }
        return r;
    }

    static void updateAll(Context ctx) {
        AppWidgetManager m = AppWidgetManager.getInstance(ctx);
        for (Class<?> c : ALL) {
            int[] ids = m.getAppWidgetIds(new ComponentName(ctx, c));
            if (ids == null || ids.length == 0) continue;
            Intent i = new Intent(ctx, c).setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
            ctx.sendBroadcast(i);
        }
    }

    /** Ouvre Montée avec une adresse montee://… que l'app web exécute. */
    static PendingIntent open(Context ctx, String url) {
        Intent i = new Intent(ctx, MainActivity.class)
                .setAction(Intent.ACTION_VIEW)
                .setData(Uri.parse(url))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, url.hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Écran ouvert quand on touche le widget. */
    static String target(String kind, JSONObject d) {
        switch (kind) {
            case "cordage": {
                JSONObject r = d.optJSONObject("racket");
                return r == null ? "montee://open/raquette/new" : "montee://open/raquette/" + r.optString("id");
            }
            case "sac": return "montee://open/materiel";
            case "forme": return "montee://open/palmares";
            case "semaine": return "montee://open/materiel";
            case "truc": case "ace": return "montee://open/ace";
            case "avenir": case "equipe": return "montee://open/";
            case "chances": return "montee://open/projection";
            case "suivis": return "montee://open/faf?tab=suivis";
            case "defend": return "montee://open/courbes?to=defend";
            case "tableau": return "montee://open/";
            case "joueurs": return "montee://open/faf?focus=1";
            case "adversaire": {
                JSONObject o = d.optJSONObject("scout");
                return o == null || o.optString("id").isEmpty() ? "montee://open/faf?focus=1" : "montee://open/joueur/" + o.optString("id");
            }
            case "objectif": return "montee://open/objectif";
            case "faf": return "montee://open/faf?tab=adv";
            default: return "montee://open/projection";
        }
    }

    static RemoteViews build(Context ctx, String kind) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_img);
        JSONObject d = data(ctx);
        Bitmap b = null;
        File f = imageFile(ctx, kind);
        if (f.exists()) {
            try { b = BitmapFactory.decodeFile(f.getAbsolutePath()); } catch (Exception ignored) {}
        }
        if (b != null) {
            v.setImageViewBitmap(R.id.w_img, b);
            v.setViewVisibility(R.id.w_img, View.VISIBLE);
            v.setViewVisibility(R.id.w_empty, View.GONE);
        } else {
            v.setViewVisibility(R.id.w_img, View.GONE);
            v.setViewVisibility(R.id.w_empty, View.VISIBLE);
        }
        v.setOnClickPendingIntent(R.id.w_root, open(ctx, target(kind, d)));
        // « T'as joué ? » : zone de toucher en bas à droite du widget Semaine
        boolean ask = false;
        String slotUrl = null;
        if ("semaine".equals(kind)) {
            JSONObject w = d.optJSONObject("week");
            JSONObject sl = w == null ? null : w.optJSONObject("slot");
            if (sl != null && sl.optBoolean("ask", false)) {
                ask = true;
                slotUrl = "montee://slot/yes?id=" + Uri.encode(sl.optString("id")) + "&d=" + Uri.encode(sl.optString("date"));
            }
        }
        v.setViewVisibility(R.id.w_btn, ask && b != null ? View.VISIBLE : View.GONE);
        if (ask) v.setOnClickPendingIntent(R.id.w_btn, open(ctx, slotUrl));
        return v;
    }

    // ---------- Base commune ----------
    public abstract static class Base extends AppWidgetProvider {
        String kind() { return kindOf(getClass()); }

        @Override
        public void onUpdate(Context ctx, AppWidgetManager m, int[] ids) {
            for (int id : ids) {
                try { m.updateAppWidget(id, build(ctx, kind())); } catch (Exception ignored) {}
            }
        }

        @Override
        public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager m, int id, Bundle o) {
            // Taille changée : l'image actuelle est réajustée ; elle sera redessinée à la bonne taille à la prochaine ouverture
            try { m.updateAppWidget(id, build(ctx, kind())); } catch (Exception ignored) {}
        }
    }
}
