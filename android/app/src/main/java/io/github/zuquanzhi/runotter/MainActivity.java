package io.github.zuquanzhi.runotter;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import androidx.browser.customtabs.CustomTabsIntent;

/** Browser-backed companion: preserves the browser's cookie, passkey and TLS security boundaries. */
public final class MainActivity extends Activity {
    private EditText address;
    private TextView error;
    private String sharedText;
    private SharedPreferences preferences;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        preferences = getSharedPreferences("connection", MODE_PRIVATE);
        sharedText = extractSharedText(getIntent());
        render();
        if (state == null && !preferences.getString("server", "").isEmpty()) openWorkspace();
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        sharedText = extractSharedText(intent);
        if (!preferences.getString("server", "").isEmpty()) openWorkspace();
    }

    private String extractSharedText(Intent intent) {
        if (!Intent.ACTION_SEND.equals(intent.getAction()) || !"text/plain".equals(intent.getType())) return null;
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        return text == null ? null : text.substring(0, Math.min(text.length(), 32000));
    }

    private int dp(int value) { return (int) (value * getResources().getDisplayMetrics().density); }

    private TextView text(String value, int size, int color) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(color);
        view.setPadding(0, dp(10), 0, dp(10));
        return view;
    }

    private void render() {
        getWindow().setStatusBarColor(Color.rgb(20, 63, 52));
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(Color.rgb(243, 245, 241));
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(dp(28), dp(68), dp(28), dp(36));
        scroll.addView(layout);
        layout.addView(text("🦦", 64, Color.rgb(24, 59, 53)));
        TextView title = text("RunOtter", 38, Color.rgb(24, 59, 53));
        title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        layout.addView(title);
        layout.addView(text("Your AI agents, in your pocket.", 16, Color.rgb(80, 115, 96)));
        layout.addView(text("连接你的工作台", 23, Color.rgb(24, 59, 53)));
        layout.addView(text("输入自托管服务器的 HTTPS 地址。配对、对话和审批将在安全浏览器窗口中打开。", 15, Color.rgb(100, 120, 106)));
        address = new EditText(this);
        address.setSingleLine(true);
        address.setHint("https://your-server.example/dock");
        address.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);
        address.setAutofillHints(View.AUTOFILL_HINT_USERNAME);
        address.setText(preferences.getString("server", ""));
        layout.addView(address, new LinearLayout.LayoutParams(-1, dp(64)));
        error = text("", 13, Color.rgb(180, 70, 50));
        layout.addView(error);
        Button connect = new Button(this);
        connect.setText(sharedText == null ? "打开工作台 →" : "分享到 Inbox →");
        connect.setTextColor(Color.WHITE);
        connect.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(23, 108, 84)));
        connect.setOnClickListener(view -> openWorkspace());
        layout.addView(connect, new LinearLayout.LayoutParams(-1, dp(56)));
        layout.addView(text("首次连接后，在服务器运行 npm run pair 获取配对码。此 APK 是远端工作台的客户端，手机内不运行 AI 后端。", 13, Color.rgb(100, 120, 106)));
        layout.addView(text("预览版 0.1.0 · Android 8.0+\n推送通知建议同时安装服务器的 PWA。", 12, Color.rgb(130, 145, 134)));
        setContentView(scroll);
    }

    private void openWorkspace() {
        String value = address.getText().toString().trim().replaceAll("/+$", "");
        Uri uri = Uri.parse(value);
        if (!"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null) {
            error.setText("请输入完整 HTTPS 地址，不要包含账号密码、查询参数或片段。");
            return;
        }
        preferences.edit().putString("server", value).apply();
        if (sharedText != null) {
            uri = Uri.parse(value + "/share").buildUpon().appendQueryParameter("text", sharedText).build();
        }
        try {
            InputMethodManager keyboard = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
            if (keyboard != null) keyboard.hideSoftInputFromWindow(address.getWindowToken(), 0);
            new CustomTabsIntent.Builder().setShowTitle(true).build().launchUrl(this, uri);
            sharedText = null;
            error.setText("");
        } catch (ActivityNotFoundException exception) {
            error.setText("请先安装支持 HTTPS 的浏览器，例如 Chrome。");
        }
    }
}
