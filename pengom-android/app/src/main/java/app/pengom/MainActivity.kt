package app.pengom

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient

/**
 * 앱 본 화면은 웹 프로토타입(assets/web/index.html)을 그대로 쓴다.
 * 웹 화면은 window.PengomNative 로 실제 사용 시간을 읽고 아침 약속을 저장한다.
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
        if (Perms.all(this)) UsageWatchService.start(this)
        // 설정 화면이나 인스타에서 돌아오면 바로 최신 시간으로
        web.evaluateJavascript("window.__pengomNativeRefresh && window.__pengomNativeRefresh()", null)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (web.canGoBack()) web.goBack() else super.onBackPressed()
    }

    /** 아직 없는 권한 하나를 골라 그 설정 화면을 연다 */
    private fun askNextPermission() {
        when {
            !Perms.usage(this) ->
                startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
            !Perms.overlay(this) ->
                startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")))
            Build.VERSION.SDK_INT >= 33 &&
                checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED ->
                requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
            else -> UsageWatchService.start(this)
        }
    }

    inner class Bridge {
        @JavascriptInterface fun getState(): String = store.stateJson()

        @JavascriptInterface fun isCounting(): Boolean = Perms.all(this@MainActivity)

        @JavascriptInterface fun setPromise(budgetMin: Int, reason: String, th: String, overTh: String) =
            store.setPromise(budgetMin, reason, th, overTh)

        /** 이름은 웹 화면과 맞추느라 그대로 둠: 필요한 권한 화면을 차례로 연다 */
        @JavascriptInterface fun openAccessibilitySettings() = runOnUiThread { askNextPermission() }

        /** 인스타 → 유튜브 → 틱톡 순서로 깔려 있는 앱을 연다 */
        @JavascriptInterface fun openShorts(): Boolean {
            for (pkg in UsageWatchService.TARGETS) {
                val i = packageManager.getLaunchIntentForPackage(pkg) ?: continue
                runOnUiThread { startActivity(i) }
                return true
            }
            return false
        }
    }
}
