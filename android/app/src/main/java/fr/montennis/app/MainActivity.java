package fr.montennis.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Le plugin maison doit être enregistré avant super.onCreate
        registerPlugin(TenupPlugin.class);
        super.onCreate(savedInstanceState);
        keepWidgetAction(getIntent());
        imeResize();
    }

    /** Edge-to-edge : le clavier ne redimensionne plus la WebView. On ajoute nous-mêmes
     *  une marge basse égale à la hauteur du clavier, pour que la page puisse défiler
     *  jusqu'au champ actif (ex. la note de revanche). */
    private void imeResize() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        final View wv = getBridge().getWebView();
        final View parent = (View) wv.getParent();
        ViewCompat.setOnApplyWindowInsetsListener(parent, (v, insets) -> {
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            Insets nav = insets.getInsets(WindowInsetsCompat.Type.navigationBars());
            int bottom = Math.max(ime.bottom - nav.bottom, 0);
            v.setPadding(0, 0, 0, insets.isVisible(WindowInsetsCompat.Type.ime()) ? bottom : 0);
            return insets;
        });
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        keepWidgetAction(intent);
    }

    /** Un widget a été touché : on garde l'action, l'app web la lit au réveil (Tenup.takeAction). */
    private void keepWidgetAction(Intent intent) {
        if (intent == null) return;
        // Health Connect demande « pourquoi Montée lit tes séances » : on ouvre la page Santé connectée
        if ("android.intent.action.VIEW_PERMISSION_USAGE".equals(intent.getAction())) {
            MonteeStore.put(this, "action", "montee://open/sante");
            return;
        }
        Uri u = intent.getData();
        if (u != null && "montee".equals(u.getScheme())) {
            MonteeStore.put(this, "action", u.toString());
            intent.setData(null);
        }
    }
}
