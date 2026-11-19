package fr.montennis.app;

import android.app.Activity;
import android.content.Context;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Soutenir Montée : achats intégrés « non consommables » (Google Play Billing).
 * Pas de serveur : l'achat est vérifié par Google Play, l'app lit simplement ce qui est possédé.
 */
public class MonteeBilling implements PurchasesUpdatedListener {
    interface Ready { void run(boolean ok); }

    private static MonteeBilling inst;
    private final BillingClient client;
    private PluginCall buyCall;
    private final List<Ready> waiting = new ArrayList<>();
    private boolean connecting = false;

    static synchronized MonteeBilling get(Context c) {
        if (inst == null) inst = new MonteeBilling(c.getApplicationContext());
        return inst;
    }

    private MonteeBilling(Context c) {
        client = BillingClient.newBuilder(c)
                .setListener(this)
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .build();
    }

    private synchronized void connect(Ready r) {
        if (client.isReady()) { r.run(true); return; }
        waiting.add(r);
        if (connecting) return;
        connecting = true;
        client.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult res) {
                done(res.getResponseCode() == BillingClient.BillingResponseCode.OK);
            }

            @Override
            public void onBillingServiceDisconnected() {
                done(false);
            }
        });
    }

    private void done(boolean ok) {
        List<Ready> list;
        synchronized (this) {
            connecting = false;
            list = new ArrayList<>(waiting);
            waiting.clear();
        }
        for (Ready r : list) r.run(ok);
    }

    private static QueryProductDetailsParams params(List<String> ids) {
        List<QueryProductDetailsParams.Product> list = new ArrayList<>();
        for (String id : ids) {
            list.add(QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(id)
                    .setProductType(BillingClient.ProductType.INAPP)
                    .build());
        }
        return QueryProductDetailsParams.newBuilder().setProductList(list).build();
    }

    /** Prix affichés par le Play Store (dans la devise du joueur). */
    void products(List<String> ids, PluginCall call) {
        connect(ok -> {
            if (!ok || ids.isEmpty()) { JSObject r = new JSObject(); r.put("products", new JSArray()); call.resolve(r); return; }
            client.queryProductDetailsAsync(params(ids), (res, result) -> {
                JSArray arr = new JSArray();
                List<ProductDetails> list = result == null ? null : result.getProductDetailsList();
                if (list != null) {
                    for (ProductDetails d : list) {
                        ProductDetails.OneTimePurchaseOfferDetails o = d.getOneTimePurchaseOfferDetails();
                        JSObject j = new JSObject();
                        j.put("id", d.getProductId());
                        j.put("price", o != null ? o.getFormattedPrice() : "");
                        arr.put(j);
                    }
                }
                JSObject r = new JSObject();
                r.put("products", arr);
                call.resolve(r);
            });
        });
    }

    /** Lance l'achat ; la réponse arrive dans onPurchasesUpdated. */
    void buy(Activity act, String id, PluginCall call) {
        connect(ok -> {
            if (!ok) { state(call, "error"); return; }
            client.queryProductDetailsAsync(params(Collections.singletonList(id)), (res, result) -> {
                List<ProductDetails> list = result == null ? null : result.getProductDetailsList();
                if (list == null || list.isEmpty()) { state(call, "error"); return; }
                BillingFlowParams p = BillingFlowParams.newBuilder()
                        .setProductDetailsParamsList(Collections.singletonList(
                                BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(list.get(0)).build()))
                        .build();
                act.runOnUiThread(() -> {
                    buyCall = call;
                    BillingResult r = client.launchBillingFlow(act, p);
                    if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        buyCall = null;
                        if (r.getResponseCode() == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) owned(call, "ok");
                        else state(call, "error");
                    }
                });
            });
        });
    }

    @Override
    public void onPurchasesUpdated(BillingResult res, List<Purchase> purchases) {
        PluginCall c = buyCall;
        buyCall = null;
        int code = res.getResponseCode();
        if (code == BillingClient.BillingResponseCode.OK && purchases != null) {
            boolean pending = false;
            for (Purchase p : purchases) {
                if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) acknowledge(p);
                else if (p.getPurchaseState() == Purchase.PurchaseState.PENDING) pending = true;
            }
            if (c != null) { if (pending) state(c, "pending"); else owned(c, "ok"); }
        } else if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
            if (c != null) state(c, "cancel");
        } else if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
            if (c != null) owned(c, "ok");
        } else if (c != null) {
            state(c, "error");
        }
    }

    /** Obligatoire sous 3 jours, sinon Google rembourse automatiquement. */
    private void acknowledge(Purchase p) {
        if (p.isAcknowledged()) return;
        client.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build(), r -> { });
    }

    /** Achats possédés (sert aussi à « Restaurer mes achats »). */
    void owned(PluginCall call, String st) {
        connect(ok -> {
            if (!ok) { JSObject r = new JSObject(); r.put("ids", new JSArray()); r.put("offline", true); if (st != null) r.put("state", st); call.resolve(r); return; }
            client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(), (res, list) -> {
                JSArray ids = new JSArray();
                if (list != null) {
                    for (Purchase p : list) {
                        if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) continue;
                        acknowledge(p);
                        for (String id : p.getProducts()) ids.put(id);
                    }
                }
                JSObject r = new JSObject();
                r.put("ids", ids);
                if (st != null) r.put("state", st);
                call.resolve(r);
            });
        });
    }

    private static void state(PluginCall call, String s) {
        JSObject r = new JSObject();
        r.put("state", s);
        call.resolve(r);
    }
}
