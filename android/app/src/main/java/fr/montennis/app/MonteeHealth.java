package fr.montennis.app;

import android.content.Context;
import android.content.pm.PackageManager;
import android.health.connect.HealthConnectException;
import android.health.connect.HealthConnectManager;
import android.health.connect.ReadRecordsRequestUsingFilters;
import android.health.connect.ReadRecordsResponse;
import android.health.connect.TimeInstantRangeFilter;
import android.health.connect.datatypes.Device;
import android.health.connect.datatypes.ExerciseSessionRecord;
import android.health.connect.datatypes.ExerciseSessionType;
import android.health.connect.datatypes.Metadata;
import android.os.Build;
import android.os.OutcomeReceiver;

import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;
import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/**
 * Santé connectée (Health Connect, intégré à Android 14 et plus) : lecture seule des séances de tennis.
 * Montée n'écrit rien et n'envoie rien : les séances sont seulement proposées dans l'app.
 */
final class MonteeHealth {
    private MonteeHealth() {}

    static final String READ_EXERCISE = "android.permission.health.READ_EXERCISE";
    static final String READ_BACKGROUND = "android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND";
    static final String READ_HR = "android.permission.health.READ_HEART_RATE";
    static final String READ_KCAL = "android.permission.health.READ_ACTIVE_CALORIES_BURNED";
    static final String READ_HISTORY = "android.permission.health.READ_HEALTH_DATA_HISTORY";
    static final String READ_REST = "android.permission.health.READ_RESTING_HEART_RATE";

    static boolean hrGranted(Context ctx) {
        return supported() && ContextCompat.checkSelfPermission(ctx, READ_HR) == PackageManager.PERMISSION_GRANTED;
    }

    /** Health Connect est intégré au système à partir d'Android 14. */
    static boolean supported() {
        return Build.VERSION.SDK_INT >= 34;
    }

    static boolean granted(Context ctx) {
        return supported() && ContextCompat.checkSelfPermission(ctx, READ_EXERCISE) == PackageManager.PERMISSION_GRANTED;
    }

    /** Lecture en arrière-plan : Android 15 et plus, sur autorisation. */
    static boolean background(Context ctx) {
        return Build.VERSION.SDK_INT >= 35 && granted(ctx)
                && ContextCompat.checkSelfPermission(ctx, READ_BACKGROUND) == PackageManager.PERMISSION_GRANTED;
    }

    static String[] permissions() {
        // 3.53 : + fréquence cardiaque, calories ; l'historique (au-delà de 30 jours) existe à partir d'Android 15
        return Build.VERSION.SDK_INT >= 35 ? new String[]{READ_EXERCISE, READ_BACKGROUND, READ_HR, READ_KCAL, READ_REST, READ_HISTORY} : new String[]{READ_EXERCISE, READ_HR, READ_KCAL, READ_REST};
    }

    /** 3.53 : fréquence cardiaque entre deux instants (ms) : t = secondes depuis le début, v = bpm ; calories actives. */
    static JSONObject readHR(Context ctx, long startMs, long endMs) {
        if (!supported()) return null;
        return HRReader.read(ctx, startMs, endMs);
    }

    /** 3.53.3 : FC de repos moyenne des 30 derniers jours (zones Karvonen). -1 si rien. */
    static double readRest(Context ctx) {
        if (!supported() || ContextCompat.checkSelfPermission(ctx, READ_REST) != PackageManager.PERMISSION_GRANTED) return -1;
        return RestReader.read(ctx);
    }

    /** 3.53.3 : FC max mesurée sur 12 mois (agrégat Health Connect). -1 si rien. */
    static long readMax(Context ctx) {
        if (!hrGranted(ctx)) return -1;
        return MaxReader.read(ctx);
    }

    @RequiresApi(api = 34)
    private static final class MaxReader {
        static long read(Context ctx) {
            final HealthConnectManager hcm = ctx.getSystemService(HealthConnectManager.class);
            if (hcm == null) return -1;
            final long[] out = {-1};
            final ExecutorService ex = Executors.newSingleThreadExecutor();
            try {
                final CountDownLatch l = new CountDownLatch(1);
                Instant end = Instant.now(), start = end.minus(365, ChronoUnit.DAYS);
                android.health.connect.AggregateRecordsRequest<Long> req = new android.health.connect.AggregateRecordsRequest.Builder<Long>(
                        new TimeInstantRangeFilter.Builder().setStartTime(start).setEndTime(end).build())
                        .addAggregationType(android.health.connect.datatypes.HeartRateRecord.BPM_MAX)
                        .build();
                hcm.aggregate(req, ex, new OutcomeReceiver<android.health.connect.AggregateRecordsResponse<Long>, HealthConnectException>() {
                    @Override
                    public void onResult(android.health.connect.AggregateRecordsResponse<Long> res) {
                        try { Long v = res.get(android.health.connect.datatypes.HeartRateRecord.BPM_MAX); if (v != null) out[0] = v; } catch (Exception ignored) {}
                        l.countDown();
                    }

                    @Override
                    public void onError(@NonNull HealthConnectException e) { l.countDown(); }
                });
                l.await(20, TimeUnit.SECONDS);
            } catch (Exception ignored) {
            } finally {
                ex.shutdown();
            }
            return out[0];
        }
    }

    @RequiresApi(api = 34)
    private static final class RestReader {
        static double read(Context ctx) {
            final HealthConnectManager hcm = ctx.getSystemService(HealthConnectManager.class);
            if (hcm == null) return -1;
            final double[] sum = {0, 0};
            final ExecutorService ex = Executors.newSingleThreadExecutor();
            try {
                final CountDownLatch l = new CountDownLatch(1);
                Instant end = Instant.now(), start = end.minus(30, ChronoUnit.DAYS);
                ReadRecordsRequestUsingFilters<android.health.connect.datatypes.RestingHeartRateRecord> req =
                        new ReadRecordsRequestUsingFilters.Builder<>(android.health.connect.datatypes.RestingHeartRateRecord.class)
                                .setTimeRangeFilter(new TimeInstantRangeFilter.Builder().setStartTime(start).setEndTime(end).build())
                                .setPageSize(500)
                                .build();
                hcm.readRecords(req, ex, new OutcomeReceiver<ReadRecordsResponse<android.health.connect.datatypes.RestingHeartRateRecord>, HealthConnectException>() {
                    @Override
                    public void onResult(ReadRecordsResponse<android.health.connect.datatypes.RestingHeartRateRecord> res) {
                        try { for (android.health.connect.datatypes.RestingHeartRateRecord r : res.getRecords()) { sum[0] += r.getBeatsPerMinute(); sum[1]++; } } catch (Exception ignored) {}
                        l.countDown();
                    }

                    @Override
                    public void onError(@NonNull HealthConnectException e) { l.countDown(); }
                });
                l.await(20, TimeUnit.SECONDS);
            } catch (Exception ignored) {
            } finally {
                ex.shutdown();
            }
            return sum[1] > 0 ? sum[0] / sum[1] : -1;
        }
    }

    @RequiresApi(api = 34)
    private static final class HRReader {
        static JSONObject read(Context ctx, long startMs, long endMs) {
            final HealthConnectManager hcm = ctx.getSystemService(HealthConnectManager.class);
            if (hcm == null) return null;
            final Instant start = Instant.ofEpochMilli(startMs), end = Instant.ofEpochMilli(endMs);
            final JSONArray t = new JSONArray(), v = new JSONArray();
            final boolean[] watch = {false};
            final double[] kcal = {0};
            final ExecutorService ex = Executors.newSingleThreadExecutor();
            try {
                final CountDownLatch l1 = new CountDownLatch(1);
                ReadRecordsRequestUsingFilters<android.health.connect.datatypes.HeartRateRecord> req =
                        new ReadRecordsRequestUsingFilters.Builder<>(android.health.connect.datatypes.HeartRateRecord.class)
                                .setTimeRangeFilter(new TimeInstantRangeFilter.Builder().setStartTime(start).setEndTime(end).build())
                                .setPageSize(1000)
                                .build();
                hcm.readRecords(req, ex, new OutcomeReceiver<ReadRecordsResponse<android.health.connect.datatypes.HeartRateRecord>, HealthConnectException>() {
                    @Override
                    public void onResult(ReadRecordsResponse<android.health.connect.datatypes.HeartRateRecord> res) {
                        try {
                            for (android.health.connect.datatypes.HeartRateRecord r : res.getRecords()) {
                                Device dv = r.getMetadata().getDevice();
                                if (dv != null && dv.getType() == Device.DEVICE_TYPE_WATCH) watch[0] = true;
                                for (android.health.connect.datatypes.HeartRateRecord.HeartRateSample sm : r.getSamples()) {
                                    Instant at = sm.getTime();
                                    if (at.isBefore(start) || at.isAfter(end)) continue;
                                    t.put((at.toEpochMilli() - startMs) / 1000);
                                    v.put(sm.getBeatsPerMinute());
                                }
                            }
                        } catch (Exception ignored) {
                        }
                        l1.countDown();
                    }

                    @Override
                    public void onError(@NonNull HealthConnectException e) {
                        l1.countDown();
                    }
                });
                l1.await(20, TimeUnit.SECONDS);
                if (ContextCompat.checkSelfPermission(ctx, READ_KCAL) == PackageManager.PERMISSION_GRANTED) {
                    final CountDownLatch l2 = new CountDownLatch(1);
                    ReadRecordsRequestUsingFilters<android.health.connect.datatypes.ActiveCaloriesBurnedRecord> rk =
                            new ReadRecordsRequestUsingFilters.Builder<>(android.health.connect.datatypes.ActiveCaloriesBurnedRecord.class)
                                    .setTimeRangeFilter(new TimeInstantRangeFilter.Builder().setStartTime(start).setEndTime(end).build())
                                    .setPageSize(1000)
                                    .build();
                    hcm.readRecords(rk, ex, new OutcomeReceiver<ReadRecordsResponse<android.health.connect.datatypes.ActiveCaloriesBurnedRecord>, HealthConnectException>() {
                        @Override
                        public void onResult(ReadRecordsResponse<android.health.connect.datatypes.ActiveCaloriesBurnedRecord> res) {
                            try {
                                for (android.health.connect.datatypes.ActiveCaloriesBurnedRecord r : res.getRecords()) kcal[0] += r.getEnergy().getInCalories() / 1000.0;
                            } catch (Exception ignored) {
                            }
                            l2.countDown();
                        }

                        @Override
                        public void onError(@NonNull HealthConnectException e) {
                            l2.countDown();
                        }
                    });
                    l2.await(20, TimeUnit.SECONDS);
                }
                JSONObject o = new JSONObject();
                o.put("t", t);
                o.put("v", v);
                o.put("kcal", kcal[0]);
                o.put("watch", watch[0]);
                return o;
            } catch (Exception e) {
                return null;
            } finally {
                ex.shutdown();
            }
        }
    }

    /** Séances de tennis des `days` derniers jours (type tennis, ou titre contenant « tennis »). Null si erreur. */
    static JSONArray readTennis(Context ctx, int days) {
        JSONArray all = readAll(ctx, days);
        if (all == null) return null;
        JSONArray out = new JSONArray();
        for (int i = 0; i < all.length(); i++) {
            JSONObject o = all.optJSONObject(i);
            if (o != null && (o.optBoolean("tennis") || o.optString("title").toLowerCase(java.util.Locale.ROOT).contains("tennis"))) out.put(o);
        }
        return out;
    }

    /** Toutes les séances d'exercice des `days` derniers jours (le tri se fait dans l'app). À appeler hors du fil principal. */
    static JSONArray readAll(Context ctx, int days) {
        if (Build.VERSION.SDK_INT < 34 || !granted(ctx)) return null;
        return Reader.read(ctx, days);
    }

    /** Nom du type d'exercice (EXERCISE_SESSION_TYPE_TENNIS → « TENNIS »), lu dans les constantes du système. */
    static String typeName(int type) {
        try {
            for (java.lang.reflect.Field f : ExerciseSessionType.class.getFields()) {
                if (f.getType() == int.class && f.getName().startsWith("EXERCISE_SESSION_TYPE_") && f.getInt(null) == type)
                    return f.getName().substring("EXERCISE_SESSION_TYPE_".length());
            }
        } catch (Exception ignored) {
        }
        return String.valueOf(type);
    }

    @RequiresApi(api = 34)
    private static final class Reader {
        static JSONArray read(Context ctx, int days) {
            final HealthConnectManager hcm = ctx.getSystemService(HealthConnectManager.class);
            if (hcm == null) return null;
            final JSONArray out = new JSONArray();
            final boolean[] ok = {false};
            final CountDownLatch latch = new CountDownLatch(1);
            final ExecutorService ex = Executors.newSingleThreadExecutor();
            try {
                Instant end = Instant.now();
                Instant start = end.minus(Math.max(1, days), ChronoUnit.DAYS);
                ReadRecordsRequestUsingFilters<ExerciseSessionRecord> req =
                        new ReadRecordsRequestUsingFilters.Builder<>(ExerciseSessionRecord.class)
                                .setTimeRangeFilter(new TimeInstantRangeFilter.Builder().setStartTime(start).setEndTime(end).build())
                                .setPageSize(500)
                                .build();
                hcm.readRecords(req, ex, new OutcomeReceiver<ReadRecordsResponse<ExerciseSessionRecord>, HealthConnectException>() {
                    @Override
                    public void onResult(ReadRecordsResponse<ExerciseSessionRecord> res) {
                        try {
                            for (ExerciseSessionRecord r : res.getRecords()) {
                                int type = r.getExerciseType();
                                JSONObject o = new JSONObject();
                                o.put("type", type);
                                o.put("typeName", typeName(type));
                                o.put("tennis", type == ExerciseSessionType.EXERCISE_SESSION_TYPE_TENNIS);
                                Metadata md = r.getMetadata();
                                o.put("id", md.getId());
                                o.put("start", r.getStartTime().toEpochMilli());
                                o.put("end", r.getEndTime().toEpochMilli());
                                CharSequence t = r.getTitle();
                                if (t != null) o.put("title", t.toString());
                                if (md.getDataOrigin() != null) o.put("origin", md.getDataOrigin().getPackageName());
                                Device dv = md.getDevice();
                                if (dv != null) {
                                    String name = ((dv.getManufacturer() == null ? "" : dv.getManufacturer()) + " " + (dv.getModel() == null ? "" : dv.getModel())).trim();
                                    if (!name.isEmpty()) o.put("device", name);
                                    o.put("deviceType", dv.getType());
                                }
                                out.put(o);
                            }
                            ok[0] = true;
                        } catch (Exception ignored) {
                        }
                        latch.countDown();
                    }

                    @Override
                    public void onError(@NonNull HealthConnectException e) {
                        latch.countDown();
                    }
                });
                latch.await(20, TimeUnit.SECONDS);
            } catch (Exception ignored) {
            } finally {
                ex.shutdown();
            }
            return ok[0] ? out : null;
        }
    }
}
