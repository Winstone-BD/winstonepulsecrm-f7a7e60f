package com.winstone.connect.data.sync

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import androidx.work.Data
import androidx.work.WorkInfo
import androidx.work.WorkManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Sends waiting call reports again the moment the internet comes back.
 *
 * WorkManager already keeps report jobs until the network is connected, but a
 * job that failed while offline waits out an exponential backoff (up to hours)
 * even after the signal returns. This keeps a copy of each queued report job
 * (no audio, only the already-validated payload with its fixed owner and ids)
 * and, on reconnect, re-queues only jobs that are still waiting on a backoff.
 *
 * Safe to resend: the same unique name, report id and call_uid travel with the
 * job, so the CRM's idempotent intake records each report once. Jobs that are
 * running, finished, or stopped as permanent failures are never resent.
 */
object ReportReplay {
    private const val PREFS = "report_replay"
    private const val DEBOUNCE_MS = 4_000L

    /** Report kinds that are part of a call's audit trail and safe to replay. */
    val REPLAYABLE = setOf(
        CallSyncQueue.KIND_REPORT_OPEN,
        CallSyncQueue.KIND_REPORT_SUBMIT,
        CallSyncQueue.KIND_LEAD_SUBMIT,
    )

    enum class Action { RESEND, KEEP, FORGET }

    /**
     * What to do with one remembered job on reconnect.
     * [state] is the WorkInfo state name, or null when WorkManager has no record.
     */
    fun decide(state: String?, runAttemptCount: Int): Action = when (state) {
        null, "SUCCEEDED", "FAILED", "CANCELLED" -> Action.FORGET
        "ENQUEUED" -> if (runAttemptCount > 0) Action.RESEND else Action.KEEP
        else -> Action.KEEP // RUNNING / BLOCKED: let it finish
    }

    /** Called by CallSyncQueue when a replayable job is queued. */
    fun remember(context: Context, unique: String, data: Data) {
        if (data.getString(CallSyncQueue.KEY_KIND) !in REPLAYABLE) return
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(unique, android.util.Base64.encodeToString(data.toByteArray(), android.util.Base64.NO_WRAP))
            .apply()
    }

    fun forgetAll(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
    }

    /** Re-queues remembered report jobs that are stuck in backoff. Returns how many were resent. */
    fun resendWaiting(context: Context): Int {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val wm = WorkManager.getInstance(context)
        var resent = 0
        for ((unique, encoded) in prefs.all) {
            val info: WorkInfo? = runCatching { wm.getWorkInfosForUniqueWork(unique).get() }
                .getOrNull()?.lastOrNull()
            when (decide(info?.state?.name, info?.runAttemptCount ?: 0)) {
                Action.FORGET -> prefs.edit().remove(unique).apply()
                Action.KEEP -> Unit
                Action.RESEND -> {
                    val data = runCatching {
                        Data.fromByteArray(android.util.Base64.decode(encoded as String, android.util.Base64.NO_WRAP))
                    }.getOrNull()
                    if (data == null) {
                        prefs.edit().remove(unique).apply()
                    } else {
                        CallSyncQueue.requeueNow(context, unique, data)
                        resent++
                    }
                }
            }
        }
        return resent
    }

    // ---- reconnect triggers ----

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var pending: Job? = null

    /** Debounced: a flapping connection triggers one resend, not many. */
    @Synchronized
    fun onReconnected(context: Context) {
        val app = context.applicationContext
        pending?.cancel()
        pending = scope.launch {
            delay(DEBOUNCE_MS)
            runCatching { resendWaiting(app) }
        }
    }

    /** Listens for the phone's internet becoming usable again (validated network). */
    fun watch(context: Context) {
        val app = context.applicationContext
        val cm = app.getSystemService(ConnectivityManager::class.java) ?: return
        runCatching {
            cm.registerDefaultNetworkCallback(object : ConnectivityManager.NetworkCallback() {
                private var validated = false
                override fun onCapabilitiesChanged(network: Network, caps: NetworkCapabilities) {
                    val now = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
                    if (now && !validated) onReconnected(app)
                    validated = now
                }
                override fun onLost(network: Network) { validated = false }
            })
        }
    }
}
