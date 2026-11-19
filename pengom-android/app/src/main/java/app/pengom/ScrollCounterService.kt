package app.pengom

import android.accessibilityservice.AccessibilityService
import android.graphics.Rect
import android.os.Build
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent

/**
 * 인스타·유튜브·틱톡에서 "넘기기"를 센다.
 *
 * 세는 기준 (실기기에서 조정 예정):
 *  1. 대상 앱에서 발생한 스크롤 이벤트일 것
 *  2. 스크롤된 화면이 세로로 화면의 55% 이상일 것 (댓글창·작은 가로 목록 제외)
 *  3. 위로 되돌아가는 스크롤이 아닐 것
 *  4. 한 번 넘길 때 이벤트가 여러 개 나오므로 650ms 안의 이벤트는 하나로 본다
 *
 * 화면의 글자나 영상 내용은 읽지 않는다. 크기(bounds)만 확인한다.
 */
class ScrollCounterService : AccessibilityService() {

    private lateinit var store: CounterStore
    private lateinit var overlay: OverlayController
    private var foreground: String? = null
    private var lastCountAt = 0L
    private val rect = Rect()

    override fun onServiceConnected() {
        super.onServiceConnected()
        store = CounterStore(this)
        overlay = OverlayController(this, store) { performGlobalAction(GLOBAL_ACTION_HOME) }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null || !::overlay.isInitialized) return
        val pkg = event.packageName?.toString() ?: return
        when (event.eventType) {
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> onWindowChanged(pkg)
            AccessibilityEvent.TYPE_VIEW_SCROLLED -> onScrolled(pkg, event)
        }
    }

    private fun onWindowChanged(pkg: String) {
        if (pkg == packageName || pkg in IGNORED || pkg.contains("inputmethod") || pkg.contains("keyboard")) return
        foreground = pkg
        if (pkg in TARGETS) overlay.show() else overlay.hide()
    }

    private fun onScrolled(pkg: String, event: AccessibilityEvent) {
        if (pkg !in TARGETS) return
        if (foreground != pkg) { foreground = pkg; overlay.show() }

        val now = SystemClock.uptimeMillis()
        if (now - lastCountAt < DEBOUNCE_MS) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && event.scrollDeltaY < 0) return

        val src = event.source
        if (src != null) {
            src.getBoundsInScreen(rect)
            recycle(src)
            val screenH = resources.displayMetrics.heightPixels
            if (rect.height() < screenH * MIN_HEIGHT_RATIO) return
        }

        lastCountAt = now
        overlay.onCount(store.increment())
    }

    @Suppress("DEPRECATION")
    private fun recycle(node: android.view.accessibility.AccessibilityNodeInfo) {
        if (Build.VERSION.SDK_INT < 33) node.recycle()
    }

    override fun onInterrupt() {}

    override fun onDestroy() {
        if (::overlay.isInitialized) overlay.hide()
        super.onDestroy()
    }

    companion object {
        val TARGETS = setOf(
            "com.instagram.android",
            "com.google.android.youtube",
            "com.zhiliaoapp.musically",
            "com.ss.android.ugc.trill",
        )
        private val IGNORED = setOf("com.android.systemui", "android")
        private const val DEBOUNCE_MS = 650L
        private const val MIN_HEIGHT_RATIO = 0.55f
    }
}
