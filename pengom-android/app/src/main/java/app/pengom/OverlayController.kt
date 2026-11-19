package app.pengom

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.view.WindowManager
import android.view.animation.DecelerateInterpolator
import android.view.animation.OvershootInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView

/**
 * 다른 앱 위에 뜨는 화면들. 접근성 서비스 전용 오버레이라서 "다른 앱 위에 표시" 권한이 따로 필요 없다.
 *  - 카운터: 화면 위쪽 가운데 "↕ 37 · 56 남음"
 *  - 한마디: 캐릭터 얼굴 + 말풍선 (넘기는 순간에만, 2.8초)
 *  - 약속 초과: 아래에서 올라오는 시트 "네가 정한 거야. 내가 정한 거 아니고."
 */
class OverlayController(
    private val svc: AccessibilityService,
    private val store: CounterStore,
    private val goHome: () -> Unit,
) {
    private val wm = svc.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private val main = Handler(Looper.getMainLooper())
    private val density = svc.resources.displayMetrics.density
    private fun px(v: Int) = (v * density).toInt()

    private var pill: LinearLayout? = null
    private var pillNum: TextView? = null
    private var pillSub: TextView? = null
    private var pillIcon: ImageView? = null
    private var toast: View? = null
    private var sheet: View? = null
    private val hideToastTask = Runnable { removeToast() }

    private fun params(w: Int, h: Int, touchable: Boolean) = WindowManager.LayoutParams(
        w, h,
        WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
            (if (touchable) 0 else WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE),
        PixelFormat.TRANSLUCENT,
    )

    private fun rounded(color: Int, radiusDp: Int, strokeDp: Int = 0, strokeColor: Int = 0) =
        GradientDrawable().apply {
            setColor(color); cornerRadius = px(radiusDp).toFloat()
            if (strokeDp > 0) setStroke(px(strokeDp), strokeColor)
        }

    private fun dimen(name: String): Int {
        val id = svc.resources.getIdentifier(name, "dimen", "android")
        return if (id > 0) svc.resources.getDimensionPixelSize(id) else 0
    }

    private fun safeRemove(v: View) = try { wm.removeView(v) } catch (_: Exception) {}

    // ---------------- 카운터 ----------------
    fun show() {
        if (pill != null) { refresh(); return }
        val row = LinearLayout(svc).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(px(8), px(5), px(14), px(5))
            background = rounded(0xE60E161E.toInt(), 20, 1, 0x40FFFFFF)
        }
        pillIcon = ImageView(svc).apply { setImageResource(R.drawable.mascot_head) }
        row.addView(pillIcon, LinearLayout.LayoutParams(px(26), px(26)).apply { marginEnd = px(6) })
        pillNum = TextView(svc).apply { setTextColor(Color.WHITE); textSize = 17f; typeface = Typeface.DEFAULT_BOLD }
        pillSub = TextView(svc).apply { textSize = 12f; typeface = Typeface.DEFAULT_BOLD; setPadding(px(8), 0, 0, 0) }
        row.addView(pillNum); row.addView(pillSub)
        val lp = params(WRAP_CONTENT, WRAP_CONTENT, false).apply {
            gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
            y = dimen("status_bar_height") + px(6)
        }
        try { wm.addView(row, lp); pill = row } catch (_: Exception) { return }
        refresh()
    }

    fun hide() {
        pill?.let { safeRemove(it) }; pill = null
        removeToast()
        sheet?.let { safeRemove(it) }; sheet = null
    }

    private fun refresh() {
        val c = store.count(); val b = store.budget()
        val over = b != null && c > b
        pillNum?.text = "↕ $c"
        pillSub?.text = when { b == null -> "약속 전"; over -> "+${c - b} 초과"; else -> "${b - c} 남음" }
        pillSub?.setTextColor(if (over) 0xFFFF9D80.toInt() else 0xCCFFFFFF.toInt())
        pillIcon?.setImageResource(if (over) R.drawable.mascot_head_melt else R.drawable.mascot_head)
    }

    fun onCount(t: CounterStore.Tick) {
        show()
        refresh()
        pill?.animate()?.scaleX(1.08f)?.scaleY(1.08f)?.setDuration(90)
            ?.withEndAction { pill?.animate()?.scaleX(1f)?.scaleY(1f)?.setDuration(140)?.start() }?.start()
        if (t.crossedBudget) showSheet() else t.line?.let { showToast(it) }
    }

    // ---------------- 한마디 ----------------
    private fun showToast(text: String) {
        removeToast()
        val card = LinearLayout(svc).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(px(10), px(8), px(16), px(8))
            background = rounded(Color.WHITE, 22)
            elevation = px(10).toFloat()
        }
        card.addView(ImageView(svc).apply {
            setImageResource(if (store.isOver()) R.drawable.mascot_head_melt else R.drawable.mascot_head)
        }, LinearLayout.LayoutParams(px(48), px(48)).apply { marginEnd = px(10) })
        card.addView(TextView(svc).apply {
            this.text = text; setTextColor(0xFF17232E.toInt()); textSize = 15f; typeface = Typeface.DEFAULT_BOLD
        }, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
        val wrap = FrameLayout(svc).apply { setPadding(px(12), 0, px(12), px(12)) }
        wrap.addView(card, FrameLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
        val lp = params(MATCH_PARENT, WRAP_CONTENT, false).apply {
            gravity = Gravity.TOP
            y = dimen("status_bar_height") + px(52)
        }
        try { wm.addView(wrap, lp); toast = wrap } catch (_: Exception) { return }
        card.translationY = -px(40).toFloat(); card.alpha = 0f
        card.animate().translationY(0f).alpha(1f).setDuration(380).setInterpolator(OvershootInterpolator(1.6f)).start()
        vibrate(longArrayOf(0, 25))
        main.removeCallbacks(hideToastTask)
        main.postDelayed(hideToastTask, 2800)
    }

    private fun removeToast() {
        main.removeCallbacks(hideToastTask)
        toast?.let { safeRemove(it) }; toast = null
    }

    // ---------------- 약속 초과 시트 ----------------
    private fun showSheet() {
        if (sheet != null) return
        removeToast()
        val r = px(28).toFloat()
        val dim = FrameLayout(svc).apply { setBackgroundColor(0x8C000000.toInt()) }
        val card = LinearLayout(svc).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(px(20), px(16), px(20), px(20) + dimen("navigation_bar_height"))
            background = GradientDrawable().apply {
                setColor(0xFFF6FAFC.toInt()); cornerRadii = floatArrayOf(r, r, r, r, 0f, 0f, 0f, 0f)
            }
        }
        card.addView(ImageView(svc).apply { setImageResource(R.drawable.mascot_head_melt) },
            LinearLayout.LayoutParams(px(104), px(104)))
        card.addView(TextView(svc).apply {
            text = "네가 정한 거야.\n내가 정한 거 아니고."
            textSize = 23f; typeface = Typeface.DEFAULT_BOLD; gravity = Gravity.CENTER
            setTextColor(0xFF17232E.toInt()); setLineSpacing(0f, 1.15f)
        }, LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply { topMargin = px(8) })
        card.addView(TextView(svc).apply {
            val reason = store.reason()
            text = (if (reason != "다른 거") "“$reason 하려고 아낀다.” 아침에 네가 쓴 말이야.\n" else "") +
                "약속 ${store.budget()}개, 지금 ${store.count()}개째."
            textSize = 14f; setTextColor(0xFF687B8B.toInt()); gravity = Gravity.CENTER
            setPadding(px(12), px(10), px(12), px(10))
            background = rounded(Color.WHITE, 14, 2, 0xFFE1EAF0.toInt())
        }, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = px(14) })

        val row = LinearLayout(svc).apply { orientation = LinearLayout.HORIZONTAL }
        val keep = button("그래도 본다", Color.WHITE, 0xFF17232E.toInt(), 0xFFE1EAF0.toInt())
        val leave = button("나간다", 0xFF1FA7E8.toInt(), Color.WHITE, 0xFF1583B9.toInt())
        row.addView(keep, LinearLayout.LayoutParams(0, px(54), 1f).apply { marginEnd = px(10) })
        row.addView(leave, LinearLayout.LayoutParams(0, px(54), 1f))
        card.addView(row, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = px(16) })

        dim.addView(card, FrameLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT, Gravity.BOTTOM))
        try { wm.addView(dim, params(MATCH_PARENT, MATCH_PARENT, true)); sheet = dim } catch (_: Exception) { return }
        card.translationY = px(400).toFloat()
        card.animate().translationY(0f).setDuration(420).setInterpolator(DecelerateInterpolator(2f)).start()
        vibrate(longArrayOf(0, 30, 60, 30))

        keep.setOnClickListener {
            store.ackOver(); removeSheet()
            main.postDelayed({ showToast("그래. 나는 여기서 녹고 있을게.") }, 250)
        }
        leave.setOnClickListener { store.ackOver(); removeSheet(); goHome() }
    }

    private fun removeSheet() { sheet?.let { safeRemove(it) }; sheet = null }

    private fun button(label: String, bg: Int, fg: Int, edge: Int) = TextView(svc).apply {
        text = label; textSize = 16f; typeface = Typeface.DEFAULT_BOLD; gravity = Gravity.CENTER
        setTextColor(fg); background = rounded(bg, 18, 2, edge); isClickable = true
    }

    private fun vibrate(pattern: LongArray) {
        try {
            @Suppress("DEPRECATION")
            val v = svc.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator ?: return
            v.vibrate(VibrationEffect.createWaveform(pattern, -1))
        } catch (_: Exception) {}
    }
}
