package com.winstone.connect.data.remote

import android.content.Context
import com.winstone.connect.BuildConfig
import io.appwrite.Client
import io.appwrite.exceptions.AppwriteException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException

/**
 * Independent Appwrite connectivity test (project "My first project").
 *
 * Uses the official Appwrite Android SDK's `Client.ping()` (GET {endpoint}/ping).
 * Public project configuration only (BuildConfig APPWRITE_ENDPOINT / APPWRITE_PROJECT_ID);
 * no API key, no session, no CRM or customer data is ever sent to or stored in Appwrite.
 * The CRM backend, sign-in and sync paths are untouched.
 */
object AppwriteConnectivity {
    const val TIMEOUT_MS = 12_000L

    enum class Failure { NO_INTERNET, TIMEOUT, UNKNOWN_PLATFORM, PROJECT_NOT_FOUND, HTTP, UNEXPECTED }

    sealed interface Result {
        data class Ok(val response: String, val latencyMs: Long) : Result
        data class Failed(val kind: Failure, val code: Int?, val detail: String, val latencyMs: Long) : Result
    }

    /** Map an SDK / network error to a failure kind. Pure — JVM unit tested. */
    fun classify(error: Throwable): Pair<Failure, Int?> {
        var e: Throwable? = error
        var depth = 0
        while (e != null && depth < 6) {
            when (e) {
                is TimeoutCancellationException, is SocketTimeoutException -> return Failure.TIMEOUT to null
                is UnknownHostException -> return Failure.NO_INTERNET to null
                is AppwriteException -> {
                    val code = e.code?.takeIf { it > 0 }
                    return when {
                        e.type == "general_unknown_origin" -> Failure.UNKNOWN_PLATFORM to code
                        e.type == "project_not_found" -> Failure.PROJECT_NOT_FOUND to code
                        code != null -> Failure.HTTP to code
                        else -> Failure.UNEXPECTED to null
                    }
                }
                is IOException -> return Failure.NO_INTERNET to null
            }
            e = e.cause
            depth++
        }
        return Failure.UNEXPECTED to null
    }

    /** A success must be Appwrite's actual ping reply. */
    fun isPong(body: String?): Boolean = body?.contains("pong", ignoreCase = true) == true

    suspend fun ping(context: Context): Result = withContext(Dispatchers.IO) {
        val started = System.nanoTime()
        fun elapsed() = (System.nanoTime() - started) / 1_000_000
        try {
            val client = Client(context.applicationContext)
                .setEndpoint(BuildConfig.APPWRITE_ENDPOINT)
                .setProject(BuildConfig.APPWRITE_PROJECT_ID)
            val body = withTimeout(TIMEOUT_MS) { client.ping() }
            if (isPong(body)) {
                Result.Ok(body.trim().take(80), elapsed())
            } else {
                Result.Failed(Failure.UNEXPECTED, null, "Unexpected reply: ${body.take(120)}", elapsed())
            }
        } catch (t: Throwable) {
            val (kind, code) = classify(t)
            Result.Failed(kind, code, (t.message ?: t.javaClass.simpleName).take(240), elapsed())
        }
    }

    /** Agent-facing bilingual hint for each failure kind. */
    fun hint(kind: Failure): String = when (kind) {
        Failure.NO_INTERNET -> "Appwrite-এ পৌঁছানো যায়নি — ইন্টারনেট দেখুন। / Couldn't reach Appwrite — check the internet."
        Failure.TIMEOUT -> "Appwrite সময়মতো উত্তর দেয়নি। / Appwrite didn't answer in time."
        Failure.UNKNOWN_PLATFORM -> "এই অ্যাপটি Appwrite প্রজেক্টে Android platform হিসেবে যুক্ত নেই। / This app isn't registered as an Android platform in the Appwrite project."
        Failure.PROJECT_NOT_FOUND -> "Appwrite প্রজেক্ট আইডি পাওয়া যায়নি। / Appwrite project ID not found."
        Failure.HTTP -> "Appwrite ত্রুটি ফেরত দিয়েছে। / Appwrite returned an error."
        Failure.UNEXPECTED -> "অপ্রত্যাশিত উত্তর। / Unexpected result."
    }
}
