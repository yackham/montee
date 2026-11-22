package fr.montennis.app;

import android.content.Context;
import android.content.SharedPreferences;

/** Petites valeurs gardées par l'app native (script de lecture, état pour les notifications, import en attente). */
final class MonteeStore {
    private MonteeStore() {}

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences("montee", Context.MODE_PRIVATE);
    }

    static String get(Context ctx, String key) {
        return prefs(ctx).getString(key, null);
    }

    static void put(Context ctx, String key, String value) {
        SharedPreferences.Editor e = prefs(ctx).edit();
        if (value == null) e.remove(key); else e.putString(key, value);
        e.apply();
    }

    static boolean flag(Context ctx, String key) {
        return prefs(ctx).getBoolean(key, false);
    }

    static void flag(Context ctx, String key, boolean value) {
        prefs(ctx).edit().putBoolean(key, value).apply();
    }

    /** 3.69 : journal des passages d'arrière-plan (« heure|résultat »), les 12 derniers : sert à comprendre pourquoi peu de notifications arrivent. */
    static void log(Context ctx, String result) {
        String old = get(ctx, "bgLog");
        java.util.List<String> l = new java.util.ArrayList<>();
        if (old != null && !old.isEmpty()) for (String x : old.split("\n")) if (!x.isEmpty()) l.add(x);
        l.add(System.currentTimeMillis() / 1000 + "|" + result);
        while (l.size() > 12) l.remove(0);
        put(ctx, "bgLog", android.text.TextUtils.join("\n", l));
    }
}
