package com.winstone.connect

import com.winstone.connect.telephony.ActiveCallSnapshot
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ActiveCallSnapshotTest {
    private val now = 1_800_000_000_000L

    private fun appCall(savedAt: Long = now - 60_000) = ActiveCallSnapshot(
        savedAtMs = savedAt, lastState = "OFFHOOK", offHookAtMs = now - 55_000,
        appCallUid = "lead-1-abc", appLeadId = "lead-1", appPhone = "8801711000000",
        appAgentId = "agent-1", appLeadName = null,
        dialerCallUid = null, dialerNumber = null, incomingCallUid = null, incomingNumber = null,
    )

    @Test fun `app-dialled call survives a process restart with its call id and off-hook time`() {
        val restored = ActiveCallSnapshot.fromMap(appCall().toMap())!!
        assertEquals("lead-1-abc", restored.appCallUid)
        assertEquals("lead-1", restored.appLeadId)
        assertEquals("OFFHOOK", restored.lastState)
        assertEquals(now - 55_000, restored.offHookAtMs)
        assertTrue(restored.usable(now))
    }

    @Test fun `snapshot older than four hours is ignored`() {
        val old = appCall(savedAt = now - ActiveCallSnapshot.MAX_AGE_MS - 1)
        assertFalse(old.usable(now))
    }

    @Test fun `snapshot from the future (clock moved back) is ignored`() {
        assertFalse(appCall(savedAt = now + 5_000).usable(now))
    }

    @Test fun `snapshot without any call is not usable`() {
        val empty = appCall().copy(appCallUid = null, appLeadId = null)
        assertFalse(empty.hasCall)
        assertFalse(empty.usable(now))
    }

    @Test fun `incoming call keeps its own id and number`() {
        val incoming = appCall().copy(appCallUid = null, appLeadId = null, appPhone = null,
            incomingCallUid = "in-711000000-1", incomingNumber = "01711000000")
        val restored = ActiveCallSnapshot.fromMap(incoming.toMap())!!
        assertNull(restored.appCallUid)
        assertEquals("in-711000000-1", restored.incomingCallUid)
        assertEquals("01711000000", restored.incomingNumber)
    }

    @Test fun `missing saved time cannot be restored`() {
        assertNull(ActiveCallSnapshot.fromMap(mapOf("app_call_uid" to "x")))
    }
}
