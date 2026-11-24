package fr.montennis.app;

import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import android.graphics.Color;
import android.view.View;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.graphics.Insets;
import android.webkit.CookieManager;
import android.webkit.WebStorage;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.PermissionState;
import com.getcapacitor.JSArray;
import android.Manifest;
import android.database.Cursor;
import android.provider.CalendarContract;
import androidx.appcompat.app.AlertDialog;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.TimeZone;

/** Plugin appelé depuis l'app web (même interface que sur iPhone). */
@CapacitorPlugin(name = "Tenup", permissions = {
    @Permission(alias = "calendar", strings = { Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR })
})
public class TenupPlugin extends Plugin {

    @PluginMethod
    public void connect(final PluginCall call) {
        final String script = call.getString("script");
        if (script == null || script.isEmpty()) { call.reject("script manquant"); return; }
        final Context ctx = getContext();
        MonteeStore.put(ctx, "script", script);
        getActivity().runOnUiThread(() -> {
            TenupActivity.script = script;
            TenupActivity.callback = text -> {
                JSObject r = new JSObject();
                if (text != null) {
                    MonteeStore.flag(ctx, "expiredNotified", false);
                    r.put("data", text);
                } else {
                    r.put("cancelled", true);
                }
                call.resolve(r);
            };
            getActivity().startActivity(new Intent(getActivity(), TenupActivity.class));
        });
    }

    @PluginMethod
    public void refresh(final PluginCall call) {
        String s = call.getString("script");
        if (s == null || s.isEmpty()) s = MonteeStore.get(getContext(), "script");
        if (s == null || s.isEmpty()) { call.reject("script manquant"); return; }
        final String script = s;
        final Context ctx = getContext();
        final android.app.Activity activity = getActivity();
        MonteeStore.put(ctx, "script", script);
        new Thread(() -> {
            String text = MonteeWorker.fetch(ctx, activity, script, 25);
            JSObject r = new JSObject();
            r.put("data", text);
            call.resolve(r);
        }).start();
    }

    /** Requête ponctuelle sur Ten'Up (recherche de joueur, fiche d'un joueur) : le script n'est pas mémorisé. */
    @PluginMethod
    public void query(final PluginCall call) {
        final String script = call.getString("script");
        if (script == null || script.isEmpty()) { call.reject("script manquant"); return; }
        final Context ctx = getContext();
        final android.app.Activity activity = getActivity();
        new Thread(() -> {
            String text = MonteeWorker.fetch(ctx, activity, script, 30);
            JSObject r = new JSObject();
            r.put("data", text);
            call.resolve(r);
        }).start();
    }

    /** 3.69 : les notifications sont-elles autorisées, l'économiseur de batterie laisse-t-il Montée travailler, et le journal des derniers passages. */
    @PluginMethod
    public void bgStatus(PluginCall call) {
        Context ctx = getContext();
        JSObject out = new JSObject();
        try {
            out.put("notif", androidx.core.app.NotificationManagerCompat.from(ctx).areNotificationsEnabled() ? "granted" : "denied");
            android.os.PowerManager pm = (android.os.PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
            out.put("battery", pm != null && pm.isIgnoringBatteryOptimizations(ctx.getPackageName()) ? "free" : "optimized");
        } catch (Exception e) { /* tant pis : le journal reste utile */ }
        String log = MonteeStore.get(ctx, "bgLog");
        com.getcapacitor.JSArray arr = new com.getcapacitor.JSArray();
        if (log != null && !log.isEmpty()) for (String x : log.split("\n")) arr.put(x);
        out.put("log", arr);
        call.resolve(out);
    }

    @PluginMethod
    public void setState(PluginCall call) {
        Context ctx = getContext();
        String state = call.getString("state");
        String script = call.getString("script");
        if (state != null) MonteeStore.put(ctx, "state", state);
        if (script != null && !script.isEmpty()) MonteeStore.put(ctx, "script", script);
        MonteeWorker.schedule(ctx);
        call.resolve();
    }

    @PluginMethod
    public void takePending(PluginCall call) {
        Context ctx = getContext();
        String pending = MonteeStore.get(ctx, "pending");
        JSObject r = new JSObject();
        if (pending != null) {
            MonteeStore.put(ctx, "pending", null);
            r.put("data", pending);
        }
        call.resolve(r);
    }

    @PluginMethod
    public void setWidgets(PluginCall call) {
        String data = call.getString("data");
        if (data != null) MonteeStore.put(getContext(), "widgets", data);
        MonteeWidgets.updateAll(getContext());
        call.resolve();
    }

    /** Widgets posés sur l'écran d'accueil et leur taille, pour que l'app les dessine au bon format. */
    @PluginMethod
    public void widgetInfo(PluginCall call) {
        try {
            call.resolve(JSObject.fromJSONObject(MonteeWidgets.info(getContext())));
        } catch (Exception e) {
            call.resolve(new JSObject());
        }
    }

    /** Images des widgets dessinées par l'app (PNG en base64), plus les données utiles aux zones de toucher. */
    @PluginMethod
    public void setWidgetImages(PluginCall call) {
        Context ctx = getContext();
        String data = call.getString("data");
        if (data != null) MonteeStore.put(ctx, "widgets", data);
        JSObject imgs = call.getObject("images");
        if (imgs != null) {
            java.util.Iterator<String> it = imgs.keys();
            while (it.hasNext()) {
                String k = it.next();
                String b64 = imgs.optString(k, null);
                if (b64 != null && !b64.isEmpty()) MonteeWidgets.saveImage(ctx, k, b64);
            }
        }
        MonteeWidgets.updateAll(ctx);
        call.resolve();
    }

    @PluginMethod
    public void takeAction(PluginCall call) {
        Context ctx = getContext();
        String a = MonteeStore.get(ctx, "action");
        JSObject r = new JSObject();
        if (a != null) {
            MonteeStore.put(ctx, "action", null);
            r.put("action", a);
        }
        call.resolve(r);
    }

    /** 4.4.6 : demande de note du Play Store (fenêtre de Google, qui décide seule de l'afficher). */
    @PluginMethod
    public void askReview(PluginCall call) {
        try {
            com.google.android.play.core.review.ReviewManager rm = com.google.android.play.core.review.ReviewManagerFactory.create(getContext());
            rm.requestReviewFlow().addOnCompleteListener(task -> {
                if (!task.isSuccessful() || getActivity() == null) { JSObject r = new JSObject(); r.put("shown", false); call.resolve(r); return; }
                rm.launchReviewFlow(getActivity(), task.getResult()).addOnCompleteListener(t2 -> { JSObject r = new JSObject(); r.put("shown", true); call.resolve(r); });
            });
        } catch (Exception e) { JSObject r = new JSObject(); r.put("shown", false); call.resolve(r); }
    }

    /** Partager Montée : sélecteur de partage Android avec un texte (et son lien). */
    @PluginMethod
    public void shareText(PluginCall call) {
        try {
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("text/plain");
            send.putExtra(Intent.EXTRA_TEXT, call.getString("text", ""));
            send.putExtra(Intent.EXTRA_SUBJECT, call.getString("title", "Montée"));
            getActivity().startActivity(Intent.createChooser(send, call.getString("title", "Partager Montée")));
            call.resolve();
        } catch (Exception e) {
            call.reject("Partage impossible : " + e.getMessage());
        }
    }

    /** Carte du mois : image PNG (base64) partagée avec le sélecteur Android (Instagram, WhatsApp, Galerie…). */
    @PluginMethod
    public void shareImage(final PluginCall call) {
        try {
            String b64 = call.getString("base64", "");
            byte[] bytes = android.util.Base64.decode(b64, android.util.Base64.DEFAULT);
            Context ctx = getContext();
            File f = new File(ctx.getCacheDir(), call.getString("name", "montee-carte.png"));
            try (FileOutputStream os = new FileOutputStream(f)) { os.write(bytes); }
            Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", f);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("image/png");
            send.putExtra(Intent.EXTRA_STREAM, uri);
            String text = call.getString("text", "");
            if (text != null && !text.isEmpty()) send.putExtra(Intent.EXTRA_TEXT, text);
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(send, "Partager ta carte");
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(chooser);
            call.resolve();
        } catch (Exception e) {
            call.reject("Partage impossible : " + e.getMessage());
        }
    }

    /** Sauvegarde : enregistre le fichier dans Téléchargements (Android 10+), sinon ouvre le partage. */
    // 4.0 : plusieurs dates d'un coup dans le calendrier choisi par le joueur.
    @PluginMethod
    public void addEvents(final PluginCall call) {
        JSArray list = call.getArray("events");
        if (list == null || list.length() == 0) { call.reject("vide"); return; }
        if (getPermissionState("calendar") != PermissionState.GRANTED) {
            requestPermissionForAlias("calendar", call, "calendarPermsDone");
            return;
        }
        pickCalendar(call);
    }

    @PermissionCallback
    private void calendarPermsDone(final PluginCall call) {
        if (getPermissionState("calendar") == PermissionState.GRANTED) pickCalendar(call);
        else call.reject("denied");
    }

    private void pickCalendar(final PluginCall call) {
        final ArrayList<Long> ids = new ArrayList<>();
        final ArrayList<String> labels = new ArrayList<>();
        int primary = 0;
        String[] cols = { CalendarContract.Calendars._ID, CalendarContract.Calendars.CALENDAR_DISPLAY_NAME, CalendarContract.Calendars.ACCOUNT_NAME, CalendarContract.Calendars.IS_PRIMARY };
        String sel = CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL + " >= " + CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR + " AND " + CalendarContract.Calendars.VISIBLE + " = 1";
        try (Cursor c = getContext().getContentResolver().query(CalendarContract.Calendars.CONTENT_URI, cols, sel, null, null)) {
            while (c != null && c.moveToNext()) {
                String name = c.getString(1), acc = c.getString(2);
                if (c.getInt(3) == 1 && primary == 0) primary = ids.size();
                ids.add(c.getLong(0));
                labels.add(name == null ? "Calendrier" : (acc != null && !acc.equals(name) && acc.contains("@") ? name + " · " + acc : name));
            }
        } catch (Exception e) { call.reject("nocal"); return; }
        if (ids.isEmpty()) { call.reject("nocal"); return; }
        final int def = primary;
        getActivity().runOnUiThread(() -> {
            final boolean[] done = { false };
            new AlertDialog.Builder(getActivity())
                .setTitle("Dans quel calendrier ?")
                .setItems(labels.toArray(new String[0]), (d, w) -> {
                    done[0] = true;
                    insertEvents(call, ids.get(w), labels.get(w));
                })
                .setNegativeButton("Annuler", null)
                .setOnDismissListener(d -> {
                    if (!done[0]) { JSObject r = new JSObject(); r.put("cancelled", true); call.resolve(r); }
                })
                .show();
        });
    }

    private void insertEvents(final PluginCall call, long calId, String calName) {
        JSArray list = call.getArray("events");
        int added = 0;
        try {
            for (int k = 0; k < list.length(); k++) {
                JSONObject e = list.getJSONObject(k);
                boolean allDay = e.optBoolean("allDay", false);
                long st = e.optLong("start", 0), en = e.optLong("end", 0);
                if (en <= st) en = st + 2 * 3600_000L;
                ContentValues v = new ContentValues();
                v.put(CalendarContract.Events.CALENDAR_ID, calId);
                v.put(CalendarContract.Events.TITLE, e.optString("title", "Tennis"));
                String loc = e.optString("loc", ""), notes = e.optString("notes", "");
                if (!loc.isEmpty()) v.put(CalendarContract.Events.EVENT_LOCATION, loc);
                if (!notes.isEmpty()) v.put(CalendarContract.Events.DESCRIPTION, notes);
                if (allDay) {
                    // un événement « journée entière » se cale sur minuit UTC
                    v.put(CalendarContract.Events.DTSTART, toUtcMidnight(st));
                    v.put(CalendarContract.Events.DTEND, toUtcMidnight(en));
                    v.put(CalendarContract.Events.ALL_DAY, 1);
                    v.put(CalendarContract.Events.EVENT_TIMEZONE, "UTC");
                } else {
                    v.put(CalendarContract.Events.DTSTART, st);
                    v.put(CalendarContract.Events.DTEND, en);
                    v.put(CalendarContract.Events.EVENT_TIMEZONE, TimeZone.getDefault().getID());
                }
                int alarm = e.optInt("alarmMin", 0);
                if (alarm > 0) v.put(CalendarContract.Events.HAS_ALARM, 1);
                Uri uri = getContext().getContentResolver().insert(CalendarContract.Events.CONTENT_URI, v);
                if (uri == null) continue;
                added++;
                if (alarm > 0) {
                    ContentValues r = new ContentValues();
                    r.put(CalendarContract.Reminders.EVENT_ID, Long.parseLong(uri.getLastPathSegment()));
                    r.put(CalendarContract.Reminders.MINUTES, alarm);
                    r.put(CalendarContract.Reminders.METHOD, CalendarContract.Reminders.METHOD_ALERT);
                    try { getContext().getContentResolver().insert(CalendarContract.Reminders.CONTENT_URI, r); } catch (Exception ignored) {}
                }
            }
        } catch (Exception e) {
            if (added == 0) { call.reject("Impossible d'ajouter : " + e.getMessage()); return; }
        }
        JSObject r = new JSObject(); r.put("added", added); r.put("calendar", calName); call.resolve(r);
    }

    private static long toUtcMidnight(long localMs) {
        java.util.Calendar l = java.util.Calendar.getInstance();
        l.setTimeInMillis(localMs);
        java.util.Calendar u = java.util.Calendar.getInstance(TimeZone.getTimeZone("UTC"));
        u.clear();
        u.set(l.get(java.util.Calendar.YEAR), l.get(java.util.Calendar.MONTH), l.get(java.util.Calendar.DAY_OF_MONTH));
        return u.getTimeInMillis();
    }

    @PluginMethod
    public void saveFile(final PluginCall call) {
        String name = call.getString("name", "montee-sauvegarde.json");
        String content = call.getString("content", "");
        String mime = call.getString("mime", "application/json");
        boolean share = Boolean.TRUE.equals(call.getBoolean("share", false));
        Context ctx = getContext();
        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        if (!share && Build.VERSION.SDK_INT >= 29) {
            try {
                ContentValues v = new ContentValues();
                v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                Uri uri = ctx.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (uri == null) throw new Exception("insert");
                try (OutputStream os = ctx.getContentResolver().openOutputStream(uri)) { os.write(bytes); }
                JSObject r = new JSObject(); r.put("saved", "downloads"); call.resolve(r);
                return;
            } catch (Exception e) { /* on bascule sur le partage */ }
        }
        try {
            File f = new File(ctx.getCacheDir(), name);
            try (FileOutputStream os = new FileOutputStream(f)) { os.write(bytes); }
            Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", f);
            // 3.94 : un fichier calendrier s'ouvre directement dans l'appli d'agenda quand il y en a une
            if ("text/calendar".equals(mime)) {
                Intent view = new Intent(Intent.ACTION_VIEW);
                view.setDataAndType(uri, mime);
                view.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                try {
                    getActivity().startActivity(view);
                    JSObject r = new JSObject(); r.put("saved", "calendar"); call.resolve(r);
                    return;
                } catch (android.content.ActivityNotFoundException e) { /* pas d'agenda qui ouvre les .ics : on partage */ }
            }
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType(mime);
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.putExtra(Intent.EXTRA_SUBJECT, name);
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(send, "text/calendar".equals(mime) ? "Ajouter à ton agenda" : "application/pdf".equals(mime) ? "Partager ton bilan" : "Enregistrer la sauvegarde");
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(chooser);
            JSObject r = new JSObject(); r.put("saved", "share"); call.resolve(r);
        } catch (Exception e) {
            call.reject("Impossible d'enregistrer : " + e.getMessage());
        }
    }

    /** 3.47 : Ten'Up resté sur sa page de maintenance ou sa file d'attente : on vide le cache des pages web
     *  et la file d'attente Queue-it, sans toucher à la connexion Ten'Up ni aux données de Montée. */
    @PluginMethod
    public void resetWeb(final PluginCall call) {
        final Context ctx = getContext();
        getActivity().runOnUiThread(() -> {
            try { android.webkit.WebView w = new android.webkit.WebView(ctx); w.clearCache(true); w.destroy(); } catch (Exception ignored) { }
            CookieManager cm = CookieManager.getInstance();
            for (String host : new String[] { "https://tenup.fft.fr", "https://fft.fr" }) {
                String all = cm.getCookie(host);
                if (all == null) continue;
                for (String kv : all.split(";")) {
                    String name = kv.split("=")[0].trim();
                    if (!name.toLowerCase().startsWith("queueit")) continue;
                    cm.setCookie(host, name + "=; Max-Age=0; path=/");
                    cm.setCookie(host, name + "=; Max-Age=0; path=/; domain=.fft.fr");
                }
            }
            cm.flush();
            call.resolve();
        });
    }

    /** Hauteurs des barres système (en pixels physiques) → variables CSS en px CSS. */
    private void pushInsets(int topPx, int bottomPx) {
        final View wv = getBridge().getWebView();
        if (wv == null) return;
        float d = getContext().getResources().getDisplayMetrics().density;
        final String js = "document.documentElement.style.setProperty('--sat','" + Math.round(topPx / d) + "px');"
            + "document.documentElement.style.setProperty('--sab','" + Math.round(bottomPx / d) + "px');";
        wv.post(() -> getBridge().getWebView().evaluateJavascript(js, null));
    }

    @PluginMethod
    public void logout(final PluginCall call) {
        Context ctx = getContext();
        MonteeStore.put(ctx, "state", null);
        MonteeStore.put(ctx, "pending", null);
        MonteeWorker.cancel(ctx);
        getActivity().runOnUiThread(() -> {
            // Seulement Ten'Up : les données de Montée (stockage de l'app) ne sont pas touchées
            WebStorage.getInstance().deleteOrigin("https://tenup.fft.fr");
            CookieManager.getInstance().removeAllCookies(ok -> {
                CookieManager.getInstance().flush();
                call.resolve();
            });
        });
    }

    /** 4.3 : barres système transparentes, la page passe dessous (bord à bord), comme sur iPhone.
     *  La couleur du thème reste en fond de fenêtre (visible seulement si la page est plus courte que l'écran).
     *  La hauteur réelle des barres est poussée dans la page en --sat / --sab (env() n'est pas fiable dans la WebView). */
    private boolean insetsHooked = false;
    @PluginMethod
    public void setBars(final PluginCall call) {
        final String hex = call.getString("color", "#F6F2EC");
        final boolean light = call.getBoolean("light", true);
        getActivity().runOnUiThread(() -> {
            try {
                int c = Color.parseColor(hex);
                Window w = getActivity().getWindow();
                WindowCompat.setDecorFitsSystemWindows(w, false);
                w.setStatusBarColor(Color.TRANSPARENT);
                w.setNavigationBarColor(Color.TRANSPARENT);
                if (Build.VERSION.SDK_INT >= 29) { w.setStatusBarContrastEnforced(false); w.setNavigationBarContrastEnforced(false); }
                w.getDecorView().setBackgroundColor(c);
                final View wv = getBridge().getWebView();
                if (wv != null) {
                    wv.setBackgroundColor(c);
                    if (wv.getParent() instanceof View) ((View) wv.getParent()).setBackgroundColor(c);
                    if (!insetsHooked) {
                        insetsHooked = true;
                        ViewCompat.setOnApplyWindowInsetsListener(wv, (v, insets) -> {
                            Insets b = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
                            pushInsets(b.top, b.bottom);
                            return insets;
                        });
                    }
                    ViewCompat.requestApplyInsets(wv);
                    WindowInsetsCompat cur = ViewCompat.getRootWindowInsets(wv);
                    if (cur != null) {
                        Insets b = cur.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
                        pushInsets(b.top, b.bottom);
                    }
                }
                WindowInsetsControllerCompat ic = WindowCompat.getInsetsController(w, w.getDecorView());
                ic.setAppearanceLightStatusBars(light);
                ic.setAppearanceLightNavigationBars(light);
            } catch (Exception e) { /* couleur invalide : on ignore */ }
            call.resolve();
        });
    }

    // ---------- Santé connectée (Health Connect, Android 14+) ----------

    @PluginMethod
    public void healthStatus(PluginCall call) {
        Context ctx = getContext();
        JSObject r = new JSObject();
        r.put("supported", MonteeHealth.supported());
        r.put("granted", MonteeHealth.granted(ctx));
        r.put("background", MonteeHealth.background(ctx));
        r.put("bgPossible", Build.VERSION.SDK_INT >= 35);
        r.put("sdk", Build.VERSION.SDK_INT);
        r.put("hr", MonteeHealth.hrGranted(ctx));
        call.resolve(r);
    }

    /** Ouvre la demande d'autorisation (écran Health Connect). L'app web relit l'état au retour. */
    @PluginMethod
    public void healthRequest(PluginCall call) {
        if (!MonteeHealth.supported()) { call.reject("Santé connectée : Android 14 ou plus"); return; }
        final android.app.Activity a = getActivity();
        a.runOnUiThread(() -> {
            try {
                androidx.core.app.ActivityCompat.requestPermissions(a, MonteeHealth.permissions(), 4711);
            } catch (Exception ignored) {}
        });
        call.resolve();
    }

    /** Réglages des autorisations de Montée dans Health Connect (si la demande a été refusée). */
    /** 4.4.6 : réglages des notifications de Montée (pour les rallumer après un refus). */
    @PluginMethod
    public void notifSettings(PluginCall call) {
        final android.app.Activity a = getActivity();
        a.runOnUiThread(() -> {
            try {
                Intent i = new Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                i.putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, a.getPackageName());
                a.startActivity(i);
            } catch (Exception e) {
                try { a.startActivity(new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + a.getPackageName()))); } catch (Exception ignored) {}
            }
        });
        call.resolve();
    }

    @PluginMethod
    public void healthSettings(PluginCall call) {
        final android.app.Activity a = getActivity();
        a.runOnUiThread(() -> {
            try {
                Intent i = new Intent("android.health.connect.action.MANAGE_HEALTH_PERMISSIONS");
                i.putExtra(Intent.EXTRA_PACKAGE_NAME, a.getPackageName());
                a.startActivity(i);
            } catch (Exception e) {
                try { a.startActivity(new Intent("android.health.connect.action.HEALTH_HOME_SETTINGS")); } catch (Exception ignored) {}
            }
        });
        call.resolve();
    }

    /** Séances de tennis des derniers jours (lecture seule). */
    @PluginMethod
    public void healthRead(final PluginCall call) {
        final Context ctx = getContext();
        final int days = call.getInt("days", 30);
        new Thread(() -> {
            org.json.JSONArray list = MonteeHealth.readAll(ctx, days);
            JSObject r = new JSObject();
            if (list == null) { r.put("error", MonteeHealth.granted(ctx) ? "lecture impossible" : "non autorisé"); }
            else r.put("sessions", list.toString());
            call.resolve(r);
        }).start();
    }

    /** 3.53.3 : FC de repos (Health Connect ne donne pas la date de naissance). */
    @PluginMethod
    public void healthProfile(final PluginCall call) {
        final Context ctx = getContext();
        new Thread(() -> {
            JSObject r = new JSObject();
            double rest = MonteeHealth.readRest(ctx);
            if (rest > 0) r.put("rest", rest);
            long mx = MonteeHealth.readMax(ctx);
            if (mx > 0) r.put("max", mx);
            call.resolve(r);
        }).start();
    }

    /** 3.53 : fréquence cardiaque d'un match (start / end en ms). */
    @PluginMethod
    public void healthHR(final PluginCall call) {
        final Context ctx = getContext();
        final Double a = call.getDouble("start"), b = call.getDouble("end");
        if (a == null || b == null || b <= a) { JSObject r = new JSObject(); r.put("error", "dates"); call.resolve(r); return; }
        if (!MonteeHealth.hrGranted(ctx)) { JSObject r = new JSObject(); r.put("error", "non autorisé"); call.resolve(r); return; }
        new Thread(() -> {
            org.json.JSONObject o = MonteeHealth.readHR(ctx, a.longValue(), b.longValue());
            if (o == null) { JSObject r = new JSObject(); r.put("error", "lecture impossible"); call.resolve(r); return; }
            try { call.resolve(JSObject.fromJSONObject(o)); } catch (Exception e) { JSObject r = new JSObject(); r.put("error", "lecture impossible"); call.resolve(r); }
        }).start();
    }

    /** L'app web partage ce que le travail en arrière-plan doit savoir : séances déjà traitées, jours de match. */
    @PluginMethod
    public void healthSync(PluginCall call) {
        Context ctx = getContext();
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        boolean notify = Boolean.TRUE.equals(call.getBoolean("notify", true));
        MonteeStore.flag(ctx, "healthOn", on);
        MonteeStore.flag(ctx, "healthNotify", notify);
        String known = call.getString("known"), days = call.getString("matchDays"), since = call.getString("since");
        if (known != null) MonteeStore.put(ctx, "healthKnown", known);
        if (days != null) MonteeStore.put(ctx, "healthMatchDays", days);
        if (since != null) MonteeStore.put(ctx, "healthSince", since);
        if (on && notify && MonteeHealth.background(ctx)) MonteeHealthWorker.schedule(ctx); else MonteeHealthWorker.cancel(ctx);
        call.resolve();
    }

    // ---------- Montée+ : Google Play Billing (même interface que StoreKit sur iPhone) ----------
    @PluginMethod
    public void storeProducts(final PluginCall call) {
        MonteeBilling.get(getContext()).products(list -> {
            com.getcapacitor.JSArray arr = new com.getcapacitor.JSArray();
            for (com.android.billingclient.api.ProductDetails d : list) {
                String pr = MonteeBilling.priceOf(d);
                if (pr == null) continue;
                JSObject o = new JSObject(); o.put("id", d.getProductId()); o.put("price", pr); arr.put(o);
            }
            JSObject r = new JSObject(); r.put("products", arr); call.resolve(r);
        });
    }

    @PluginMethod
    public void storeBuy(final PluginCall call) {
        final String id = call.getString("id");
        if (id == null) { call.reject("produit manquant"); return; }
        MonteeBilling.get(getContext()).buy(getActivity(), id, (state, ids) -> {
            JSObject r = new JSObject(); r.put("state", state);
            if (ids != null) { com.getcapacitor.JSArray a = new com.getcapacitor.JSArray(); for (String x : ids) a.put(x); r.put("ids", a); }
            call.resolve(r);
        });
    }

    @PluginMethod
    public void storeOwned(final PluginCall call) {
        MonteeBilling.get(getContext()).owned((ids, ok) -> {
            JSObject r = new JSObject();
            if (!ok) { r.put("offline", true); call.resolve(r); return; }
            com.getcapacitor.JSArray a = new com.getcapacitor.JSArray(); for (String x : ids) a.put(x);
            r.put("ids", a); call.resolve(r);
        });
    }

    /** Gérer / résilier l'abonnement : la page « Abonnements » de Google Play pour Montée. */
    @PluginMethod
    public void storeManage(final PluginCall call) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/account/subscriptions?package=" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        } catch (Exception ignored) { }
        call.resolve();
    }
}
