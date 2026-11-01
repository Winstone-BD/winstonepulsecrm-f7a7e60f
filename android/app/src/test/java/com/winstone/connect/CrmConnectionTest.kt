package com.winstone.connect

import com.winstone.connect.data.CrmConnection
import com.winstone.connect.data.CrmConnection.State
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CrmConnectionTest {
    private val now = 1_800_000_000_000L

    @Test fun recentSuccessfulReadIsConnected() {
        assertEquals(State.CONNECTED, CrmConnection.classify(null, now - 30_000, now, checking = false))
    }

    @Test fun noSuccessForMoreThanTwoMinutesIsStale() {
        assertEquals(State.STALE, CrmConnection.classify(null, now - 3 * 60_000, now, checking = false))
    }

    @Test fun neverConnectedIsNeverClaimedConnected() {
        assertEquals(State.NEVER, CrmConnection.classify(null, null, now, checking = false))
        assertEquals(State.CHECKING, CrmConnection.classify(null, null, now, checking = true))
    }

    @Test fun dnsFailureIsThePhonesInternet() {
        val e = "Unable to resolve host \"crm.winstonebd.com\": No address associated with hostname"
        assertEquals(State.NO_INTERNET, CrmConnection.classify(e, now - 10_000, now, checking = false))
    }

    @Test fun otherFailuresAreServerErrors() {
        assertEquals(State.SERVER_ERROR, CrmConnection.classify("HTTP 500", now - 10_000, now, checking = false))
    }

    @Test fun lastSyncTimeIsShownInBengali() {
        assertEquals("এইমাত্র", CrmConnection.ago(now - 10_000, now))
        assertEquals("৩ মিনিট আগে", CrmConnection.ago(now - 3 * 60_000, now))
        val v = CrmConnection.describe(null, now - 3 * 60_000, "04:09 AM", now, checking = false)
        assertTrue(v.detail!!.contains("04:09 AM"))
    }
}
