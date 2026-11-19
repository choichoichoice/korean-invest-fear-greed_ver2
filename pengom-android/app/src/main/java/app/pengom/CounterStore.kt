package app.pengom

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate

/**
 * 오늘 넘긴 횟수, 아침 약속(예산·이유·개입 지점)을 폰 안에만 저장한다.
 * 날짜가 바뀌면 어제 횟수를 기록(history)으로 옮기고 오늘 횟수를 0으로 되돌린다.
 */
class CounterStore(context: Context) {

    data class Tick(val count: Int, val budget: Int?, val line: String?, val crossedBudget: Boolean)

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
            hist.put(cur, p.getInt(K_COUNT, 0))
            // 최근 60일만 보관
            val keys = hist.keys().asSequence().sorted().toList()
            keys.dropLast(60).forEach { hist.remove(it) }
            e.putString(K_HIST, hist.toString())
        }
        e.putString(K_DATE, d).putInt(K_COUNT, 0).putString(K_FIRED, "").putBoolean(K_ACK, false)
            .remove(K_BUDGET).remove(K_TH).remove(K_OVER_TH)
            .apply()
    }

    private fun history(): JSONObject =
        try { JSONObject(p.getString(K_HIST, "{}") ?: "{}") } catch (e: Exception) { JSONObject() }

    fun count(): Int { roll(); return p.getInt(K_COUNT, 0) }
    fun budget(): Int? { roll(); return if (p.contains(K_BUDGET)) p.getInt(K_BUDGET, 0) else null }
    fun reason(): String = p.getString(K_REASON, "다른 거") ?: "다른 거"
    fun isOver(): Boolean { val b = budget() ?: return false; return count() > b }

    private fun ints(key: String): List<Int> = try {
        val a = JSONArray(p.getString(key, "[]")); List(a.length()) { a.getInt(it) }
    } catch (e: Exception) { emptyList() }

    @Synchronized
    fun setPromise(budget: Int, reason: String, th: String, overTh: String) {
        roll()
        p.edit().putInt(K_BUDGET, budget).putString(K_REASON, reason)
            .putString(K_TH, th).putString(K_OVER_TH, overTh).apply()
    }

    fun ackOver() { p.edit().putBoolean(K_ACK, true).apply() }

    @Synchronized
    fun increment(): Tick {
        roll()
        val prev = p.getInt(K_COUNT, 0)
        val now = prev + 1
        val b = budget()
        val fired = (p.getString(K_FIRED, "") ?: "").split(',').filter { it.isNotEmpty() }.toMutableSet()
        var line: String? = null
        var crossed = false
        if (b != null) {
            ints(K_TH).forEachIndexed { i, t ->
                if (prev < t && now >= t && "t$i" !in fired) {
                    fired += "t$i"
                    line = when (i) {
                        0 -> "지금 몇 번째인지 모르지? ${t}번째야."
                        1 -> "${t}개째. 아직 약속 안이긴 해."
                        else -> "${b - t}개 남음. 신중하게 골라."
                    }
                }
            }
            if (prev <= b && now > b && !p.getBoolean(K_ACK, false)) crossed = true
            ints(K_OVER_TH).forEachIndexed { i, t ->
                if (prev < t && now >= t && "o$i" !in fired) {
                    fired += "o$i"
                    line = overLine(i, t)
                }
            }
        }
        p.edit().putInt(K_COUNT, now).putString(K_FIRED, fired.joinToString(",")).apply()
        return Tick(now, b, line, crossed)
    }

    private fun overLine(i: Int, n: Int): String = when (i % 7) {
        0 -> "나 지금 액체임."
        1 -> "${n}개 봤는데. 뭐 봤냐?"
        2 -> "방금 거 기억나? 그 전 거는?"
        3 -> "엄지는 멀쩡하네. 나는 아님."
        4 -> "계속 녹는 중. 신경 쓰지 마."
        5 -> "아침에 '${reason()}' 한다며."
        else -> "${n}개째. 알고리즘이 너 키우는 중."
    }

    /** 웹 화면으로 넘기는 상태 */
    fun stateJson(): String {
        roll()
        return JSONObject()
            .put("date", p.getString(K_DATE, today()))
            .put("count", p.getInt(K_COUNT, 0))
            .put("budget", budget() ?: JSONObject.NULL)
            .put("history", history())
            .toString()
    }

    companion object {
        private const val K_DATE = "date"
        private const val K_COUNT = "count"
        private const val K_HIST = "history"
        private const val K_BUDGET = "budget"
        private const val K_REASON = "reason"
        private const val K_TH = "th"
        private const val K_OVER_TH = "overTh"
        private const val K_FIRED = "fired"
        private const val K_ACK = "overAck"
    }
}
