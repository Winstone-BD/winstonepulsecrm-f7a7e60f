package com.winstone.connect

import com.winstone.connect.data.remote.AppwriteConnectivity
import com.winstone.connect.data.remote.AppwriteConnectivity.Failure
import io.appwrite.exceptions.AppwriteException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException

class AppwriteConnectivityTest {
    @Test fun onlyPongIsSuccess() {
        assertTrue(AppwriteConnectivity.isPong("Pong!"))
        assertFalse(AppwriteConnectivity.isPong(""))
        assertFalse(AppwriteConnectivity.isPong(null))
    }

    @Test fun unregisteredPlatformIsReported() {
        val e = AppwriteException("Invalid Origin", 403, "general_unknown_origin")
        assertEquals(Failure.UNKNOWN_PLATFORM to 403, AppwriteConnectivity.classify(e))
    }

    @Test fun httpErrorsKeepStatus() {
        assertEquals(Failure.HTTP to 500, AppwriteConnectivity.classify(AppwriteException("boom", 500, "general_server_error")))
    }

    @Test fun networkAndTimeouts() {
        assertEquals(Failure.NO_INTERNET, AppwriteConnectivity.classify(UnknownHostException("sgp.cloud.appwrite.io")).first)
        assertEquals(Failure.NO_INTERNET, AppwriteConnectivity.classify(IOException("reset")).first)
        assertEquals(Failure.TIMEOUT, AppwriteConnectivity.classify(SocketTimeoutException()).first)
        assertEquals(Failure.TIMEOUT, AppwriteConnectivity.classify(RuntimeException(SocketTimeoutException())).first)
    }
}
