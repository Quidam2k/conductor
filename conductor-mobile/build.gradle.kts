// Root build file for Conductor Mobile KMM project
plugins {
    kotlin("multiplatform") version "2.0.0" apply false
    kotlin("plugin.serialization") version "2.0.0" apply false
    kotlin("android") version "2.0.0" apply false
    id("com.google.devtools.ksp") version "2.0.0-1.0.21" apply false
    id("com.android.library") version "8.1.0" apply false
    id("com.android.application") version "8.1.0" apply false
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

tasks.register("clean", Delete::class) {
    delete(rootProject.layout.buildDirectory)
}
