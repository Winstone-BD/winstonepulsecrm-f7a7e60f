package com.winstone.connect.data

/**
 * Whether this phone can reach the CRM right now, in plain words for the agent.
 *
 * Built only from what the phone actually observed: the last successful CRM
 * read and the last failure message. It never claims "connected" without a
 * real successful read, and it goes "stale" when reads stop succeeding.
 */
object CrmConnection {
    enum class State { CONNECTED, STALE, CHECKING, NO_INTERNET, SERVER_ERROR, NEVER }

    /** No successful read for this long → the shown data may be old. */
    const val STALE_AFTER_MS = 2 * 60_000L

    data class View(val state: State, val title: String, val detail: String?)

    fun classify(error: String?, lastOkMillis: Long?, nowMillis: Long, checking: Boolean): State {
        if (error != null) return if (isNetworkProblem(error)) State.NO_INTERNET else State.SERVER_ERROR
        if (lastOkMillis == null || lastOkMillis <= 0L) return if (checking) State.CHECKING else State.NEVER
        if (nowMillis - lastOkMillis > STALE_AFTER_MS) return if (checking) State.CHECKING else State.STALE
        return State.CONNECTED
    }

    /** DNS / no route / timeout: the phone's internet, not the CRM, is the problem. */
    fun isNetworkProblem(error: String): Boolean {
        val e = error.lowercase()
        return listOf(
            "unable to resolve host", "no address associated", "failed to connect",
            "timeout", "timed out", "network is unreachable", "connection reset",
            "connection refused", "software caused connection abort", "unknownhost",
        ).any { e.contains(it) }
    }

    /** "এইমাত্র", "৩ মিনিট আগে", "২ ঘণ্টা আগে" — Bengali digits. */
    fun ago(lastOkMillis: Long, nowMillis: Long): String {
        val secs = ((nowMillis - lastOkMillis) / 1000).coerceAtLeast(0)
        val text = when {
            secs < 45 -> return "এইমাত্র"
            secs < 3600 -> "${(secs + 30) / 60} মিনিট আগে"
            secs < 86_400 -> "${secs / 3600} ঘণ্টা আগে"
            else -> "${secs / 86_400} দিন আগে"
        }
        return bnDigits(text)
    }

    fun bnDigits(s: String): String = s.map { c -> if (c in '0'..'9') '০' + (c - '0') else c }.joinToString("")

    fun describe(error: String?, lastOkMillis: Long?, lastOkClock: String?, nowMillis: Long, checking: Boolean): View {
        val state = classify(error, lastOkMillis, nowMillis, checking)
        val last = if (lastOkMillis != null && lastOkMillis > 0L) {
            "শেষ সফল সিঙ্ক: ${lastOkClock ?: "—"} (${ago(lastOkMillis, nowMillis)})"
        } else {
            "এখনো কোনো সফল সিঙ্ক হয়নি"
        }
        return when (state) {
            State.CONNECTED -> View(state, "CRM সংযুক্ত", last)
            State.STALE -> View(state, "CRM থেকে নতুন তথ্য আসছে না", last)
            State.CHECKING -> View(state, "CRM-এর সাথে সংযোগ যাচাই হচ্ছে…", last)
            State.NEVER -> View(state, "CRM সংযোগ এখনো যাচাই হয়নি", last)
            State.NO_INTERNET -> View(
                state,
                "CRM-এ পৌঁছানো যাচ্ছে না — ফোনের ইন্টারনেট দেখুন",
                "$last · Wi-Fi/মোবাইল ডেটা বদলে আবার চেষ্টা করুন",
            )
            State.SERVER_ERROR -> View(state, "CRM সাড়া দিচ্ছে, কিন্তু সমস্যা হয়েছে", "$last · ${error.orEmpty().take(120)}")
        }
    }
}
