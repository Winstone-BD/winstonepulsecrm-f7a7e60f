import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

val localProps = Properties().apply {
    val f = rootProject.file("local.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}

android {
    namespace = "com.winstone.connect"
    compileSdk = 35
    // UI tests target only the offline, separately packaged sandbox.
    testBuildType = "sandbox"

    defaultConfig {
        applicationId = "com.winstone.connect"
        minSdk = 24
        targetSdk = 35
        versionCode = 33
        versionName = "2.22"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        val crmUrl = (localProps.getProperty("CRM_BASE_URL") ?: "https://crm.winstonebd.com").trimEnd('/')
        buildConfigField("String", "CRM_BASE_URL", "\"$crmUrl\"")
        // Appwrite connectivity test (public project config only; never an API key).
        val appwriteEndpoint = (localProps.getProperty("APPWRITE_ENDPOINT") ?: "https://fra.cloud.appwrite.io/v1").trimEnd('/')
        val appwriteProject = localProps.getProperty("APPWRITE_PROJECT_ID") ?: "6ae6cfc60036585efea9"
        buildConfigField("String", "APPWRITE_ENDPOINT", "\"$appwriteEndpoint\"")
        buildConfigField("String", "APPWRITE_PROJECT_ID", "\"$appwriteProject\"")
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    // Release signing comes only from the key custodian's local.properties RELEASE_* or
    // WINSTONE_* env (never committed). Without them the release build is left unsigned;
    // scripts/build-signed-apk.sh refuses it and verifies the approved signer fingerprint.
    fun cfg(env: String, prop: String): String? =
        System.getenv(env)?.takeIf { it.isNotBlank() } ?: localProps.getProperty(prop)?.takeIf { it.isNotBlank() }
    val ksPath = cfg("WINSTONE_KEYSTORE_PATH", "RELEASE_STORE_FILE")
    val storePass = cfg("WINSTONE_KEYSTORE_PASSWORD", "RELEASE_STORE_PASSWORD")
    signingConfigs {
        if (ksPath != null) create("release") {
            storeFile = file(ksPath)
            storePassword = storePass
            keyAlias = cfg("WINSTONE_KEY_ALIAS", "RELEASE_KEY_ALIAS")
            keyPassword = cfg("WINSTONE_KEY_PASSWORD", "RELEASE_KEY_PASSWORD") ?: storePass
        }
    }

    buildTypes {
        // Test build installs side by side with the agent release (own package id + name).
        debug {
            applicationIdSuffix = ".test"
            versionNameSuffix = "-test"
        }
        create("sandbox") {
            initWith(getByName("debug"))
            applicationIdSuffix = ".sandbox"
            versionNameSuffix = "-sandbox"
            matchingFallbacks += listOf("debug")
            buildConfigField("String", "CRM_BASE_URL", "\"https://invalid.invalid\"")
            buildConfigField("String", "APPWRITE_ENDPOINT", "\"https://invalid.invalid\"")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (ksPath != null) signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.10.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("androidx.work:work-runtime-ktx:2.9.1")
    implementation("androidx.datastore:datastore-preferences:1.1.1")
    implementation("androidx.security:security-crypto:1.0.0")
    // Official Appwrite Android SDK — connectivity test only. 24.0.0 is the newest release built
    // on Kotlin 1.9 / OkHttp 4.12 (25+ need Kotlin 2.2 + OkHttp 5, which this toolchain can't read).
    implementation("io.appwrite:sdk-for-android:24.0.0")

    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.2")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.1")
    androidTestImplementation(platform("androidx.compose:compose-bom:2024.10.01"))
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    add("sandboxImplementation", "androidx.compose.ui:ui-test-manifest")
}
