package io.github.zuquanzhi.veladeck;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.text.InputFilter;
import android.text.InputType;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Native one-time device pairing, with no browser cookies or web login screen. */
public final class PairActivity extends NativeActivity {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        NativeUi ui = new NativeUi(this);
        ScrollView root = new ScrollView(this); root.setFillViewport(true); root.setBackgroundColor(ui.background);
        LinearLayout body = ui.column(); ui.pad(body, 28, 36); root.addView(body);
        body.addView(ui.label("VELADECK / TRUSTED DEVICE")); ui.gap(body, 38);
        ImageView mark = new ImageView(this); mark.setImageResource(R.drawable.ic_brand); mark.setContentDescription("VelaDeck");
        body.addView(mark, new LinearLayout.LayoutParams(ui.dp(64), ui.dp(64))); ui.gap(body, 24);
        body.addView(ui.title("连接你的工作台", 29)); ui.description(body, "输入服务器生成的配对码，让进展触手可及。"); ui.gap(body, 22);
        SessionVault vault = new SessionVault(this);
        TextView host = ui.text(vault.server(), 12, ui.muted); host.setTextIsSelectable(true); body.addView(host); ui.gap(body, 22);
        body.addView(ui.text("设备名称", 12, ui.muted)); ui.gap(body, 8);
        EditText name = ui.input("设备名称", false); name.setText(Build.MODEL); name.setFilters(new InputFilter[]{new InputFilter.LengthFilter(80)}); body.addView(name, ui.fill()); ui.gap(body, 18);
        body.addView(ui.text("一次性配对码", 12, ui.muted)); ui.gap(body, 8);
        EditText code = ui.input("6 位配对码", false); code.setInputType(InputType.TYPE_CLASS_NUMBER); code.setLetterSpacing(.18f); code.setTextSize(24);
        code.setFilters(new InputFilter[]{new InputFilter.LengthFilter(6)}); body.addView(code, ui.fill()); ui.gap(body, 16);
        TextView error = ui.text("", 13, ui.error); body.addView(error); ui.gap(body, 12);
        Button connect = ui.button("配对并进入工作台", true, () -> {});
        connect.setOnClickListener(view -> {
            String digits = code.getText().toString(), device = name.getText().toString().trim();
            if (!digits.matches("[0-9]{6}") || device.isEmpty()) { error.setText("请填写设备名称和 6 位配对码。"); return; }
            connect.setEnabled(false); error.setText("");
            worker.execute(() -> {
                try {
                    NativeApi api = new NativeApi(this);
                    api.send("/api/pair/claim", "POST", NativeApi.object("code", digits, "device_name", device));
                    api.get("/api/session");
                    runOnUiThread(() -> {
                        if (isFinishing() || isDestroyed()) return;
                        Intent next = new Intent(this, WorkspaceActivity.class);
                        next.putExtra("share_text", getIntent().getStringExtra("share_text")); startActivity(next); finish();
                    });
                } catch (Exception e) {
                    runOnUiThread(() -> { if (!isDestroyed()) { connect.setEnabled(true); error.setText(e instanceof NativeApi.ApiException ? e.getMessage() : "暂时无法连接，请检查工作台地址和网络。"); } });
                }
            });
        });
        body.addView(connect, ui.fill()); ui.gap(body, 18);
        ui.description(body, "在服务器运行 npm run pair。配对码 5 分钟有效，仅可使用一次。");
        ui.description(body, "设备会话由 Android Keystore 加密保存。");
        setContentView(root); ui.systemBars(this, root);
    }
    @Override protected void onDestroy() { worker.shutdownNow(); super.onDestroy(); }
}
