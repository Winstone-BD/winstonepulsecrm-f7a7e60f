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
