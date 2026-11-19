package app.pengom

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate

/**
 * 오늘 쇼츠 앱을 본 시간(초), 아침 약속(예산 분·이유·개입 지점 분)을 폰 안에만 저장한다.
 * 날짜가 바뀌면 어제 시간을 기록(history)으로 옮기고 오늘 시간을 0으로 되돌린다.
 */
class CounterStore(context: Context) {

    data class Tick(
        val usedSec: Int,
        val budgetMin: Int?,
        val line: String?,
        val crossedBudget: Boolean,
        val minuteChanged: Boolean,
    )

    private val p = context.applicationContext.getSharedPreferences("pengom", Context.MODE_PRIVATE)

    private fun today(): String = LocalDate.now().toString()

    @Synchronized
    private fun roll() {
        val d = today()
        val cur = p.getString(K_DATE, null)
        if (cur == d) return
        val e = p.edit()
        if (cur != null) {
            val hist = history()
            hist.put(cur, p.getInt(K_USED, 0))
            val keys = hist.keys().asSequence().sorted().toList()
            keys.dropLast(60).forEach { hist.remove(it) }
            e.putString(K_HIST, hist.toString())
        }
        e.putString(K_DATE, d).putInt(K_USED, 0).putString(K_FIRED, "").putBoolean(K_ACK, false)
            .remove(K_BUDGET).remove(K_TH).remove(K_OVER_TH)
            .apply()
    }

    private fun history(): JSONObject =
        try { JSONObject(p.getString(K_HIST, "{}") ?: "{}") } catch (e: Exception) { JSONObject() }

    fun usedSec(): Int { roll(); return p.getInt(K_USED, 0) }
    fun usedMin(): Int = usedSec() / 60
    fun budget(): Int? { roll(); return if (p.contains(K_BUDGET)) p.getInt(K_BUDGET, 0) else null }
    fun reason(): String = p.getString(K_REASON, "다른 거") ?: "다른 거"
    fun isOver(): Boolean { val b = budget() ?: return false; return usedSec() > b * 60 }

    private fun ints(key: String): List<Int> = try {
        val a = JSONArray(p.getString(key, "[]")); List(a.length()) { a.getInt(it) }
    } catch (e: Exception) { emptyList() }

    @Synchronized
    fun setPromise(budgetMin: Int, reason: String, th: String, overTh: String) {
        roll()
        p.edit().putInt(K_BUDGET, budgetMin).putString(K_REASON, reason)
            .putString(K_TH, th).putString(K_OVER_TH, overTh).apply()
    }

    fun ackOver() { p.edit().putBoolean(K_ACK, true).apply() }

    /** 서비스가 다시 시작됐을 때, 시스템 기록으로 계산한 오늘 시간이 더 크면 그 값으로 맞춘다 */
    @Synchronized
    fun raiseUsedTo(sec: Int) {
        roll()
        if (sec > p.getInt(K_USED, 0)) p.edit().putInt(K_USED, sec).apply()
    }

    @Synchronized
    fun addSeconds(sec: Int): Tick {
        roll()
        val prev = p.getInt(K_USED, 0)
        val now = prev + sec
        val b = budget()
        val pm = prev / 60.0
        val nm = now / 60.0
        val fired = (p.getString(K_FIRED, "") ?: "").split(',').filter { it.isNotEmpty() }.toMutableSet()
        var line: String? = null
        var crossed = false
        if (b != null) {
            ints(K_TH).forEachIndexed { i, t ->
                if (pm < t && nm >= t && "t$i" !in fired) {
                    fired += "t$i"
                    line = when (i) {
                        0 -> "지금 몇 분째인지 모르지? ${t}분째야."
                        1 -> "${t}분째. 아직 약속 안이긴 해."
                        else -> "${b - t}분 남음. 신중하게 골라."
                    }
                }
            }
            if (pm <= b && nm > b && !p.getBoolean(K_ACK, false)) crossed = true
            ints(K_OVER_TH).forEachIndexed { i, t ->
                if (pm < t && nm >= t && "o$i" !in fired) {
                    fired += "o$i"
                    line = overLine(i, t)
                }
            }
        }
        p.edit().putInt(K_USED, now).putString(K_FIRED, fired.joinToString(",")).apply()
        return Tick(now, b, line, crossed, prev / 60 != now / 60)
    }

    private fun overLine(i: Int, n: Int): String = when (i % 7) {
        0 -> "나 지금 액체임."
        1 -> "${n}분 봤는데. 뭐 봤냐?"
        2 -> "방금 거 기억나? 그 전 거는?"
        3 -> "엄지는 멀쩡하네. 나는 아님."
        4 -> "계속 녹는 중. 신경 쓰지 마."
        5 -> "아침에 '${reason()}' 한다며."
        else -> "${n}분째. 알고리즘이 너 키우는 중."
    }

    /** 웹 화면으로 넘기는 상태 (used, history 는 초 단위) */
    fun stateJson(): String {
        roll()
        return JSONObject()
            .put("date", p.getString(K_DATE, today()))
            .put("used", p.getInt(K_USED, 0))
            .put("budget", budget() ?: JSONObject.NULL)
            .put("history", history())
            .toString()
    }

    companion object {
        private const val K_DATE = "date"
        private const val K_USED = "usedSec"
        private const val K_HIST = "historySec"
        private const val K_BUDGET = "budgetMin"
        private const val K_REASON = "reason"
        private const val K_TH = "thMin"
        private const val K_OVER_TH = "overThMin"
        private const val K_FIRED = "fired"
        private const val K_ACK = "overAck"
    }
}
