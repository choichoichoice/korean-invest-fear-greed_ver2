package app.pengom

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** 폰을 다시 켜면 시간 재기를 이어간다 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED && Perms.all(context)) {
            UsageWatchService.start(context)
        }
    }
}
