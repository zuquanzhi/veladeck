package io.github.zuquanzhi.veladeck;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
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
import androidx.core.content.FileProvider;
import java.io.File;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Browser-backed companion: preserves the browser's cookie, passkey and TLS security boundaries. */
public final class MainActivity extends Activity {
    private static final String SHOW_UPDATES = "io.github.zuquanzhi.veladeck.SHOW_UPDATES";
    private static final long CHECK_INTERVAL = 24L * 60 * 60 * 1000;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private EditText address;
    private TextView error;
    private String sharedText;
    private SharedPreferences preferences;
    private TextView updateStatus;
    private Button updateButton;
    private GithubUpdates updates;
    private UpdatePolicy.Release available;
    private File downloaded;
    private boolean resumed, deferredPrompt, waitingForInstallPermission, busy, workspaceOpened;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        preferences = getSharedPreferences("connection", MODE_PRIVATE);
        updates = new GithubUpdates(this);
        sharedText = extractSharedText(getIntent());
        render();
        boolean manual = SHOW_UPDATES.equals(getIntent().getAction());
        boolean connect = state == null && !manual && !preferences.getString("server", "").isEmpty();
        long elapsed = System.currentTimeMillis() - preferences.getLong("update_checked_at", 0);
        if (manual || (BuildConfig.UPDATES_ENABLED && (elapsed < 0 || elapsed >= CHECK_INTERVAL
                || preferences.getBoolean("update_available", false)))) checkForUpdates(manual, connect);
        else if (connect) openWorkspace();
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (SHOW_UPDATES.equals(intent.getAction())) {
            if (!busy) checkForUpdates(true, false);
            return;
        }
        sharedText = extractSharedText(intent);
        if (!preferences.getString("server", "").isEmpty()) openWorkspace();
    }

    @Override protected void onResume() {
        super.onResume();
        resumed = true;
        if (waitingForInstallPermission) {
            waitingForInstallPermission = false;
            if (getPackageManager().canRequestPackageInstalls()) requestInstall();
            else updateStatus.setText("安装权限尚未开启。准备好后点击“安装更新”重试。");
        } else if (deferredPrompt) showUpdate();
    }

    @Override protected void onPause() { resumed = false; super.onPause(); }

    @Override protected void onDestroy() { worker.shutdownNow(); super.onDestroy(); }

    private void ui(Runnable action) {
        runOnUiThread(() -> { if (!isFinishing() && !isDestroyed()) action.run(); });
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
        updateButton = new Button(this);
        updateButton.setAllCaps(false);
        updateButton.setText("检查应用更新");
        updateButton.setTextSize(13);
        updateButton.setTextColor(ink);
        updateButton.setBackground(rounded(getColor(R.color.app_surface), 12, true));
        updateButton.setOnClickListener(view -> {
            if (downloaded != null) requestInstall();
            else if (available != null) downloadUpdate();
            else checkForUpdates(true, false);
        });
        layout.addView(updateButton, new LinearLayout.LayoutParams(-1, dp(46)));
        updateStatus = text(BuildConfig.UPDATES_ENABLED
                ? "每天自动检查更新，安装前由你确认。" : "开发构建不提供覆盖升级，请使用 GitHub Release 安装包。", 11, secondary);
        updateStatus.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        layout.addView(updateStatus);
        setContentView(scroll);
    }

    private void checkForUpdates(boolean manual, boolean connectAfterCheck) {
        if (busy) return;
        if (!BuildConfig.UPDATES_ENABLED) {
            updateStatus.setText("请从 GitHub Release 安装固定签名版本。");
            return;
        }
        busy = true;
        updateButton.setEnabled(false);
        updateStatus.setText("正在检查 GitHub 上的新版本…");
        worker.execute(() -> {
            try {
                UpdatePolicy.Release release = updates.check(manual);
                ui(() -> {
                    busy = false;
                    available = release;
                    preferences.edit().putLong("update_checked_at", System.currentTimeMillis())
                            .putBoolean("update_available", release != null).apply();
                    updateButton.setEnabled(true);
                    updateButton.setText(release == null ? "再次检查更新" : "下载 v" + release.version);
                    updateStatus.setText(release == null ? "当前已是最新版本。" : "发现新版本 v" + release.version + "，可下载并安装。");
                    if (release != null) { deferredPrompt = true; if (resumed) showUpdate(); }
                    else if (connectAfterCheck && !workspaceOpened) openWorkspace();
                });
            } catch (Exception ignored) {
                ui(() -> {
                    busy = false;
                    updateButton.setEnabled(true);
                    updateStatus.setText("暂时无法检查更新，请稍后重试。工作台仍可正常连接。");
                    if (connectAfterCheck && !workspaceOpened) openWorkspace();
                });
            }
        });
    }

    private void showUpdate() {
        deferredPrompt = false;
        if (available == null || busy) return;
        new AlertDialog.Builder(this).setTitle("VelaDeck v" + available.version)
            .setMessage("发现新版本。下载完成后将交给系统确认安装。\n\n" + available.notes)
            .setPositiveButton("下载并安装", (dialog, which) -> downloadUpdate())
            .setNegativeButton("稍后", (dialog, which) -> {
                if (!workspaceOpened && !preferences.getString("server", "").isEmpty()) openWorkspace();
            })
            .setNeutralButton("发布说明", (dialog, which) -> {
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(UpdatePolicy.REPOSITORY + "/releases/tag/v" + available.version))); }
                catch (ActivityNotFoundException ignored) { updateStatus.setText("未找到可打开发布说明的浏览器。"); }
            }).show();
    }

    private void downloadUpdate() {
        if (busy || available == null) return;
        UpdatePolicy.Release release = available;
        busy = true;
        updateButton.setEnabled(false);
        updateStatus.setText("正在下载更新…");
        worker.execute(() -> {
            try {
                int[] lastPercent = {-1};
                File file = updates.download(release, bytes -> {
                    int percent = (int) (bytes * 100 / release.size);
                    if (percent != lastPercent[0]) {
                        lastPercent[0] = percent;
                        ui(() -> updateStatus.setText("正在下载更新 · " + percent + "%"));
                    }
                });
                ui(() -> {
                    busy = false;
                    downloaded = file;
                    updateButton.setEnabled(true);
                    updateButton.setText("安装更新");
                    updateStatus.setText("下载与签名校验通过，可以安装。");
                    if (resumed) requestInstall();
                });
            } catch (Exception ignored) {
                ui(() -> {
                    busy = false;
                    updateButton.setEnabled(true);
                    updateStatus.setText("下载或校验未完成，请重试。当前安装的版本不受影响。");
                });
            }
        });
    }

    private void requestInstall() {
        if (downloaded == null || available == null || busy) return;
        if (!getPackageManager().canRequestPackageInstalls()) {
            new AlertDialog.Builder(this).setTitle("允许安装应用更新")
                .setMessage("请在系统设置中允许 VelaDeck 安装应用更新，然后返回继续。每次安装仍需要你确认。")
                .setPositiveButton("去设置", (dialog, which) -> {
                    try {
                        waitingForInstallPermission = true;
                        startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName())));
                    } catch (ActivityNotFoundException ignored) {
                        waitingForInstallPermission = false;
                        updateStatus.setText("请在系统设置中允许 VelaDeck 安装未知应用后重试。");
                    }
                }).setNegativeButton("稍后", null).show();
            return;
        }
        busy = true;
        updateButton.setEnabled(false);
        worker.execute(() -> {
            try {
                updates.validateApk(downloaded, available);
                ui(() -> {
                    busy = false;
                    updateButton.setEnabled(true);
                    Uri file = FileProvider.getUriForFile(this, getPackageName() + ".updates", downloaded);
                    Intent install = new Intent(Intent.ACTION_VIEW).setDataAndType(file, "application/vnd.android.package-archive")
                            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    install.setClipData(ClipData.newRawUri("VelaDeck update", file));
                    try { startActivity(install); updateStatus.setText("请在系统安装界面确认更新。"); }
                    catch (ActivityNotFoundException ignored) { updateStatus.setText("未找到系统安装器，可以稍后重试。"); }
                });
            } catch (Exception ignored) {
                ui(() -> {
                    busy = false;
                    downloaded = null;
                    updateButton.setEnabled(true);
                    updateButton.setText("重新下载更新");
                    updateStatus.setText("安装包校验失败，请重新下载。");
                });
            }
        });
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
            Intent updateIntent = new Intent(this, MainActivity.class).setAction(SHOW_UPDATES)
                    .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent updateMenu = PendingIntent.getActivity(this, 1, updateIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            new CustomTabsIntent.Builder().setShowTitle(true).addMenuItem("应用更新", updateMenu)
                    .setDefaultColorSchemeParams(new CustomTabColorSchemeParams.Builder().setToolbarColor(getColor(R.color.app_background)).setNavigationBarColor(getColor(R.color.app_background)).build()).build().launchUrl(this, uri);
            workspaceOpened = true;
            sharedText = null;
            error.setText("");
        } catch (ActivityNotFoundException exception) {
            error.setText("请先安装支持 HTTPS 的浏览器，例如 Chrome。");
        }
    }
}
