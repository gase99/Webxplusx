package com.acut.cut2dpro;

import android.graphics.Color;
import android.os.Bundle;
import android.webkit.WebView;

import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Bridge;

/**
 * A-Cut 2Dpro — اکتیویتی اصلی (پوستهٔ Capacitor/WebView)
 * =====================================================
 * تغییرات UI/UX داشبوردی:
 *
 * ۱) **حذف نوار بالایی بومی**: تم برنامه از `*.NoActionBar` استفاده می‌کند و
 *    اینجا هم صریحاً ActionBar غیرفعال می‌شود تا هیچ هدر/عنوانی بالای صفحه
 *    نماند (منبع «فضای هدر خوردهٔ» بالای اپ در نسخه‌های قبل).
 *
 * ۲) **ناحیهٔ امن (safe-area)**: نوار وضعیت اندروید نباید روی محتوای React
 *    بیفتد. دو حالت ممکن است:
 *      - WebView محتوا را زیر نوار وضعیت نمی‌برد (رفتار پیش‌فرض Capacitor)
 *      - یا با edge-to-edge، محتوا زیر آن می‌رود و CSS با
 *        `env(safe-area-inset-top)` خودش فاصله می‌دهد.
 *    ما `fitSystemWindows` را روشن می‌کنیم و این‌ست‌ها را به WebView
 *    پاس می‌دهیم تا در هر دو حالت هیچ هم‌پوشانی‌ای رخ ندهد؛ سپس
 *    `viewport-fit=cover` در index.html باعث می‌شود مقادیر safe-area در
 *    مرورگر/WV معتبر باشند.
 *
 * ۳) **دکمهٔ بازگشت سخت‌افزاری**: Capacitor رویداد `backbutton` را در React
 *    توزیع می‌کند (App.tsx با history به‌عقب می‌رود). رفتار پیش‌فرض Capacitor
 *    همان behavior است؛ پس اینجا فقط از بستن ناگهانی اپ در صفحهٔ داشبورد
 *    اطمینان می‌دهیم (React در اپ منطق را کنترل می‌کند).
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // ۱) هیچ نوار عنوانی، نه از تم و نه از کد
        if (getSupportActionBar() != null) {
            getSupportActionBar().hide();
        }

        // ۲) ناحیهٔ امن: محتوا زیر نوار وضعیت / نوار ناوبری پایین نرود
        Bridge bridge = getBridge();
        if (bridge == null || bridge.getWebView() == null) return;
        WebView webView = bridge.getWebView();
        // WebView خودش رنگ پس‌زمینهٔ برنامه را نشان دهد (بدون فلش سفید در دارک‌مود)
        webView.setBackgroundColor(Color.rgb(0xED, 0xF2, 0xFA));
        ViewCompat.setOnApplyWindowInsetsListener(webView, (view, insets) -> {
            androidx.core.graphics.Insets bars =
                insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            // فاصلهٔ امن را به محتوا می‌دهیم؛ React هم از env(safe-area-inset-*) استفاده می‌کند
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return insets;
        });
        ViewCompat.requestApplyInsets(webView);
    }
}
