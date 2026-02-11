package com.conductor.mobile.sharing

import fi.iki.elonen.NanoHTTPD
import java.io.File
import java.io.FileInputStream

/**
 * Simple HTTP server that serves the APK file for download
 * Uses NanoHTTPD - lightweight, zero-dependency embedded server
 */
class ApkHttpServer(
    private val apkFile: File,
    port: Int = 8080
) : NanoHTTPD(port) {

    private val apkFileName = "conductor.apk"
    private var downloadCount = 0

    override fun serve(session: IHTTPSession): Response {
        return when (session.uri) {
            "/" -> serveIndexPage()
            "/$apkFileName", "/conductor.apk" -> serveApk()
            else -> newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "Not Found")
        }
    }

    private fun serveIndexPage(): Response {
        val html = """
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Conductor App Download</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        min-height: 100vh;
                        margin: 0;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .container {
                        background: white;
                        padding: 2rem;
                        border-radius: 16px;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                        text-align: center;
                        max-width: 90%;
                        width: 320px;
                    }
                    h1 {
                        margin: 0 0 0.5rem;
                        color: #333;
                    }
                    p {
                        color: #666;
                        margin: 0 0 1.5rem;
                    }
                    .download-btn {
                        display: inline-block;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        padding: 1rem 2rem;
                        border-radius: 8px;
                        text-decoration: none;
                        font-weight: bold;
                        font-size: 1.1rem;
                        transition: transform 0.2s, box-shadow 0.2s;
                    }
                    .download-btn:active {
                        transform: scale(0.98);
                    }
                    .instructions {
                        margin-top: 1.5rem;
                        padding: 1rem;
                        background: #f5f5f5;
                        border-radius: 8px;
                        font-size: 0.85rem;
                        text-align: left;
                    }
                    .instructions ol {
                        margin: 0.5rem 0 0;
                        padding-left: 1.2rem;
                    }
                    .instructions li {
                        margin: 0.3rem 0;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Conductor</h1>
                    <p>Coordinate synchronized actions</p>
                    <a href="/$apkFileName" class="download-btn">Download App</a>
                    <div class="instructions">
                        <strong>Installation:</strong>
                        <ol>
                            <li>Tap "Download App"</li>
                            <li>Open the downloaded file</li>
                            <li>If prompted, allow "Install from unknown sources"</li>
                            <li>Complete installation</li>
                        </ol>
                    </div>
                </div>
            </body>
            </html>
        """.trimIndent()

        return newFixedLengthResponse(Response.Status.OK, "text/html", html)
    }

    private fun serveApk(): Response {
        return try {
            if (!apkFile.exists()) {
                return newFixedLengthResponse(
                    Response.Status.NOT_FOUND,
                    "text/plain",
                    "APK file not found"
                )
            }

            downloadCount++
            val inputStream = FileInputStream(apkFile)
            val response = newChunkedResponse(
                Response.Status.OK,
                "application/vnd.android.package-archive",
                inputStream
            )
            response.addHeader("Content-Disposition", "attachment; filename=\"$apkFileName\"")
            response.addHeader("Content-Length", apkFile.length().toString())
            response
        } catch (e: Exception) {
            newFixedLengthResponse(
                Response.Status.INTERNAL_ERROR,
                "text/plain",
                "Error serving APK: ${e.message}"
            )
        }
    }

    /**
     * Get number of times APK has been downloaded
     */
    fun getDownloadCount(): Int = downloadCount

    /**
     * Get the URL for downloading the app
     */
    fun getDownloadUrl(hostAddress: String): String {
        return "http://$hostAddress:$listeningPort/"
    }
}
