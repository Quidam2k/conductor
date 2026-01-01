plugins {
    id("com.android.application")
    kotlin("android")
    id("com.google.devtools.ksp")
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.0"
    id("com.google.firebase.appdistribution") version "4.0.1"
}

android {
    namespace = "com.conductor.mobile"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.conductor.mobile"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0-alpha"
    }

    signingConfigs {
        create("release") {
            storeFile = file(project.findProperty("CONDUCTOR_KEYSTORE_FILE") ?: "keystore.jks")
            storePassword = project.findProperty("CONDUCTOR_KEYSTORE_PASSWORD") as String? ?: "conductor"
            keyAlias = project.findProperty("CONDUCTOR_KEY_ALIAS") as String? ?: "conductor"
            keyPassword = project.findProperty("CONDUCTOR_KEY_PASSWORD") as String? ?: "conductor"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("release")

            firebaseAppDistribution {
                artifactType = "APK"
                releaseNotesFile = "release-notes.txt"
                groups = "testers"
            }
        }
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
    }

    buildFeatures {
        compose = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation(project(":shared"))

    // Jetpack Compose
    implementation("androidx.compose.ui:ui:1.7.0")
    implementation("androidx.compose.material3:material3:1.3.0")
    implementation("androidx.compose.foundation:foundation:1.7.0")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.compose.runtime:runtime:1.7.0")
    implementation("androidx.compose.ui:ui-tooling-preview:1.7.0")
    implementation("androidx.compose.material:material-icons-extended:1.7.0")
    debugImplementation("androidx.compose.ui:ui-tooling:1.7.0")

    // Navigation
    implementation("androidx.navigation:navigation-compose:2.8.3")

    // Lifecycle & ViewModel
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    // DateTime
    implementation("org.jetbrains.kotlinx:kotlinx-datetime:0.6.1")

    // Room (SQLite)
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")

    // Camera for QR scanning
    implementation("androidx.camera:camera-core:1.3.0")
    implementation("androidx.camera:camera-camera2:1.3.0")
    implementation("androidx.camera:camera-lifecycle:1.3.0")
    implementation("androidx.camera:camera-view:1.3.0")

    // ML Kit Vision for QR code detection
    implementation("com.google.mlkit:vision-common:17.3.0")
    implementation("com.google.mlkit:barcode-scanning:17.2.0")

    // Testing
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
}
