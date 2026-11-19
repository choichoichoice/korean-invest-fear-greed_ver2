package app.pengom

import android.app.AppOpsManager
import android.content.Context
import android.os.Process
import android.provider.Settings

/** 시간 재기에 필요한 두 권한: 사용 정보 접근, 다른 앱 위에 표시 */
object Perms {
    fun usage(ctx: Context): Boolean {
        val ops = ctx.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        @Suppress("DEPRECATION")
        val mode = ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.packageName)
        return mode == AppOpsManager.MODE_ALLOWED
    }

    fun overlay(ctx: Context): Boolean = Settings.canDrawOverlays(ctx)

    fun all(ctx: Context): Boolean = usage(ctx) && overlay(ctx)
}
