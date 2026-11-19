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

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Montée+ sur Android : Google Play Billing (même logique que StoreKit sur iPhone, sans serveur).
 * Abonnements : plus_saison, plus_mois (type SUBS) ; achat à vie : plus_vie (type INAPP).
 */
public final class MonteeBilling implements PurchasesUpdatedListener {
    public interface Ready { void run(BillingClient c); }
    public interface Fail { void run(); }
    public interface Owned { void done(List<String> ids, boolean ok); }
    public interface Products { void done(List<ProductDetails> list); }
    public interface Bought { void done(String state, List<String> ids); }

    public static final List<String> SUBS = java.util.Arrays.asList("plus_saison", "plus_mois");
    public static final List<String> INAPP = java.util.Arrays.asList("plus_vie");

    private static MonteeBilling inst;
    public static synchronized MonteeBilling get(Context ctx) {
        if (inst == null) inst = new MonteeBilling(ctx.getApplicationContext());
        return inst;
    }

    private final BillingClient client;
    private Bought pending;

    private MonteeBilling(Context ctx) {
        client = BillingClient.newBuilder(ctx)
            .setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .build();
    }

    private void ready(final Ready ok, final Fail fail) {
        if (client.isReady()) { ok.run(client); return; }
        try {
            client.startConnection(new BillingClientStateListener() {
                private boolean done = false;
                @Override public void onBillingSetupFinished(BillingResult r) {
                    if (done) return; done = true;
                    if (r.getResponseCode() == BillingClient.BillingResponseCode.OK) ok.run(client); else fail.run();
                }
                @Override public void onBillingServiceDisconnected() { }
            });
        } catch (Exception e) { fail.run(); }
    }

    /** Détails des produits (prix affichés), abonnements puis achat unique. */
    public void products(final Products cb) {
        ready(c -> {
            final List<ProductDetails> out = Collections.synchronizedList(new ArrayList<>());
            // Billing 8 : la réponse est un QueryProductDetailsResult (produits trouvés + produits introuvables)
            c.queryProductDetailsAsync(params(SUBS, BillingClient.ProductType.SUBS), (r1, q1) -> {
                if (q1 != null && q1.getProductDetailsList() != null) out.addAll(q1.getProductDetailsList());
                c.queryProductDetailsAsync(params(INAPP, BillingClient.ProductType.INAPP), (r2, q2) -> {
                    if (q2 != null && q2.getProductDetailsList() != null) out.addAll(q2.getProductDetailsList());
                    cb.done(out);
                });
            });
        }, () -> cb.done(new ArrayList<>()));
    }

    private static QueryProductDetailsParams params(List<String> ids, String type) {
        List<QueryProductDetailsParams.Product> ps = new ArrayList<>();
        for (String id : ids) ps.add(QueryProductDetailsParams.Product.newBuilder().setProductId(id).setProductType(type).build());
        return QueryProductDetailsParams.newBuilder().setProductList(ps).build();
    }

    /** Prix lisible : le prix de base d'un abonnement (après l'essai gratuit), ou celui de l'achat unique. */
    public static String priceOf(ProductDetails d) {
        if (d.getOneTimePurchaseOfferDetails() != null) return d.getOneTimePurchaseOfferDetails().getFormattedPrice();
        List<ProductDetails.SubscriptionOfferDetails> offers = d.getSubscriptionOfferDetails();
        if (offers == null || offers.isEmpty()) return null;
        ProductDetails.SubscriptionOfferDetails base = offers.get(0);
        for (ProductDetails.SubscriptionOfferDetails o : offers) if (o.getOfferId() == null) { base = o; break; }
        List<ProductDetails.PricingPhase> ph = base.getPricingPhases().getPricingPhaseList();
        return ph.isEmpty() ? null : ph.get(ph.size() - 1).getFormattedPrice();
    }

    /** Achats et abonnements actifs (et accusés de réception, obligatoires sous 3 jours). */
    public void owned(final Owned cb) {
        ready(c -> {
            final Set<String> ids = Collections.synchronizedSet(new LinkedHashSet<>());
            c.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(), (r1, l1) -> {
                boolean ok1 = r1.getResponseCode() == BillingClient.BillingResponseCode.OK;
                collect(l1, ids);
                c.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(), (r2, l2) -> {
                    boolean ok2 = r2.getResponseCode() == BillingClient.BillingResponseCode.OK;
                    collect(l2, ids);
                    cb.done(new ArrayList<>(ids), ok1 && ok2);
                });
            });
        }, () -> cb.done(new ArrayList<>(), false));
    }

    private void collect(List<Purchase> list, Set<String> ids) {
        if (list == null) return;
        for (Purchase p : list) {
            if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) continue;
            ids.addAll(p.getProducts());
            ack(p);
        }
    }

    private void ack(Purchase p) {
        if (p.isAcknowledged()) return;
        try {
            client.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build(), r -> { });
        } catch (Exception ignored) { }
    }

    /** Lance l'achat ; pour un abonnement, l'offre d'essai gratuit si le joueur y a droit. */
    public void buy(final Activity act, final String id, final Bought cb) {
        products(list -> {
            ProductDetails pd = null;
            for (ProductDetails d : list) if (d.getProductId().equals(id)) pd = d;
            // 3.46.3 : on dit pourquoi (aucun produit = Play Billing indisponible ou produits inactifs ; ce produit absent = pas encore actif)
            if (pd == null) { cb.done(list.isEmpty() ? "unavailable" : "noproduct", null); return; }
            BillingFlowParams.ProductDetailsParams.Builder b = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(pd);
            List<ProductDetails.SubscriptionOfferDetails> offers = pd.getSubscriptionOfferDetails();
            if (offers != null && !offers.isEmpty()) {
                ProductDetails.SubscriptionOfferDetails pick = null;
                for (ProductDetails.SubscriptionOfferDetails o : offers) {
                    for (ProductDetails.PricingPhase ph : o.getPricingPhases().getPricingPhaseList()) if (ph.getPriceAmountMicros() == 0) { pick = o; break; }
                    if (pick != null) break;
                }
                if (pick == null) for (ProductDetails.SubscriptionOfferDetails o : offers) if (o.getOfferId() == null) { pick = o; break; }
                if (pick == null) pick = offers.get(0);
                b.setOfferToken(pick.getOfferToken());
            }
            List<BillingFlowParams.ProductDetailsParams> one = new ArrayList<>();
            one.add(b.build());
            final BillingFlowParams fp = BillingFlowParams.newBuilder().setProductDetailsParamsList(one).build();
            act.runOnUiThread(() -> {
                pending = cb;
                BillingResult r = client.launchBillingFlow(act, fp);
                if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) { pending = null; cb.done(r.getResponseCode() == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED ? "ok" : "error:" + r.getResponseCode(), null); }
            });
        });
    }

    @Override
    public void onPurchasesUpdated(BillingResult r, List<Purchase> purchases) {
        final Bought cb = pending; pending = null;
        int code = r.getResponseCode();
        if (code == BillingClient.BillingResponseCode.USER_CANCELED) { if (cb != null) cb.done("cancel", null); return; }
        if (code == BillingClient.BillingResponseCode.OK || code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
            boolean wait = false;
            if (purchases != null) for (Purchase p : purchases) {
                if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) ack(p);
                else if (p.getPurchaseState() == Purchase.PurchaseState.PENDING) wait = true;
            }
            final boolean w = wait;
            owned((ids, ok) -> { if (cb != null) cb.done(w && ids.isEmpty() ? "pending" : "ok", ids); });
            return;
        }
        if (cb != null) cb.done("error:" + code, null);
    }
}
