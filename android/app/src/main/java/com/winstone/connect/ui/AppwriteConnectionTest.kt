package com.winstone.connect.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.winstone.connect.data.remote.AppwriteConnectivity
import com.winstone.connect.ui.theme.WinGreen
import com.winstone.connect.ui.theme.WinInkMuted
import kotlinx.coroutines.launch

/**
 * "Test Appwrite connection" — sends one real ping to Appwrite through the official SDK.
 * Independent of CRM sign-in and sync; shows loading, success and failure states.
 */
@Composable
fun AppwriteConnectionTest(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    var result by remember { mutableStateOf<AppwriteConnectivity.Result?>(null) }

    Column(modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        TextButton(
            enabled = !busy,
            onClick = {
                busy = true
                scope.launch {
                    result = AppwriteConnectivity.ping(context)
                    busy = false
                }
            },
        ) {
            if (busy) {
                CircularProgressIndicator(color = WinGreen, strokeWidth = 2.dp, modifier = Modifier.size(14.dp))
                Spacer(Modifier.size(8.dp))
                Text("Testing Appwrite…", color = WinInkMuted, fontSize = 12.sp)
            } else {
                Text("Test Appwrite connection", color = WinInkMuted, fontSize = 12.sp)
            }
        }
        val r = result
        if (r != null && !busy) {
            Row(Modifier.semantics { liveRegion = LiveRegionMode.Polite }.padding(horizontal = 8.dp)) {
                when (r) {
                    is AppwriteConnectivity.Result.Ok -> Text(
                        "Appwrite সংযুক্ত / connected — “${r.response}” · ${r.latencyMs} ms",
                        color = WinGreen,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    is AppwriteConnectivity.Result.Failed -> Text(
                        AppwriteConnectivity.hint(r.kind) +
                            "\n" + (r.code?.let { "HTTP $it · " } ?: "") + r.detail + " · ${r.latencyMs} ms",
                        color = MaterialTheme.colorScheme.error,
                        fontSize = 11.sp,
                        lineHeight = 14.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        }
    }
}
