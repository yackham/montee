package fr.montennis.app;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.TimeUnit;

/**
 * Toutes les heures environ (Android 15 et plus, lecture en arrière-plan autorisée) :
 * nouvelle séance de tennis dans Health Connect → notification. Les jours de match sont ignorés.
 */
public class MonteeHealthWorker extends Worker {
    static final String NAME = "montee-sante";

    public MonteeHealthWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    static void schedule(Context ctx) {
        PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(MonteeHealthWorker.class, 1, TimeUnit.HOURS)
                .setInitialDelay(15, TimeUnit.MINUTES)
                .build();
        WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(NAME, ExistingPeriodicWorkPolicy.KEEP, req);
    }

    static void cancel(Context ctx) {
        WorkManager.getInstance(ctx).cancelUniqueWork(NAME);
    }

    static Set<String> set(Context ctx, String key) {
        Set<String> out = new HashSet<>();
        try {
            String s = MonteeStore.get(ctx, key);
            if (s == null) return out;
            JSONArray a = new JSONArray(s);
            for (int i = 0; i < a.length(); i++) out.add(a.optString(i));
        } catch (Exception ignored) {
        }
        return out;
    }

    static String day(long ms) {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.FRANCE).format(new Date(ms));
    }

    /** « Hier, 19 h · 1 h 30 » */
    static String label(long start, long end) {
        Calendar c = Calendar.getInstance(), now = Calendar.getInstance();
        c.setTimeInMillis(start);
        String d;
        int diff = (int) ((startOfDay(now) - startOfDay(c)) / 86400000L);
        if (diff == 0) d = "Aujourd'hui";
        else if (diff == 1) d = "Hier";
        else d = new SimpleDateFormat("EEEE d MMMM", Locale.FRANCE).format(new Date(start));
        d = d.substring(0, 1).toUpperCase(Locale.FRANCE) + d.substring(1);
        int h = c.get(Calendar.HOUR_OF_DAY), m = c.get(Calendar.MINUTE);
        String hour = h + " h" + (m > 0 ? String.format(Locale.FRANCE, " %02d", m) : "");
        long mins = Math.max(0, (end - start) / 60000L);
        String dur = mins >= 60 ? (mins / 60) + " h" + (mins % 60 > 0 ? String.format(Locale.FRANCE, " %02d", mins % 60) : "") : mins + " min";
        return d + ", " + hour + " · " + dur;
    }

    static long startOfDay(Calendar c) {
        Calendar x = (Calendar) c.clone();
        x.set(Calendar.HOUR_OF_DAY, 0); x.set(Calendar.MINUTE, 0); x.set(Calendar.SECOND, 0); x.set(Calendar.MILLISECOND, 0);
        return x.getTimeInMillis();
    }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        if (!MonteeStore.flag(ctx, "healthOn") || !MonteeStore.flag(ctx, "healthNotify") || !MonteeHealth.background(ctx)) return Result.success();
        JSONArray list = MonteeHealth.readTennis(ctx, 3);
        if (list == null) return Result.success();
        Set<String> known = set(ctx, "healthKnown"), notified = set(ctx, "healthNotified"), matchDays = set(ctx, "healthMatchDays");
        long since = 0;
        try { String s = MonteeStore.get(ctx, "healthSince"); if (s != null) since = Long.parseLong(s); } catch (Exception ignored) {}
        JSONObject best = null;
        int count = 0;
        for (int i = 0; i < list.length(); i++) {
            JSONObject o = list.optJSONObject(i);
            if (o == null) continue;
            String id = o.optString("id");
            long start = o.optLong("start"), end = o.optLong("end");
            if (id.isEmpty() || known.contains(id) || notified.contains(id)) continue;
            if (start < since || matchDays.contains(day(start))) continue;
            if (end - start < 10 * 60000L) continue; // moins de 10 minutes : sans doute un faux départ
            count++;
            if (best == null || start > best.optLong("start")) best = o;
            notified.add(id);
        }
        if (best == null) return Result.success();
        JSONArray n = new JSONArray();
        for (String s : notified) n.put(s);
        MonteeStore.put(ctx, "healthNotified", n.toString());
        String title = count > 1 ? count + " nouvelles séances de tennis" : "Nouvelle séance de tennis";
        String body = label(best.optLong("start"), best.optLong("end")) + ". Touche pour l'ajouter à tes entraînements, avec ta raquette.";
        MonteeNotify.show(ctx, MonteeNotify.CHANNEL_SANTE, title, body, "montee://open/sante/nouvelle");
        return Result.success();
    }
}
