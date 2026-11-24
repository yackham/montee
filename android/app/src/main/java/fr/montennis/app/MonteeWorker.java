package fr.montennis.app;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.OneTimeWorkRequest;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/** En arrière-plan (toutes les 3 h environ, quand Android le permet) : nouveaux matchs et notification. */
public class MonteeWorker extends Worker {
    static final String NAME = "montee-refresh";
    /** 4.5.0 : relance calée sur un moment utile (≈ 2 h 30 après un match prévu, matin de la sortie du classement). */
    static final String TAG_AT = "montee-refresh-at";

    public MonteeWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    static void schedule(Context ctx) {
        Constraints c = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(MonteeWorker.class, 3, TimeUnit.HOURS)
                .setConstraints(c)
                .setInitialDelay(1, TimeUnit.HOURS)
                .build();
        WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(NAME, ExistingPeriodicWorkPolicy.KEEP, req);
    }

    /**
     * 4.5.0 : une relance par moment utile (liste « ms,ms,… » envoyée par l'appli), d'ici 14 jours, 8 au plus.
     * Chaque moment a son propre nom : rien n'est remplacé ni annulé pendant qu'il tourne.
     * Appelé seulement depuis l'appli (setState), jamais depuis une relance en cours.
     */
    static void scheduleMoments(Context ctx) {
        WorkManager wm = WorkManager.getInstance(ctx);
        wm.cancelAllWorkByTag(TAG_AT); // les moments d'avant (match déplacé ou supprimé)
        String m = MonteeStore.get(ctx, "moments");
        if (m == null || m.isEmpty()) return;
        long now = System.currentTimeMillis();
        Constraints c = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        int n = 0;
        for (String x : m.split(",")) {
            long t;
            try { t = Long.parseLong(x.trim()); } catch (NumberFormatException e) { continue; }
            if (t <= now + 5 * 60000L || t - now > 14L * 86400000L) continue;
            OneTimeWorkRequest req = new OneTimeWorkRequest.Builder(MonteeWorker.class)
                    .setConstraints(c)
                    .addTag(TAG_AT)
                    .setInitialDelay(t - now, TimeUnit.MILLISECONDS)
                    .build();
            wm.enqueueUniqueWork(TAG_AT + "-" + t, ExistingWorkPolicy.KEEP, req);
            if (++n >= 8) break;
        }
    }

    static void cancel(Context ctx) {
        WorkManager.getInstance(ctx).cancelUniqueWork(NAME);
        WorkManager.getInstance(ctx).cancelAllWorkByTag(TAG_AT);
    }

    /** Lecture silencieuse de Ten'Up ; à appeler hors du fil principal. */
    static String fetch(final Context ctx, final String script, long timeoutSec) {
        return fetch(ctx, null, script, timeoutSec);
    }

    static String fetch(final Context ctx, final android.app.Activity activity, final String script, long timeoutSec) {
        final String[] out = {null};
        final CountDownLatch latch = new CountDownLatch(1);
        final Handler main = new Handler(Looper.getMainLooper());
        final TenupWeb[] holder = {null};
        main.post(() -> {
            TenupWeb tw = new TenupWeb(activity != null ? activity : ctx, script);
            holder[0] = tw;
            tw.listener = text -> { out[0] = text; latch.countDown(); return true; };
            tw.attachHidden(activity);
            tw.load();
        });
        try { latch.await(timeoutSec, TimeUnit.SECONDS); } catch (InterruptedException ignored) {}
        main.post(() -> { if (holder[0] != null) holder[0].destroy(); });
        return out[0] == null ? "MONTEE-ERR délai dépassé" : out[0];
    }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        String script = MonteeStore.get(ctx, "script");
        String state = MonteeStore.get(ctx, "state");
        if (script == null || state == null) return Result.success();
        String text = fetch(ctx, script, 40);
        if (text.startsWith("MONTEE1")) {
            MonteeStore.put(ctx, "pending", text);
            String[] note = MonteeSummary.compute(ctx, text, MonteeStore.get(ctx, "state"));
            int sent = 0;
            if (note != null) for (int i = 0; i + 1 < note.length; i += 2) { MonteeNotify.show(ctx, note[i], note[i + 1]); sent++; }
            MonteeStore.log(ctx, sent > 0 ? "notif:" + sent : "rien");
        } else if (text.contains("connecte-toi")) {
            MonteeStore.log(ctx, "deconnecte");
            if (!MonteeStore.flag(ctx, "expiredNotified")) {
                MonteeStore.flag(ctx, "expiredNotified", true);
                MonteeNotify.show(ctx, "Ten'Up t'a déconnecté", "Ouvre Montée et reconnecte-toi pour suivre tes nouveaux matchs.");
            }
        } else {
            MonteeStore.log(ctx, text.contains("délai") ? "timeout" : text.contains("maintenance") ? "maintenance" : "erreur");
        }
        return Result.success();
    }
}
