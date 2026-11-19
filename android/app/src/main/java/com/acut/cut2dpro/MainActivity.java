package com.acut.cut2dpro;

import android.graphics.Color;
import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

/**
 * A-Cut 2Dpro — اکتیویتی اصلی (پوستهٔ Capacitor/WebView)
 * =====================================================
 * تغییرات UI/UX داشبوردی:
 *
 * ۱) **حذف نوار بالایی بومی**: تم برنامه از `AppTheme ... NoActionBar` استفاده
 *    می‌کند (res/values/styles.xml) و اینجا هم اکشن‌بار صریحاً پنهان می‌شود؛
 *    بنابراین هیچ هدر/عنوانی بالای WebView نمی‌ماند و فضای بالای صفحه هدر
 *    نمی‌خورد.
 *
 * ۲) **ناحیهٔ امن (safe-area)**: مسئولیت insets به Capacitor 8 سپرده شده است
 *    (`SystemBars.insetsHandling = "native"` در `capacitor.config.ts`) و مرورگر
 *    مقادیر `env(safe-area-inset-*)` را تزریق می‌کند. بنابراین اینجا **نباید**
 *    دوباره padding بدهیم؛ در غیر این صورت فاصلهٔ امن دو بار اعمال می‌شود
 *    («فضای خالی» یا شکاف در بالای صفحه). React با
 *    `.app-shell { padding-top: env(safe-area-inset-top) }` و
 *    `.bottom-nav { padding-bottom: env(safe-area-inset-bottom) }` کار را تمام
 *    می‌کند. `viewport-fit=cover` هم در `index.html` تضمین شده است.
 *
 * ۳) **دکمهٔ بازگشت سخت‌افزاری**: Capacitor رویداد `backbutton` را به صفحه
 *    می‌فرستد؛ `App.tsx` با `history` به‌عقب می‌رود و فقط در داشبورد اجازهٔ
 *    بستن اپ می‌دهد (پیش‌فرض Capacitor اگر رویداد preventDefault نشود اپ را
 *    می‌بندد).
 */
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // ۱) هیچ نوار عنوانی: نه از تم (NoActionBar) و نه از کد
        if (getSupportActionBar() != null) {
            getSupportActionBar().hide();
        }

        // ۳) رنگ پس‌زمینهٔ WebView همرنگ بدنهٔ برنامه (بدون فلش سفید پیش از رندر)
        Bridge bridge = getBridge();
        if (bridge == null || bridge.getWebView() == null) return;
        WebView webView = bridge.getWebView();
        webView.setBackgroundColor(Color.rgb(0xED, 0xF2, 0xFA));

        // ۲) insets دست‌نخورده می‌ماند: Capacitor (SystemBars) و CSS آن را
        //    مدیریت می‌کنند؛ هیچ setPadding/setOnApplyWindowInsetsListener اینجا نیست.
    }
}
