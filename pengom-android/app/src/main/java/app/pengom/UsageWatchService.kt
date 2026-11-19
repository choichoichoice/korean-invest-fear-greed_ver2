package app.pengom

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import java.time.LocalDate
import java.time.ZoneId

/**
 * 인스타·유튜브·틱톡이 화면 맨 앞에 떠 있는 시간을 잰다.
 *
 * - 시스템 "사용 정보"의 앱 전환 기록(어떤 앱이 앞에 왔다/갔다)만 읽는다. 화면 내용은 읽지 않는다.
 * - 화면이 켜져 있고 대상 앱이 맨 앞일 때만 1초씩 더한다.
 * - 대상 앱이 앞에 오면 화면 위 카운터를 띄우고, 정해둔 분에 도달하면 펭곰이가 끼어든다.
 */
class UsageWatchService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private lateinit var store: CounterStore
    private lateinit var overlay: OverlayController
    private lateinit var usm: UsageStatsManager
    private lateinit var power: PowerManager
    private var foreground: String? = null
    private var lastQuery = 0L
    private var lastTick = 0L
    private var carryMs = 0L
    private var lastNotifiedMin = -1

    private val loop = object : Runnable {
        override fun run() {
            step()
            handler.postDelayed(this, if (power.isInteractive) TICK_MS else IDLE_MS)
        }
    }

    override fun onCreate() {
        super.onCreate()
        store = CounterStore(this)
        usm = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        power = getSystemService(Context.POWER_SERVICE) as PowerManager
        overlay = OverlayController(this, store) {
            startActivity(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
        goForeground()
        catchUpToday()
        lastTick = System.currentTimeMillis()
        handler.post(loop)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

    override fun onDestroy() {
        handler.removeCallbacks(loop)
        overlay.hide()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    /** 서비스가 꺼져 있던 동안의 오늘 사용 시간을 시스템 기록으로 다시 계산한다 */
    private fun catchUpToday() {
        val now = System.currentTimeMillis()
        val midnight = LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val events = usm.queryEvents(midnight, now)
        val e = UsageEvents.Event()
        var openPkg: String? = null
        var openAt = 0L
        var total = 0L
        while (events.hasNextEvent()) {
            events.getNextEvent(e)
            when (e.eventType) {
                RESUMED -> {
                    if (openPkg != null) total += e.timeStamp - openAt
                    openPkg = if (e.packageName in TARGETS) e.packageName else null
                    openAt = e.timeStamp
                    foreground = e.packageName
                }
                PAUSED -> if (e.packageName == openPkg) { total += e.timeStamp - openAt; openPkg = null }
            }
        }
        if (openPkg != null) total += now - openAt
        store.raiseUsedTo((total / 1000).toInt())
        lastQuery = now
    }

    private fun step() {
        val now = System.currentTimeMillis()
        val events = usm.queryEvents(lastQuery, now)
        val e = UsageEvents.Event()
        while (events.hasNextEvent()) {
            events.getNextEvent(e)
            if (e.eventType == RESUMED) foreground = e.packageName
            else if (e.eventType == PAUSED && e.packageName == foreground) foreground = null
        }
        lastQuery = now

        val watching = power.isInteractive && foreground in TARGETS
        if (watching) overlay.show() else if (foreground != null && foreground != "com.android.systemui") overlay.hide()

        val dt = (now - lastTick).coerceIn(0, 5_000)
        lastTick = now
        if (!watching) { carryMs = 0; return }
        carryMs += dt
        val sec = (carryMs / 1000).toInt()
        if (sec <= 0) return
        carryMs -= sec * 1000L
        val tick = store.addSeconds(sec)
        overlay.onTick(tick)
        if (tick.usedSec / 60 != lastNotifiedMin) { lastNotifiedMin = tick.usedSec / 60; updateNotification() }
    }

    private fun goForeground() {
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL, "시간 재기", NotificationManager.IMPORTANCE_MIN).apply {
                description = "쇼츠 앱을 본 시간을 재는 동안 표시됩니다"
                setShowBadge(false)
            }
        )
        val n = buildNotification()
        if (Build.VERSION.SDK_INT >= 34) startForeground(NOTI_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        else startForeground(NOTI_ID, n)
    }

    private fun buildNotification(): Notification {
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE,
        )
        val b = store.budget()
        val text = if (b == null) "오늘 ${store.usedMin()}분 · 아직 약속 전" else "오늘 ${store.usedMin()}분 / 약속 ${b}분"
        return Notification.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_pengom)
            .setContentTitle("펭곰이가 재는 중")
            .setContentText(text)
            .setContentIntent(open)
            .setOngoing(true)
            .build()
    }

    private fun updateNotification() {
        getSystemService(NotificationManager::class.java).notify(NOTI_ID, buildNotification())
    }

    companion object {
        val TARGETS = setOf(
            "com.instagram.android",
            "com.google.android.youtube",
            "com.zhiliaoapp.musically",
            "com.ss.android.ugc.trill",
        )
        @Suppress("DEPRECATION") private const val RESUMED = UsageEvents.Event.MOVE_TO_FOREGROUND
        @Suppress("DEPRECATION") private const val PAUSED = UsageEvents.Event.MOVE_TO_BACKGROUND
        private const val TICK_MS = 1_000L
        private const val IDLE_MS = 15_000L
        private const val CHANNEL = "watch"
        private const val NOTI_ID = 7

        fun start(ctx: Context) {
            val i = Intent(ctx, UsageWatchService::class.java)
            if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i) else ctx.startService(i)
        }
    }
}
