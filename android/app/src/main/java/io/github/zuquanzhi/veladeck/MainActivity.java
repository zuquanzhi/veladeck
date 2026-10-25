package io.github.zuquanzhi.veladeck;

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
import android.widget.ImageView;
import android.graphics.drawable.GradientDrawable;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.browser.customtabs.CustomTabColorSchemeParams;

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

    private GradientDrawable rounded(int color, int radius, boolean border) {
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(color);
        shape.setCornerRadius(dp(radius));
        if (border) shape.setStroke(dp(1), getColor(R.color.app_line));
        return shape;
    }

    private void render() {
        int ink = getColor(R.color.app_text);
        int secondary = getColor(R.color.app_secondary);
        int background = getColor(R.color.app_background);
        getWindow().setStatusBarColor(background);
        getWindow().setNavigationBarColor(background);
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(background);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(dp(28), dp(44), dp(28), dp(30));
        scroll.addView(layout);
        TextView eyebrow = text("VELADECK / MOBILE", 10, secondary);
        eyebrow.setTypeface(Typeface.MONOSPACE);
        eyebrow.setLetterSpacing(0.12f);
        layout.addView(eyebrow);
        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.ic_brand);
        logo.setContentDescription("VelaDeck");
        LinearLayout.LayoutParams logoParams = new LinearLayout.LayoutParams(dp(76), dp(76));
        logoParams.topMargin = dp(42);
        logoParams.bottomMargin = dp(20);
        layout.addView(logo, logoParams);
        TextView title = text("你的工作台。\n随身就绪。", 35, ink);
        title.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        title.setLetterSpacing(-0.035f);
        title.setLineSpacing(dp(2), 1.0f);
        layout.addView(title);
        layout.addView(text("连接智能体的进展，让每一次产出与决定触手可及。", 14, secondary));
        TextView label = text("工作台地址", 12, secondary);
        LinearLayout.LayoutParams labelParams = new LinearLayout.LayoutParams(-1, -2);
        labelParams.topMargin = dp(22);
        layout.addView(label, labelParams);
        address = new EditText(this);
        address.setSingleLine(true);
        address.setTextSize(14);
        address.setTextColor(ink);
        address.setHintTextColor(secondary);
        address.setHint("https://your-workspace.example");
        address.setPadding(dp(15), 0, dp(15), 0);
        address.setBackground(rounded(getColor(R.color.app_surface), 13, true));
        address.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);
        address.setAutofillHints(View.AUTOFILL_HINT_USERNAME);
        address.setText(preferences.getString("server", ""));
        layout.addView(address, new LinearLayout.LayoutParams(-1, dp(52)));
        error = text("", 12, getColor(R.color.app_error));
        layout.addView(error);
        Button connect = new Button(this);
        connect.setAllCaps(false);
        connect.setText(sharedText == null ? "连接工作台  →" : "分享到 Inbox  →");
        connect.setTextSize(14);
        connect.setTextColor(Color.WHITE);
        connect.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        connect.setBackground(rounded(Color.rgb(0, 110, 225), 13, false));
        connect.setOnClickListener(view -> openWorkspace());
        layout.addView(connect, new LinearLayout.LayoutParams(-1, dp(50)));
        TextView help = text("首次连接时，输入服务器生成的一次性配对码。", 12, secondary);
        help.setPadding(0, dp(21), 0, dp(12));
        layout.addView(help);
        View separator = new View(this);
        separator.setBackgroundColor(getColor(R.color.app_line));
        LinearLayout.LayoutParams separatorParams = new LinearLayout.LayoutParams(-1, dp(1));
        separatorParams.topMargin = dp(26);
        separatorParams.bottomMargin = dp(15);
        layout.addView(separator, separatorParams);
        TextView footer = text("HTTPS CONNECTION  /  YOUR OWN SERVER", 9, secondary);
        footer.setTypeface(Typeface.MONOSPACE);
        layout.addView(footer);
        layout.addView(text("v" + BuildConfig.VERSION_NAME + "  ·  Android 8.0+", 10, secondary));
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
            new CustomTabsIntent.Builder().setShowTitle(true).setDefaultColorSchemeParams(new CustomTabColorSchemeParams.Builder().setToolbarColor(getColor(R.color.app_background)).setNavigationBarColor(getColor(R.color.app_background)).build()).build().launchUrl(this, uri);
            sharedText = null;
            error.setText("");
        } catch (ActivityNotFoundException exception) {
            error.setText("请先安装支持 HTTPS 的浏览器，例如 Chrome。");
        }
    }
}
