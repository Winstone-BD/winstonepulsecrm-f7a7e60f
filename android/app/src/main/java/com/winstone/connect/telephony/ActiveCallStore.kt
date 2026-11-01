package com.winstone.connect.telephony

import android.content.Context

/**
 * What the phone knows about the call in progress, kept on disk.
 *
 * Android often kills the app process during a long call (some brands do it
 * within minutes). The hang-up broadcast then starts a fresh process with every
 * in-memory tracker empty, so an answered app-dialled call looked "never went
 * off-hook" and was reported as a cancelled, not-connected call. Restoring this
 * snapshot keeps the same call id, lead and off-hook time across that restart.
 *
 * Only the call id, lead id and dialled number already sent to the CRM are
 * stored, in app-private storage. Cleared when the call ends; a snapshot older
 * than [MAX_AGE_MS] is ignored so a stuck one can never make later calls look
 * app-dialled.
 */
data class ActiveCallSnapshot(
    val savedAtMs: Long,
    val lastState: String?,
    val offHookAtMs: Long,
    val appCallUid: String?,
    val appLeadId: String?,
    val appPhone: String?,
    val appAgentId: String?,
    val appLeadName: String?,
    val dialerCallUid: String?,
    val dialerNumber: String?,
    val incomingCallUid: String?,
    val incomingNumber: String?,
) {
    val hasCall: Boolean get() = appCallUid != null || dialerCallUid != null || incomingCallUid != null

    /** Usable only when it describes a call and is recent (clock going backwards = unusable). */
    fun usable(nowMs: Long): Boolean = hasCall && savedAtMs in (nowMs - MAX_AGE_MS)..nowMs

    fun toMap(): Map<String, Any?> = mapOf(
        K_SAVED to savedAtMs, K_STATE to lastState, K_OFFHOOK to offHookAtMs,
        K_APP_UID to appCallUid, K_APP_LEAD to appLeadId, K_APP_PHONE to appPhone,
        K_APP_AGENT to appAgentId, K_APP_NAME to appLeadName,
        K_DIAL_UID to dialerCallUid, K_DIAL_NUM to dialerNumber,
        K_IN_UID to incomingCallUid, K_IN_NUM to incomingNumber,
    )

    companion object {
        /** Longer than any real sales call; a snapshot beyond this is stale. */
        const val MAX_AGE_MS = 4L * 60 * 60 * 1000

        fun fromMap(map: Map<String, *>): ActiveCallSnapshot? {
            val saved = (map[K_SAVED] as? Number)?.toLong() ?: return null
            fun s(k: String) = (map[k] as? String)?.takeIf { it.isNotBlank() }
            return ActiveCallSnapshot(
                savedAtMs = saved,
                lastState = s(K_STATE),
                offHookAtMs = (map[K_OFFHOOK] as? Number)?.toLong() ?: 0L,
                appCallUid = s(K_APP_UID), appLeadId = s(K_APP_LEAD), appPhone = s(K_APP_PHONE),
                appAgentId = s(K_APP_AGENT), appLeadName = s(K_APP_NAME),
                dialerCallUid = s(K_DIAL_UID), dialerNumber = s(K_DIAL_NUM),
                incomingCallUid = s(K_IN_UID), incomingNumber = s(K_IN_NUM),
            )
        }

        const val K_SAVED = "saved_at"
        const val K_STATE = "last_state"
        const val K_OFFHOOK = "offhook_at"
        const val K_APP_UID = "app_call_uid"
        const val K_APP_LEAD = "app_lead_id"
        const val K_APP_PHONE = "app_phone"
        const val K_APP_AGENT = "app_agent_id"
        const val K_APP_NAME = "app_lead_name"
        const val K_DIAL_UID = "dialer_call_uid"
        const val K_DIAL_NUM = "dialer_number"
        const val K_IN_UID = "incoming_call_uid"
        const val K_IN_NUM = "incoming_number"
    }
}

object ActiveCallStore {
    private const val PREFS = "winstone_active_call"

    /** Writes the current in-memory call state (synchronously: the process may die next). */
    fun save(context: Context, lastState: String?, offHookAtMs: Long) {
        val snap = ActiveCallSnapshot(
            savedAtMs = System.currentTimeMillis(),
            lastState = lastState,
            offHookAtMs = offHookAtMs,
            appCallUid = LiveCallLauncher.activeCallUid,
            appLeadId = LiveCallLauncher.activeLeadId,
            appPhone = LiveCallLauncher.activePhone,
            appAgentId = LiveCallLauncher.activeAgentId,
            appLeadName = LiveCallLauncher.activeLeadName,
            dialerCallUid = DialerCallTracker.callUid,
            dialerNumber = DialerCallTracker.number,
            incomingCallUid = IncomingCallTracker.callUid,
            incomingNumber = IncomingCallTracker.number,
        )
        val e = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear()
        if (snap.hasCall) {
            for ((k, v) in snap.toMap()) when (v) {
                is Long -> e.putLong(k, v)
                is String -> e.putString(k, v)
            }
        }
        e.commit()
    }

    fun load(context: Context, nowMs: Long = System.currentTimeMillis()): ActiveCallSnapshot? {
        val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val snap = ActiveCallSnapshot.fromMap(prefs.all) ?: return null
        if (!snap.usable(nowMs)) { clear(context); return null }
        return snap
    }

    fun clear(context: Context) {
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().commit()
    }

    /**
     * After a process restart, puts the saved call back into the trackers.
     * Never overwrites a tracker that already holds a live call.
     */
    fun restoreIntoTrackers(snap: ActiveCallSnapshot) {
        if (LiveCallLauncher.activeCallUid == null && snap.appCallUid != null) {
            LiveCallLauncher.activeCallUid = snap.appCallUid
            LiveCallLauncher.activeLeadId = snap.appLeadId
            LiveCallLauncher.activePhone = snap.appPhone
            LiveCallLauncher.activeAgentId = snap.appAgentId
            LiveCallLauncher.activeLeadName = snap.appLeadName
        }
        if (DialerCallTracker.callUid == null && snap.dialerCallUid != null) {
            DialerCallTracker.restore(snap.dialerNumber, snap.dialerCallUid)
        }
        if (IncomingCallTracker.callUid == null && snap.incomingCallUid != null) {
            IncomingCallTracker.restore(snap.incomingNumber, snap.incomingCallUid)
        }
    }
}
