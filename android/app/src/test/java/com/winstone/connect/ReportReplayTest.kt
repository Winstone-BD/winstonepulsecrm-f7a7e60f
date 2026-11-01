package com.winstone.connect

import com.winstone.connect.data.sync.CallSyncQueue
import com.winstone.connect.data.sync.ReportReplay
import com.winstone.connect.data.sync.ReportReplay.Action
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Reports that failed offline are resent on reconnect — once, and only when safe. */
class ReportReplayTest {
    @Test fun reportWaitingOnBackoffIsResent() {
        assertEquals(Action.RESEND, ReportReplay.decide("ENQUEUED", runAttemptCount = 3))
    }

    @Test fun neverTriedJobIsLeftToWorkManager() {
        assertEquals(Action.KEEP, ReportReplay.decide("ENQUEUED", runAttemptCount = 0))
    }

    @Test fun runningJobIsNotInterrupted() {
        assertEquals(Action.KEEP, ReportReplay.decide("RUNNING", runAttemptCount = 2))
    }

    @Test fun finishedOrPermanentlyFailedJobsAreForgotten() {
        assertEquals(Action.FORGET, ReportReplay.decide("SUCCEEDED", 1))
        assertEquals(Action.FORGET, ReportReplay.decide("FAILED", 4))
        assertEquals(Action.FORGET, ReportReplay.decide("CANCELLED", 1))
        assertEquals(Action.FORGET, ReportReplay.decide(null, 0))
    }

    @Test fun onlyReportKindsAreReplayed() {
        assertTrue(CallSyncQueue.KIND_REPORT_SUBMIT in ReportReplay.REPLAYABLE)
        assertTrue(CallSyncQueue.KIND_REPORT_OPEN in ReportReplay.REPLAYABLE)
        assertFalse(CallSyncQueue.KIND_RECORDING in ReportReplay.REPLAYABLE)
    }
}
