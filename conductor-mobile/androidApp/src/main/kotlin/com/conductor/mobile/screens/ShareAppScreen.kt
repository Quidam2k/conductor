package com.conductor.mobile.screens

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.conductor.mobile.sharing.ApkSharingService
import com.conductor.mobile.theme.ConductorColors
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Screen for sharing the app via WiFi hotspot + HTTP server
 * Displays QR code with hotspot credentials and download URL
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShareAppScreen(
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    val sharingService = remember { ApkSharingService(context) }

    var isStarting by remember { mutableStateOf(false) }
    var isActive by remember { mutableStateOf(false) }
    var ssid by remember { mutableStateOf<String?>(null) }
    var password by remember { mutableStateOf<String?>(null) }
    var downloadUrl by remember { mutableStateOf<String?>(null) }
    var qrCodeBitmap by remember { mutableStateOf<Bitmap?>(null) }
    var wifiQrCodeBitmap by remember { mutableStateOf<Bitmap?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var downloadCount by remember { mutableIntStateOf(0) }
    var showWifiQr by remember { mutableStateOf(false) }

    // Permission state
    var hasLocationPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
        )
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        hasLocationPermission = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
    }

    // Update download count periodically when sharing
    LaunchedEffect(isActive) {
        while (isActive) {
            downloadCount = sharingService.getDownloadCount()
            delay(2000)
        }
    }

    // Cleanup on dispose
    DisposableEffect(Unit) {
        onDispose {
            sharingService.stopSharing()
        }
    }

    fun startSharing() {
        isStarting = true
        error = null
        coroutineScope.launch {
            val state = sharingService.startSharing()
            isStarting = false
            isActive = state.isActive
            ssid = state.ssid
            password = state.password
            downloadUrl = state.downloadUrl
            qrCodeBitmap = state.qrCodeBitmap
            wifiQrCodeBitmap = state.wifiQrCodeBitmap
            error = state.error
        }
    }

    fun stopSharing() {
        sharingService.stopSharing()
        isActive = false
        ssid = null
        password = null
        downloadUrl = null
        qrCodeBitmap = null
        wifiQrCodeBitmap = null
        downloadCount = 0
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Share App") },
                navigationIcon = {
                    IconButton(onClick = {
                        stopSharing()
                        onBack()
                    }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = if (isActive) ConductorColors.practiceGreen else MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            when {
                // Starting state
                isStarting -> {
                    Spacer(modifier = Modifier.weight(1f))
                    CircularProgressIndicator(
                        modifier = Modifier.size(64.dp)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Starting hotspot...",
                        style = MaterialTheme.typography.titleMedium
                    )
                    Spacer(modifier = Modifier.weight(1f))
                }

                // Active sharing state
                isActive && qrCodeBitmap != null -> {
                    ActiveSharingContent(
                        ssid = ssid!!,
                        password = password!!,
                        downloadUrl = downloadUrl!!,
                        qrCodeBitmap = qrCodeBitmap!!,
                        wifiQrCodeBitmap = wifiQrCodeBitmap,
                        downloadCount = downloadCount,
                        showWifiQr = showWifiQr,
                        onToggleQrType = { showWifiQr = !showWifiQr },
                        onStopSharing = { stopSharing() }
                    )
                }

                // Error state
                error != null -> {
                    Spacer(modifier = Modifier.weight(1f))
                    ErrorContent(
                        error = error!!,
                        hasLocationPermission = hasLocationPermission,
                        onRequestPermission = {
                            val permissions = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                                arrayOf(
                                    Manifest.permission.ACCESS_FINE_LOCATION,
                                    Manifest.permission.NEARBY_WIFI_DEVICES
                                )
                            } else {
                                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
                            }
                            permissionLauncher.launch(permissions)
                        },
                        onRetry = { startSharing() }
                    )
                    Spacer(modifier = Modifier.weight(1f))
                }

                // Initial state - not sharing
                else -> {
                    Spacer(modifier = Modifier.weight(1f))
                    InitialContent(
                        hasLocationPermission = hasLocationPermission,
                        onRequestPermission = {
                            val permissions = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                                arrayOf(
                                    Manifest.permission.ACCESS_FINE_LOCATION,
                                    Manifest.permission.NEARBY_WIFI_DEVICES
                                )
                            } else {
                                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
                            }
                            permissionLauncher.launch(permissions)
                        },
                        onStartSharing = { startSharing() }
                    )
                    Spacer(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun InitialContent(
    hasLocationPermission: Boolean,
    onRequestPermission: () -> Unit,
    onStartSharing: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(16.dp)
    ) {
        Text(
            text = "Share Conductor",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "Share this app with nearby phones without internet",
            style = MaterialTheme.typography.bodyLarge,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(32.dp))

        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = MaterialTheme.colorScheme.surfaceVariant,
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("How it works:", fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(8.dp))
                Text("1. Tap 'Start Sharing' to create a WiFi hotspot")
                Text("2. Recipient scans the QR code to connect")
                Text("3. Recipient downloads the app from the link")
                Text("4. No internet required!")
            }
        }

        Spacer(modifier = Modifier.height(32.dp))

        if (!hasLocationPermission) {
            Text(
                text = "Location permission is required for WiFi hotspot",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(8.dp))
            Button(onClick = onRequestPermission) {
                Text("Grant Permission")
            }
        } else {
            Button(
                onClick = onStartSharing,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = ConductorColors.practiceGreen
                )
            ) {
                Text("Start Sharing", style = MaterialTheme.typography.titleMedium)
            }
        }
    }
}

@Composable
private fun ActiveSharingContent(
    ssid: String,
    password: String,
    downloadUrl: String,
    qrCodeBitmap: Bitmap,
    wifiQrCodeBitmap: Bitmap?,
    downloadCount: Int,
    showWifiQr: Boolean,
    onToggleQrType: () -> Unit,
    onStopSharing: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Status indicator
        Surface(
            color = ConductorColors.practiceGreen.copy(alpha = 0.2f),
            shape = RoundedCornerShape(8.dp)
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(12.dp)
                        .background(ConductorColors.practiceGreen, RoundedCornerShape(6.dp))
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text("Sharing Active", color = ConductorColors.practiceGreen, fontWeight = FontWeight.Bold)
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // QR Code
        val currentBitmap = if (showWifiQr && wifiQrCodeBitmap != null) wifiQrCodeBitmap else qrCodeBitmap
        Surface(
            modifier = Modifier.size(280.dp),
            shape = RoundedCornerShape(16.dp),
            shadowElevation = 4.dp
        ) {
            Image(
                bitmap = currentBitmap.asImageBitmap(),
                contentDescription = "QR Code",
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp)
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        // QR type toggle
        if (wifiQrCodeBitmap != null) {
            TextButton(onClick = onToggleQrType) {
                Text(
                    text = if (showWifiQr) "Show Full Info QR" else "Show WiFi-Only QR",
                    style = MaterialTheme.typography.labelMedium
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Credentials card
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = MaterialTheme.colorScheme.surfaceVariant,
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                CredentialRow(label = "WiFi Name:", value = ssid)
                Spacer(modifier = Modifier.height(8.dp))
                CredentialRow(label = "Password:", value = password)
                Spacer(modifier = Modifier.height(8.dp))
                CredentialRow(label = "URL:", value = downloadUrl)
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Download count
        if (downloadCount > 0) {
            Text(
                text = "Downloads: $downloadCount",
                style = MaterialTheme.typography.titleMedium,
                color = ConductorColors.practiceGreen
            )
            Spacer(modifier = Modifier.height(16.dp))
        }

        // Instructions
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = MaterialTheme.colorScheme.secondaryContainer,
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Instructions for recipient:", fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(8.dp))
                Text("1. Scan QR code (or connect to WiFi manually)")
                Text("2. Open browser and go to the URL")
                Text("3. Tap 'Download App'")
                Text("4. Enable 'Install unknown apps' if prompted")
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Stop button
        Button(
            onClick = onStopSharing,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = ConductorColors.liveRed
            )
        ) {
            Text("Stop Sharing", style = MaterialTheme.typography.titleMedium)
        }
    }
}

@Composable
private fun CredentialRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
private fun ErrorContent(
    error: String,
    hasLocationPermission: Boolean,
    onRequestPermission: () -> Unit,
    onRetry: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(16.dp)
    ) {
        Text(
            text = "Unable to Start Sharing",
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.error
        )

        Spacer(modifier = Modifier.height(16.dp))

        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = MaterialTheme.colorScheme.errorContainer,
            shape = RoundedCornerShape(12.dp)
        ) {
            Text(
                text = error,
                modifier = Modifier.padding(16.dp),
                color = MaterialTheme.colorScheme.onErrorContainer
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        if (!hasLocationPermission || error.contains("Location permission", ignoreCase = true)) {
            Text(
                text = "WiFi hotspot requires location permission on Android.",
                style = MaterialTheme.typography.bodyMedium,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(16.dp))
            Button(onClick = onRequestPermission) {
                Text("Grant Permission")
            }
            Spacer(modifier = Modifier.height(8.dp))
        }

        OutlinedButton(onClick = onRetry) {
            Text("Try Again")
        }
    }
}
