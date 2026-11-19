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
}
