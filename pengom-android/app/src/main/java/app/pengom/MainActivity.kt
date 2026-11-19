package app.pengom

import android.annotation.SuppressLint
import android.app.Activity
import android.content.ComponentName
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient

/**
 * 앱 본 화면은 웹 프로토타입(assets/web/index.html)을 그대로 쓴다.
 * 웹 화면은 window.PengomNative 로 실제 카운트를 읽고 아침 약속을 저장한다.
 */
class MainActivity : Activity() {

    private lateinit var web: WebView
    private lateinit var store: CounterStore

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        store = CounterStore(this)
        web = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            webViewClient = WebViewClient()
            addJavascriptInterface(Bridge(), "PengomNative")
            loadUrl("file:///android_asset/web/index.html")
        }
        setContentView(web)
    }

    override fun onResume() {
        super.onResume()
        // 권한 화면이나 인스타에서 돌아오면 바로 최신 숫자로
        web.evaluateJavascript("window.__pengomNativeRefresh && window.__pengomNativeRefresh()", null)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (web.canGoBack()) web.goBack() else super.onBackPressed()
    }

    private fun serviceEnabled(): Boolean {
        val me = ComponentName(this, ScrollCounterService::class.java).flattenToString()
        val list = Settings.Secure.getString(contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: return false
        return list.split(':').any { it.equals(me, ignoreCase = true) }
    }

    inner class Bridge {
        @JavascriptInterface fun getState(): String = store.stateJson()

        @JavascriptInterface fun isCounting(): Boolean = serviceEnabled()

        @JavascriptInterface fun setPromise(budget: Int, reason: String, th: String, overTh: String) =
            store.setPromise(budget, reason, th, overTh)

        @JavascriptInterface fun openAccessibilitySettings() = runOnUiThread {
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }

        /** 인스타 → 유튜브 → 틱톡 순서로 깔려 있는 앱을 연다 */
        @JavascriptInterface fun openShorts(): Boolean {
            for (pkg in ScrollCounterService.TARGETS) {
                val i = packageManager.getLaunchIntentForPackage(pkg) ?: continue
                runOnUiThread { startActivity(i) }
                return true
            }
            return false
        }
    }
}
