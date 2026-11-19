# Montée — règles R8
# On garde tout ce qui est appelé par nom (pont JavaScript, plugins, widgets, tâches en arrière-plan).

# Notre code natif : plugin Ten'Up, WebView Ten'Up, widgets, WorkManager, notifications
-keep class fr.montennis.app.** { *; }

# Capacitor et ses plugins (appelés depuis le JavaScript par réflexion)
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * { @com.getcapacitor.PluginMethod public *; }
-keep class org.apache.cordova.** { *; }

# Méthodes exposées à la page Ten'Up (MonteeBridge)
-keepclassmembers class * { @android.webkit.JavascriptInterface <methods>; }
-keepattributes *Annotation*, JavascriptInterface, Signature, InnerClasses, EnclosingMethod

# Numéros de ligne dans les rapports de plantage
-keepattributes SourceFile, LineNumberTable
-renamesourcefileattribute SourceFile

-dontwarn org.apache.cordova.**
-dontwarn com.getcapacitor.**
