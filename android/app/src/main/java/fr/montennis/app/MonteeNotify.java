package fr.montennis.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

final class MonteeNotify {
    private MonteeNotify() {}

    static final String CHANNEL = "montee-matchs";
    private static int seq = 0; // 3.49 : plusieurs notifications d'une même relance ne s'écrasent pas
    static final String CHANNEL_SANTE = "montee-sante";

    static void show(Context ctx, String title, String body) {
        show(ctx, CHANNEL, title, body, null);
    }

    /** url : adresse montee://… ouverte au toucher (même chemin que les widgets). */
    static void show(Context ctx, String channel, String title, String body, String url) {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        NotificationManagerCompat nm = NotificationManagerCompat.from(ctx);
        if (!nm.areNotificationsEnabled()) return;
        if (Build.VERSION.SDK_INT >= 26) {
            boolean sante = CHANNEL_SANTE.equals(channel);
            NotificationChannel ch = new NotificationChannel(sante ? CHANNEL_SANTE : CHANNEL, sante ? "Nouvelles séances (santé connectée)" : "Nouveaux matchs", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription(sante ? "Séance de tennis détectée par ta montre ou ton téléphone, à ajouter à tes entraînements" : "Nouveau match détecté sur Ten'Up, points, montée ou pas");
            ctx.getSystemService(NotificationManager.class).createNotificationChannel(ch);
        }
        PendingIntent pi;
        if (url != null) {
            pi = MonteeWidgets.open(ctx, url);
        } else {
            Intent open = new Intent(ctx, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            pi = PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        }
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, channel == null ? CHANNEL : channel)
                .setSmallIcon(R.drawable.ic_stat_montee)
                .setColor(0xFF1F5C3F)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setContentIntent(pi)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true);
        try {
            nm.notify((int) ((System.currentTimeMillis() + (seq++)) % 100000), b.build());
        } catch (SecurityException ignored) {
        }
    }
}
