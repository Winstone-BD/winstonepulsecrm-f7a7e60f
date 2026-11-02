# Keep all app classes (JSON field names, Compose, receivers/services named in the manifest).
-keep class com.winstone.connect.** { *; }
-keepattributes Signature,*Annotation*,InnerClasses,EnclosingMethod
# OkHttp / Okio optional platform classes
-dontwarn okhttp3.internal.platform.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
# Tink (used by androidx.security-crypto for the Keystore-backed token store) references
# compile-time-only Error Prone annotations; they are not needed at runtime.
-dontwarn com.google.errorprone.annotations.**
# Appwrite Android SDK (connectivity test): Gson parses its error/JSON replies via reified
# TypeToken generics, which R8 would otherwise strip.
-keep class io.appwrite.** { *; }
-keep class com.google.gson.reflect.TypeToken { *; }
-keep class * extends com.google.gson.reflect.TypeToken
