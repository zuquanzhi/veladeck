package io.github.zuquanzhi.veladeck;

import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.Editable;
import android.text.TextWatcher;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.PopupMenu;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.Switch;
import android.widget.TableLayout;
import android.widget.TableRow;
import android.widget.TextView;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Consumer;

/** Entire workspace is Android Views backed by authenticated JSON APIs, never an embedded website. */
public final class WorkspaceActivity extends NativeActivity {
    private final ExecutorService worker = Executors.newFixedThreadPool(3);
    private final Handler handler = new Handler(Looper.getMainLooper());
    private NativeUi ui;
    private NativeApi api;
    private LinearLayout root, navigation, body;
    private FrameLayout page;
    private ScrollView scroll;
    private JSONObject session;
    private int tab, generation;
    private String detail = "", artifactQuery = "", artifactFilter = "", sharedText;
    private NativeApi.Stream stream;
    private long lastSequence;
    private Runnable progressTask, refreshTask;
    private android.view.ViewTreeObserver.OnScrollChangedListener readingListener;
    private File pendingSave;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        SessionVault vault = new SessionVault(this);
        if (!vault.paired()) { startActivity(new Intent(this, PairActivity.class)); finish(); return; }
        ui = new NativeUi(this); api = new NativeApi(this);
        root = ui.column(); root.setBackgroundColor(ui.background);
        LinearLayout bar = ui.row(); ui.pad(bar, 20, 13);
        ImageView logo = new ImageView(this); logo.setImageResource(R.drawable.ic_brand); logo.setContentDescription("VelaDeck");
        bar.addView(logo, new LinearLayout.LayoutParams(ui.dp(30), ui.dp(30)));
        TextView brand = ui.title("VelaDeck.", 22); LinearLayout.LayoutParams bp = new LinearLayout.LayoutParams(0, -2, 1); bp.leftMargin = ui.dp(10); bar.addView(brand, bp);
        Button inbox = ui.button("Inbox", false, () -> inbox("new")); inbox.setContentDescription("打开 Inbox"); bar.addView(inbox);
        root.addView(bar, ui.fill());
        page = new FrameLayout(this); root.addView(page, new LinearLayout.LayoutParams(-1, 0, 1));
        navigation = ui.row(); ui.pad(navigation, 7, 6); navigation.setBackground(ui.rounded(ui.surface, 28, true)); navigation.setElevation(ui.dp(3));
        LinearLayout.LayoutParams navParams = new LinearLayout.LayoutParams(-1, ui.dp(70)); navParams.setMargins(ui.dp(16), ui.dp(8), ui.dp(16), ui.dp(10)); root.addView(navigation, navParams);
        setContentView(root); ui.systemBars(this, root);
        sharedText = getIntent().getStringExtra("share_text");
        tab = state == null ? 0 : state.getInt("tab", 0);
        begin("正在验证设备…", "", "");
        run(() -> api.get("/api/session"), current -> {
            session = current;
            if (sharedText != null && !sharedText.isEmpty()) inbox("new");
            else show(tab);
            String link = getIntent().getStringExtra("native_link");
            if (link != null && link.startsWith("/artifacts/")) artifact(link.substring(11));
            else if (link != null && link.startsWith("/threads/")) thread(link.substring(9), "对话");
            else if ("/approvals".equals(link)) show(2);
        });
    }

    private void navigate() {
        navigation.removeAllViews();
        String[] titles = {"产物", "对话", "审批", "运维", "设置"}, icons = {"layers", "chat", "shield", "activity", "settings"};
        for (int i = 0; i < titles.length; i++) {
            final int selected = i; boolean active = tab == i;
            LinearLayout item = ui.column(); item.setGravity(Gravity.CENTER); item.setContentDescription(titles[i]); item.setClickable(true); item.setFocusable(true);
            if (active) item.setBackground(ui.rounded(0x16087CFA, 22, false));
            ImageView icon = new ImageView(this); icon.setImageDrawable(ui.icon(icons[i], active ? ui.blue : ui.muted));
            item.addView(icon, new LinearLayout.LayoutParams(ui.dp(22), ui.dp(22))); ui.gap(item, 3);
            item.addView(ui.text(titles[i], 11, active ? ui.blue : ui.muted));
            item.setOnClickListener(v -> show(selected)); navigation.addView(item, new LinearLayout.LayoutParams(0, -1, 1));
        }
    }

    private void show(int selected) {
        tab = selected; detail = ""; navigate();
        switch (tab) { case 1: threads(""); break; case 2: approvals("pending"); break; case 3: operations(); break; case 4: settings(); break; default: artifacts(); }
    }

    private void begin(String title, String subtitle, String label) {
        generation++;
        if (readingListener != null && scroll != null && scroll.getViewTreeObserver().isAlive()) scroll.getViewTreeObserver().removeOnScrollChangedListener(readingListener);
        readingListener = null;
        if (stream != null) { stream.close(); stream = null; }
        if (progressTask != null) handler.removeCallbacks(progressTask);
        if (refreshTask != null) handler.removeCallbacks(refreshTask);
        page.removeAllViews(); scroll = new ScrollView(this); scroll.setFillViewport(true);
        body = ui.column(); ui.pad(body, 20, 20); scroll.addView(body); page.addView(scroll, new FrameLayout.LayoutParams(-1, -1));
        if (!label.isEmpty()) { body.addView(ui.label(label)); ui.gap(body, 14); }
        body.addView(ui.title(title, 31)); if (!subtitle.isEmpty()) ui.description(body, subtitle); ui.gap(body, 21);
    }

    private <T> void run(Callable<T> task, Consumer<T> success) {
        int captured = generation;
        worker.execute(() -> {
            try { T value = task.call(); runOnUiThread(() -> { if (!isDestroyed() && generation == captured) success.accept(value); }); }
            catch (Exception error) { runOnUiThread(() -> { if (!isDestroyed() && generation == captured) failed(error); }); }
        });
    }

    private void failed(Exception error) {
        if (error instanceof NativeApi.ApiException && ((NativeApi.ApiException) error).status == 401) {
            api.vault.clearCookie(); startActivity(new Intent(this, PairActivity.class)); finish(); return;
        }
        String message = error instanceof NativeApi.ApiException ? error.getMessage() : "暂时无法连接，请检查网络并重试。";
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
    }

    private void action(String path, String method, JSONObject value, Runnable done) { run(() -> api.send(path, method, value), ignored -> done.run()); }
    private void confirm(String title, String message, Runnable yes) { new AlertDialog.Builder(this).setTitle(title).setMessage(message).setPositiveButton("确认", (d, w) -> yes.run()).setNegativeButton("取消", null).show(); }
    private void prompt(String title, String value, boolean multiline, Consumer<String> submit) {
        EditText input = ui.input(title, multiline); input.setText(value); LinearLayout box = ui.column(); ui.pad(box, 20, 12); box.addView(input, ui.fill());
        AlertDialog dialog = new AlertDialog.Builder(this).setTitle(title).setView(box).setPositiveButton("保存", null).setNegativeButton("取消", null).create();
        dialog.setOnShowListener(d -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            String text = input.getText().toString().trim(); if (text.isEmpty()) { input.setError("请填写内容"); return; } dialog.dismiss(); submit.accept(text);
        })); dialog.show();
    }
    private void empty(LinearLayout parent, String text) { LinearLayout card = ui.card(parent); card.addView(ui.title(text, 18)); ui.description(card, "新的进展会在这里出现。"); }

    private void artifacts() {
        begin("工作台.", "从一条指令，到每一次完成。", "WORKSPACE / OVERVIEW");
        ui.actions(body, ui.button("刷新", false, this::artifacts), ui.button("新对话", true, () -> createThread("新的对话")));
        ui.gap(body, 18);
        LinearLayout stats = ui.row(); body.addView(stats, ui.fill());
        String[] names = {"产物总数", "等待审批", "Inbox"}; TextView[] values = new TextView[3];
        for (int i = 0; i < 3; i++) {
            final int index = i;
            LinearLayout card = ui.column(); ui.pad(card, 12, 14); card.setBackground(ui.rounded(i == 0 ? 0x12087CFA : ui.surface, 17, true));
            card.addView(ui.text(names[i], 11, ui.muted)); ui.gap(card, 10); values[i] = ui.title("—", 30); if (i == 0) values[i].setTextColor(ui.blue); card.addView(values[i]);
            card.setOnClickListener(v -> { if (index == 1) show(2); else if (index == 2) inbox("new"); });
            LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, ui.dp(111), 1); if (i > 0) p.leftMargin = ui.dp(8); stats.addView(card, p);
        }
        run(() -> NativeApi.object("files", api.get("/api/artifacts?size=1").optInt("total"), "digest", api.get("/api/digest/today")), data -> {
            values[0].setText(String.valueOf(data.optInt("files"))); JSONObject digest = data.optJSONObject("digest");
            values[1].setText(String.valueOf(digest.optInt("pending_approvals"))); values[2].setText(String.valueOf(digest.optInt("inbox")));
        });
        ui.gap(body, 21); EditText search = ui.input("搜索产物、项目或关键词", false); search.setText(artifactQuery); body.addView(search, ui.fill());
        HorizontalScrollView chips = new HorizontalScrollView(this); chips.setHorizontalScrollBarEnabled(false); LinearLayout filters = ui.row(); ui.pad(filters, 0, 12); chips.addView(filters); body.addView(chips);
        LinearLayout results = ui.column(); body.addView(results, ui.fill());
        String[][] options = {{"全部", ""}, {"星标", "&starred=true"}, {"稍后读", "&read_later=true"}, {"报告", "&kind=markdown"}, {"数据", "&kind=csv"}};
        for (String[] option : options) {
            Button chip = ui.button(option[0], option[1].equals(artifactFilter), () -> { artifactFilter = option[1]; artifacts(); });
            LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-2, ui.dp(42)); p.rightMargin = ui.dp(6); filters.addView(chip, p);
        }
        debounce(search, query -> { artifactQuery = query; results.removeAllViews(); loadArtifacts(results, 1); });
        loadArtifacts(results, 1);
    }

    private void debounce(EditText input, Consumer<String> changed) {
        final Runnable[] task = {null}; int captured = generation;
        input.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) {
                if (task[0] != null) handler.removeCallbacks(task[0]);
                task[0] = () -> { if (generation == captured) changed.accept(s.toString()); }; handler.postDelayed(task[0], 400);
            }
            @Override public void afterTextChanged(Editable value) {}
        });
    }

    private void loadArtifacts(LinearLayout target, int pageNumber) {
        String query = artifactQuery, filter = artifactFilter;
        run(() -> api.get("/api/artifacts?page=" + pageNumber + "&q=" + NativeApi.encode(query) + filter), data -> {
            if (!query.equals(artifactQuery) || !filter.equals(artifactFilter)) return;
            if (pageNumber == 1) { target.removeAllViews(); target.addView(ui.label(String.format(Locale.US, "%02d FILES / LATEST FIRST", data.optInt("total")))); ui.gap(target, 12); }
            JSONArray items = data.optJSONArray("items");
            if (items == null || items.length() == 0) { if (pageNumber == 1) empty(target, "暂无符合条件的产物"); return; }
            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.optJSONObject(i); if (item == null) continue;
                LinearLayout card = ui.card(target); LinearLayout top = ui.row();
                TextView kind = ui.label(item.optString("kind").toUpperCase(Locale.ROOT)); kind.setTextColor(ui.blue); top.addView(kind, new LinearLayout.LayoutParams(0, -2, 1)); top.addView(ui.label((item.optInt("starred") == 1 ? "★  " : "") + "v" + item.optInt("version"))); card.addView(top);
                ui.gap(card, 16); TextView title = ui.title(item.optString("title"), 18); title.setMaxLines(2); card.addView(title); ui.description(card, item.optString("summary", "查看内容与详情。"));
                ui.gap(card, 17); card.addView(ui.label(item.optString("project") + " / " + NativeUi.bytes(item.optLong("bytes"))));
                ui.gap(card, 12); card.addView(ui.text(NativeUi.time(item.optLong("updated_at")), 11, ui.muted));
                card.setContentDescription("产物：" + item.optString("title")); card.setFocusable(true); card.setOnClickListener(v -> artifact(item.optString("id")));
            }
            if (pageNumber * data.optInt("size", 20) < data.optInt("total")) {
                Button more = ui.button("加载更多", false, () -> {}); more.setOnClickListener(v -> { target.removeView(more); loadArtifacts(target, pageNumber + 1); }); target.addView(more, ui.fill());
            }
        });
    }

    private void artifact(String id) {
        detail = "artifact"; begin("正在读取…", "", "WORKSPACE / ARTIFACT"); detail = "artifact";
        run(() -> api.get("/api/artifacts/" + id), item -> {
            body.removeAllViews(); body.addView(ui.button("返回产物库", false, () -> show(0))); ui.gap(body, 20);
            body.addView(ui.label(item.optString("kind").toUpperCase(Locale.ROOT) + " / v" + item.optInt("version"))); ui.gap(body, 12);
            body.addView(ui.title(item.optString("title"), 27)); ui.description(body, item.optString("project") + " · " + NativeUi.time(item.optLong("updated_at")));
            ui.actions(body,
                ui.button(item.optInt("starred") == 1 ? "已星标" : "星标", false, () -> action("/api/artifacts/" + id + "/star", "POST", NativeApi.object("value", item.optInt("starred") != 1), () -> artifact(id))),
                ui.button(item.optInt("read_later") == 1 ? "已加入稍后读" : "稍后读", false, () -> action("/api/artifacts/" + id + "/read-later", "POST", NativeApi.object("value", item.optInt("read_later") != 1), () -> artifact(id))),
                ui.button("更多", false, () -> artifactMenu(item)));
            ui.gap(body, 18); LinearLayout preview = ui.card(body); String kind = item.optString("kind");
            if (kind.equals("pdf") || kind.equals("zip")) {
                preview.addView(ui.title(kind.toUpperCase(Locale.ROOT) + " 文件", 19)); ui.description(preview, "下载后可用手机上的文件查看器打开。"); ui.actions(preview, ui.button("下载文件", true, () -> download(item)));
            } else run(() -> api.bytes("/api/artifacts/" + id + "/content"), bytes -> {
                if (kind.equals("image")) {
                    BitmapFactory.Options options = new BitmapFactory.Options(); options.inJustDecodeBounds = true; BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options); options.inSampleSize = 1;
                    while (options.outWidth / options.inSampleSize > 2048 || options.outHeight / options.inSampleSize > 2048) options.inSampleSize *= 2;
                    options.inJustDecodeBounds = false; Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
                    if (bitmap == null) { ui.description(preview, "此图片格式无法在手机预览，请下载查看。"); return; }
                    ImageView image = new ImageView(this); image.setAdjustViewBounds(true); image.setImageBitmap(bitmap); image.setContentDescription(item.optString("title")); preview.addView(image, ui.fill());
                } else {
                    String text = new String(bytes, StandardCharsets.UTF_8); if (text.length() > 200000) { text = text.substring(0, 200000); ui.description(preview, "预览已截取前 200,000 字符，可下载完整内容。"); }
                    if (kind.equals("csv")) renderCsv(preview, text, 0);
                    else { TextView content = ui.text("", 15, ui.ink); content.setTextIsSelectable(true); NativeText.render(content, text, kind); preview.addView(content, ui.fill()); }
                }
                scroll.post(() -> scroll.scrollTo(0, (int) (item.optDouble("read_progress") * Math.max(0, body.getHeight() - scroll.getHeight()))));
            });
            int captured = generation;
            readingListener = () -> {
                if (progressTask != null) handler.removeCallbacks(progressTask);
                double progress = Math.min(1d, (double) scroll.getScrollY() / Math.max(1, body.getHeight() - scroll.getHeight()));
                progressTask = () -> { if (generation == captured) worker.execute(() -> { try { api.send("/api/artifacts/" + id + "/progress", "POST", NativeApi.object("value", progress)); } catch (Exception ignored) {} }); };
                handler.postDelayed(progressTask, 1000);
            };
            scroll.getViewTreeObserver().addOnScrollChangedListener(readingListener);
        });
    }

    private void artifactMenu(JSONObject item) {
        String[] labels = {"下载文件", "创建只读分享", "撤销只读分享", "查看历史版本", "延长保留期", "删除产物"}; String id = item.optString("id");
        new AlertDialog.Builder(this).setTitle("产物操作").setItems(labels, (d, which) -> {
            switch (which) {
                case 0: download(item); break;
                case 1: run(() -> api.send("/api/artifacts/" + id + "/share", "POST", NativeApi.object()), link -> shareText(link.optString("url"), "只读分享链接（7 天有效）")); break;
                case 2: confirm("撤销分享", "现有分享链接将立即失效。", () -> action("/api/artifacts/" + id + "/share", "DELETE", NativeApi.object(), () -> toast("分享已撤销"))); break;
                case 3: versions(item); break;
                case 4: prompt("保留天数（1–36500）", "90", false, value -> { try { int days = Integer.parseInt(value); if (days < 1 || days > 36500) throw new NumberFormatException(); action("/api/artifacts/" + id + "/retain", "POST", NativeApi.object("days", days), () -> toast("保留期已更新")); } catch (NumberFormatException e) { toast("请填写 1–36500 之间的整数。"); } }); break;
                case 5: confirm("删除产物", "将删除此产物及历史版本，需要通行密钥验证。", () -> stepUp("delete:" + id, proof -> action("/api/artifacts/" + id, "DELETE", NativeApi.object("step_up_token", proof), () -> show(0)))); break;
            }
        }).show();
    }

    private void versions(JSONObject item) {
        String id = item.optString("id"); run(() -> api.list("/api/artifacts/" + id + "/versions"), rows -> {
            String[] names = new String[rows.length()]; for (int i = 0; i < rows.length(); i++) { JSONObject v = rows.optJSONObject(i); names[i] = "v" + v.optInt("version") + " · " + NativeUi.time(v.optLong("created_at")); }
            new AlertDialog.Builder(this).setTitle("选择历史版本对比").setItems(names, (dialog, which) -> {
                int version = rows.optJSONObject(which).optInt("version"); run(() -> api.get("/api/artifacts/" + id + "/diff?vs=" + version), result -> showText("版本对比", result.optString("diff"), true));
            }).setNegativeButton("关闭", null).show();
        });
    }

    private void renderCsv(LinearLayout parent, String source, int pageNumber) {
        parent.removeAllViews(); ArrayList<ArrayList<String>> rows = NativeText.csv(source);
        HorizontalScrollView horizontal = new HorizontalScrollView(this); TableLayout table = new TableLayout(this); horizontal.addView(table); parent.addView(horizontal, ui.fill());
        for (int index = -1; index < 100; index++) {
            int rowIndex = index < 0 ? 0 : 1 + pageNumber * 100 + index; if (rowIndex >= rows.size()) break;
            TableRow row = new TableRow(this); for (String field : rows.get(rowIndex)) { TextView cell = ui.text(field.length() > 500 ? field.substring(0, 500) + "…" : field, 13, ui.ink); ui.pad(cell, 10, 9); cell.setMaxWidth(ui.dp(240)); if (rowIndex == 0) cell.setTypeface(null, Typeface.BOLD); row.addView(cell); } table.addView(row);
        }
        ui.description(parent, (pageNumber + 1) + " / " + Math.max(1, (rows.size() - 1 + 99) / 100));
        Button before = ui.button("上一页", false, () -> renderCsv(parent, source, pageNumber - 1)); before.setEnabled(pageNumber > 0);
        Button after = ui.button("下一页", false, () -> renderCsv(parent, source, pageNumber + 1)); after.setEnabled(1 + (pageNumber + 1) * 100 < rows.size()); ui.actions(parent, before, after);
    }

    private void download(JSONObject item) {
        toast("正在下载…"); run(() -> {
            byte[] bytes = api.bytes("/api/artifacts/" + item.optString("id") + "/download");
            String kind = item.optString("kind"), extension = kind.equals("markdown") ? "md" : kind.equals("image") ? (bytes.length > 0 && (bytes[0] & 255) == 0x89 ? "png" : bytes.length > 0 && (bytes[0] & 255) == 0xff ? "jpg" : "webp") : kind.matches("pdf|zip|html|csv|json|log|diff") ? kind : "txt";
            File directory = new File(getCacheDir(), "artifacts"); if (!directory.isDirectory() && !directory.mkdirs()) throw new java.io.IOException("Cache unavailable");
            File file = new File(directory, item.optString("id") + "." + extension); Files.write(file.toPath(), bytes); return file;
        }, file -> new AlertDialog.Builder(this).setTitle("文件已下载").setItems(new String[]{"打开", "保存副本", "分享文件"}, (d, option) -> {
            Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".artifacts", file); String mime = item.optString("kind").equals("pdf") ? "application/pdf" : item.optString("kind").equals("image") ? "image/*" : "application/octet-stream";
            try {
                if (option == 0) startActivity(new Intent(Intent.ACTION_VIEW).setDataAndType(uri, mime).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION));
                else if (option == 1) { pendingSave = file; startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT).setType(mime).addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE, file.getName()), 81); }
                else startActivity(Intent.createChooser(new Intent(Intent.ACTION_SEND).setType(mime).putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION), "分享文件"));
            } catch (android.content.ActivityNotFoundException error) { toast("未找到可打开此文件的应用，可选择保存副本。"); }
        }).setNegativeButton("关闭", null).show());
    }

    private void shareText(String text, String title) { startActivity(Intent.createChooser(new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), title)); }
    private void toast(String value) { Toast.makeText(this, value, Toast.LENGTH_LONG).show(); }
    private void showText(String title, String text, boolean code) { ScrollView scroller = new ScrollView(this); TextView view = ui.text(text, 14, ui.ink); ui.pad(view, 20, 16); view.setTextIsSelectable(true); if (code) view.setTypeface(Typeface.MONOSPACE); scroller.addView(view); new AlertDialog.Builder(this).setTitle(title).setView(scroller).setPositiveButton("关闭", null).show(); }

    private void threads(String query) {
        begin("对话.", "把下一步，交给你的智能体。", "WORKSPACE / CONVERSATIONS");
        ui.actions(body, ui.button("新建对话", true, () -> prompt("对话标题", "新的对话", false, this::createThread)), ui.button("刷新", false, () -> threads(query)));
        ui.gap(body, 16); EditText search = ui.input("搜索对话", false); search.setText(query); body.addView(search, ui.fill()); ui.gap(body, 16);
        LinearLayout results = ui.column(); body.addView(results, ui.fill());
        Consumer<String> load = value -> run(() -> api.list("/api/threads?q=" + NativeApi.encode(value)), list -> {
            results.removeAllViews(); if (list.length() == 0) empty(results, "还没有对话");
            for (int i = 0; i < list.length(); i++) {
                JSONObject item = list.optJSONObject(i); if (item == null) continue;
                LinearLayout card = ui.card(results); LinearLayout heading = ui.row();
                TextView title = ui.title((item.optInt("pinned") == 1 ? "★  " : "") + item.optString("title"), 18); heading.addView(title, new LinearLayout.LayoutParams(0, -2, 1));
                Button more = ui.button("⋯", false, () -> threadMenu(item)); more.setContentDescription("对话操作"); heading.addView(more); card.addView(heading);
                ui.description(card, item.optString("backend") + " · " + NativeUi.time(item.optLong("updated_at")));
                card.setOnClickListener(v -> thread(item.optString("id"), item.optString("title")));
            }
        });
        debounce(search, load); load.accept(query);
    }

    private void createThread(String title) { run(() -> api.send("/api/threads", "POST", NativeApi.object("title", title)), t -> { tab = 1; navigate(); thread(t.optString("id"), t.optString("title", title)); }); }
    private void threadMenu(JSONObject item) {
        String id = item.optString("id");
        new AlertDialog.Builder(this).setTitle("对话操作").setItems(new String[]{"重命名", item.optInt("pinned") == 1 ? "取消置顶" : "置顶"}, (d, which) -> {
            if (which == 0) prompt("对话标题", item.optString("title"), false, value -> action("/api/threads/" + id, "PATCH", NativeApi.object("title", value), () -> threads("")));
            else action("/api/threads/" + id, "PATCH", NativeApi.object("pinned", item.optInt("pinned") != 1), () -> threads(""));
        }).show();
    }

    private JSONArray attachments = new JSONArray();
    private final ArrayList<String> attachedArtifacts = new ArrayList<>();
    private TextView attachmentLabel;
    private EditText chatInput;
    private void thread(String id, String title) {
        begin(title, "进展会实时显示，离开页面后任务仍会继续。", "WORKSPACE / CONVERSATION"); detail = "thread"; lastSequence = 0;
        ui.actions(body, ui.button("返回对话", false, () -> show(1)), ui.button("停止任务", false, () -> action("/api/threads/" + id + "/cancel", "POST", NativeApi.object(), () -> toast("已请求停止任务"))));
        ui.gap(body, 15); LinearLayout messages = ui.column(); body.addView(messages, ui.fill());
        TextView status = ui.text("正在同步历史消息…", 11, ui.muted); body.addView(status); ui.gap(body, 16);
        LinearLayout chatPage = ui.column(); page.removeView(scroll); chatPage.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
        LinearLayout composer = ui.column(); ui.pad(composer, 16, 10); composer.setBackground(ui.rounded(ui.surface, 20, true));
        chatInput = ui.input("给智能体发送指令…", true); chatInput.setMinLines(2); chatInput.setMaxLines(5); composer.addView(chatInput, ui.fill());
        attachmentLabel = ui.text("", 11, ui.muted); composer.addView(attachmentLabel); attachments = new JSONArray(); attachedArtifacts.clear();
        Button send = ui.button("发送", true, () -> {}); send.setEnabled(false);
        ui.actions(composer, ui.button("添加附件", false, () -> chooseAttachment()), ui.button("引用产物", false, this::chooseArtifacts), send);
        chatPage.addView(composer, ui.fill()); page.addView(chatPage, new FrameLayout.LayoutParams(-1, -1));
        Renderer renderer = new Renderer(messages, status, send);
        run(() -> api.list("/api/threads/" + id + "/messages"), history -> {
            for (int i = 0; i < history.length(); i++) { JSONObject event = history.optJSONObject(i); if (event != null) renderer.event(event); }
            status.setText("消息已同步");
            if (history.length() > 0 && !renderer.finished) watchThread(id, null, renderer);
            else send.setEnabled(true);
        });
        send.setOnClickListener(v -> {
            String text = chatInput.getText().toString().trim(); if (text.isEmpty() || text.length() > 32000) { chatInput.setError("请输入 1–32000 字符的指令。"); return; }
            JSONObject request = NativeApi.object("text", text, "after_seq", lastSequence, "artifact_ids", new JSONArray(attachedArtifacts), "attachments", attachments);
            chatInput.setText(""); attachments = new JSONArray(); attachedArtifacts.clear(); attachmentLabel.setText("");
            renderer.finished = false; send.setEnabled(false); watchThread(id, request, renderer);
        });
    }

    private final class Renderer {
        final LinearLayout messages; final TextView status; final Button send;
        TextView agent; final StringBuilder text = new StringBuilder(); boolean finished;
        Renderer(LinearLayout messages, TextView status, Button send) { this.messages = messages; this.status = status; this.send = send; }
        void event(JSONObject event) {
            long sequence = event.optLong("seq"); if (sequence <= lastSequence) return; lastSequence = sequence;
            boolean follow = scroll.getScrollY() >= body.getHeight() - scroll.getHeight() - ui.dp(120);
            String type = event.optString("type"), value = event.optString("text");
            if (type.equals("token")) {
                if (agent == null) { LinearLayout card = ui.card(messages); card.addView(ui.label("AGENT")); ui.gap(card, 8); agent = ui.text("", 15, ui.ink); agent.setTextIsSelectable(true); card.addView(agent, ui.fill()); text.setLength(0); }
                text.append(value); agent.setText(text); status.setText("智能体正在输出…");
            } else {
                if (agent != null) { NativeText.render(agent, text.toString(), "markdown"); agent = null; }
                if (type.equals("done")) { finished = true; status.setText("任务已完成"); send.setEnabled(true); }
                else if (type.equals("approval_required")) {
                    LinearLayout card = ui.card(messages); card.addView(ui.title("需要你的审批", 17)); JSONObject approval = event.optJSONObject("approval"); if (approval != null) ui.description(card, approval.optString("title"));
                    ui.actions(card, ui.button("查看审批", true, () -> show(2))); status.setText("等待审批");
                } else if (!value.isEmpty()) {
                    LinearLayout card = ui.card(messages); card.addView(ui.label(type.equals("user") ? "YOU" : type.toUpperCase(Locale.ROOT))); ui.gap(card, 8);
                    TextView content = ui.text(value, 15, type.equals("error") ? ui.error : ui.ink); content.setTextIsSelectable(true); card.addView(content);
                    if (type.equals("error")) { finished = true; status.setText("任务未完成"); send.setEnabled(true); }
                }
            }
            if (follow) scroll.post(() -> scroll.fullScroll(View.FOCUS_DOWN));
        }
    }

    private void watchThread(String id, JSONObject request, Renderer renderer) {
        if (stream != null) stream.close(); NativeApi.Stream current = api.new Stream(); stream = current; int captured = generation;
        worker.execute(() -> {
            Exception failure = null;
            for (int attempt = 0; attempt < 4 && !current.closed; attempt++) {
                try {
                    String path = "/api/threads/" + id + (request != null && attempt == 0 ? "/messages" : "/events?after_seq=" + lastSequence);
                    current.run(path, attempt == 0 ? request : null, event -> runOnUiThread(() -> { if (!isDestroyed() && generation == captured && stream == current) renderer.event(event); }));
                    failure = null; break;
                } catch (Exception error) {
                    failure = error; if (current.closed || error instanceof NativeApi.ApiException) break;
                    runOnUiThread(() -> { if (generation == captured && !isDestroyed()) renderer.status.setText("连接中断，正在重连…"); });
                    try { Thread.sleep(1000L * (attempt + 1)); } catch (InterruptedException interrupted) { break; }
                }
            }
            Exception result = failure;
            runOnUiThread(() -> {
                if (isDestroyed() || generation != captured || stream != current) return;
                renderer.send.setEnabled(true);
                if (result != null && !current.closed) { renderer.status.setText("连接已中断，可返回后重新打开以接续历史消息。"); failed(result); }
            });
        });
    }

    private void chooseArtifacts() {
        run(() -> api.get("/api/artifacts?size=100"), response -> {
            JSONArray items = response.optJSONArray("items"); if (items == null || items.length() == 0) { toast("产物库还没有内容。"); return; }
            String[] labels = new String[items.length()]; boolean[] checked = new boolean[items.length()];
            for (int i = 0; i < items.length(); i++) { labels[i] = items.optJSONObject(i).optString("title"); checked[i] = attachedArtifacts.contains(items.optJSONObject(i).optString("id")); }
            new AlertDialog.Builder(this).setTitle("引用产物（最多 10 份）").setMultiChoiceItems(labels, checked, (d, which, selected) -> checked[which] = selected)
                .setPositiveButton("添加", (d, w) -> {
                    ArrayList<String> chosen = new ArrayList<>(); for (int i = 0; i < checked.length; i++) if (checked[i]) chosen.add(items.optJSONObject(i).optString("id"));
                    if (chosen.size() > 10) { toast("最多引用 10 份产物。"); return; } attachedArtifacts.clear(); attachedArtifacts.addAll(chosen); attachmentLabel.setText("引用产物 " + chosen.size() + " 份 · 附件 " + attachments.length() + " 个");
                }).setNegativeButton("取消", null).show();
        });
    }

    private void chooseAttachment() {
        if (attachments.length() >= 4) { toast("最多添加 4 个附件。"); return; }
        startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE)
            .putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"image/png", "image/jpeg", "application/pdf", "text/plain", "text/csv"}), 82);
    }

    private void approvals(String filter) {
        begin("审批.", "每个重要决定，由你掌握。", "WORKSPACE / APPROVALS");
        ui.actions(body, ui.button("待处理", filter.equals("pending"), () -> approvals("pending")), ui.button("全部记录", filter.equals("all"), () -> approvals("all")), ui.button("刷新", false, () -> approvals(filter)));
        ui.gap(body, 18); LinearLayout list = ui.column(); body.addView(list, ui.fill());
        run(() -> api.list("/api/approvals?status=" + filter), items -> {
            if (items.length() == 0) empty(list, "没有待处理审批");
            ArrayList<JSONObject> normal = new ArrayList<>();
            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.optJSONObject(i); if (item == null) continue;
                boolean danger = item.optString("risk").equals("danger"), pending = item.optString("status").equals("pending");
                if (pending && !danger) normal.add(item);
                LinearLayout card = ui.card(list); TextView risk = ui.label((danger ? "DANGER" : "NORMAL") + " / " + item.optString("status").toUpperCase(Locale.ROOT)); risk.setTextColor(danger ? ui.error : ui.blue); card.addView(risk); ui.gap(card, 10);
                card.addView(ui.title(item.optString("title"), 19)); ui.description(card, item.optString("command_digest")); ui.description(card, "有效至 " + NativeUi.time(item.optLong("expires_at")));
                if (pending) ui.actions(card, ui.button("拒绝", false, () -> decide(item, false, filter)), ui.button(danger ? "验证并通过" : "通过", true, () -> decide(item, true, filter)));
                ui.actions(card, ui.button("查看关联对话", false, () -> { tab = 1; navigate(); thread(item.optString("thread_id"), item.optString("title")); }));
            }
            if (!normal.isEmpty()) body.addView(ui.button("批量通过普通审批", false, () -> {
                String[] titles = new String[normal.size()]; boolean[] chosen = new boolean[normal.size()]; for (int i = 0; i < titles.length; i++) titles[i] = normal.get(i).optString("title");
                new AlertDialog.Builder(this).setTitle("选择普通审批").setMultiChoiceItems(titles, chosen, (d, which, value) -> chosen[which] = value).setPositiveButton("确认通过", (d, w) -> run(() -> {
                    int count = 0; for (int i = 0; i < chosen.length; i++) if (chosen[i]) { api.send("/api/approvals/" + normal.get(i).optString("id") + "/approve", "POST", NativeApi.object("confirmed", true)); count++; } return count;
                }, count -> { toast("已通过 " + count + " 项审批"); approvals(filter); })).setNegativeButton("取消", null).show();
            }), ui.fill());
        });
    }

    private void decide(JSONObject item, boolean approve, String filter) {
        String id = item.optString("id");
        confirm(approve ? "确认通过" : "确认拒绝", item.optString("title") + "\n\n" + item.optString("command_digest"), () -> {
            Consumer<String> submit = proof -> action("/api/approvals/" + id + (approve ? "/approve" : "/reject"), "POST", proof == null ? NativeApi.object("confirmed", true) : NativeApi.object("confirmed", true, "step_up_token", proof), () -> approvals(filter));
            if (approve && item.optString("risk").equals("danger")) stepUp("approve:" + id, submit); else submit.accept(null);
        });
    }

    private void stepUp(String scope, Consumer<String> complete) {
        if (!session.optBoolean("passkey")) {
            new AlertDialog.Builder(this).setTitle("需要通行密钥").setMessage("请先在设置中为当前设备注册通行密钥。").setPositiveButton("前往设置", (d, w) -> show(4)).setNegativeButton("取消", null).show(); return;
        }
        run(() -> api.send("/api/auth/webauthn/login/options", "POST", NativeApi.object("scope", scope)), options -> NativePasskeys.authenticate(this, options, response ->
            run(() -> api.send("/api/auth/webauthn/login/verify", "POST", NativeApi.object("response", response)), proof -> complete.accept(proof.optString("step_up_token"))), this::passkeyError));
    }
    private void passkeyError() { new AlertDialog.Builder(this).setTitle("通行密钥未完成").setMessage("请确认手机已启用屏幕锁，且工作台域名已关联 VelaDeck App。你可以稍后重试。").setPositiveButton("知道了", null).show(); }

    private void operations() {
        begin("运行概览.", "节点、任务与成本，一目了然。", "WORKSPACE / OPERATIONS");
        body.addView(ui.button("刷新状态", false, this::operations), ui.fill()); ui.gap(body, 18);
        run(() -> NativeApi.object("status", api.get("/api/ops/status"), "cost", api.get("/api/cost/summary"), "tasks", api.get("/api/ops/tasks"), "events", api.list("/api/notify/events")), data -> {
            JSONArray nodes = data.optJSONObject("status").optJSONArray("nodes");
            if (nodes != null) for (int i = 0; i < nodes.length(); i++) {
                JSONObject node = nodes.optJSONObject(i); if (node == null) continue;
                LinearLayout card = ui.card(body); card.addView(ui.label(node.optBoolean("available") ? "CONNECTED" : "UNAVAILABLE")); ui.gap(card, 8); card.addView(ui.title(node.optString("node"), 20));
                if (!node.optBoolean("available")) ui.description(card, node.optString("reason", "此节点尚未连接。"));
                else {
                    if (node.has("memory_total")) {
                        ui.description(card, "内存 " + NativeUi.bytes(node.optLong("memory_used")) + " / " + NativeUi.bytes(node.optLong("memory_total"))); meter(card, node.optDouble("memory_used"), node.optDouble("memory_total"));
                        ui.description(card, "磁盘可用 " + NativeUi.bytes(node.optLong("disk_free")) + " / " + NativeUi.bytes(node.optLong("disk_total")));
                        meter(card, node.optDouble("disk_total") - node.optDouble("disk_free"), node.optDouble("disk_total"));
                        ui.description(card, String.format(Locale.US, "运行 %.1f 小时 · CPU 累计忙碌 %.1f%%", node.optDouble("uptime") / 3600, node.optDouble("cpu_busy_since_boot_pct")));
                    }
                    if (node.has("summary")) ui.description(card, node.optString("summary"));
                    JSONObject services = node.optJSONObject("services"); if (services != null) { java.util.Iterator<String> keys = services.keys(); while (keys.hasNext()) { String key = keys.next(); ui.description(card, key + " · " + services.optString(key)); } }
                }
            }
            JSONObject cost = data.optJSONObject("cost"), today = cost.optJSONObject("today");
            LinearLayout budget = ui.card(body); budget.addView(ui.label("USAGE / " + cost.optString("day"))); ui.gap(budget, 10);
            budget.addView(ui.title(today == null ? "暂无用量" : String.format(Locale.US, "¥%.2f", today.optDouble("llm_cost_cny")), 30));
            ui.description(budget, "每日预算 ¥" + cost.optDouble("budget_cny") + " · 仅统计已上报用量"); meter(budget, today == null ? 0 : today.optDouble("llm_cost_cny"), cost.optDouble("budget_cny"));
            ui.description(budget, today == null ? "尚无已上报的 tokens。" : "输入 " + today.optLong("llm_in_tokens") + " / 输出 " + today.optLong("llm_out_tokens") + " tokens");
            JSONObject balance = cost.optJSONObject("balance"); if (balance != null) {
                if (!balance.optBoolean("available")) ui.description(budget, "余额 · " + balance.optString("reason"));
                else { JSONArray amounts = balance.optJSONArray("balance_infos"); if (amounts != null) for (int i = 0; i < amounts.length(); i++) { JSONObject a = amounts.optJSONObject(i); ui.description(budget, "余额 · " + a.optString("total_balance") + " " + a.optString("currency")); } }
            }
            JSONObject email = cost.optJSONObject("email"); if (email != null) ui.description(budget, "邮箱 · " + email.optString("reason"));
            JSONObject disk = cost.optJSONObject("disk"); if (disk != null) ui.description(budget, "产物 " + disk.optLong("artifacts") + " 份 · " + NativeUi.bytes(disk.optLong("bytes")));
            JSONArray history = cost.optJSONArray("history"); if (history != null && history.length() > 0) { ui.gap(budget, 16); budget.addView(ui.title("近 14 个记录日期", 17)); for (int i = 0; i < history.length(); i++) { JSONObject day = history.optJSONObject(i); ui.description(budget, day.optString("day") + String.format(Locale.US, "   ¥%.2f", day.optDouble("llm_cost_cny"))); meter(budget, day.optDouble("llm_cost_cny"), Math.max(cost.optDouble("budget_cny"), day.optDouble("llm_cost_cny"))); } }
            JSONArray projects = cost.optJSONArray("projects"); if (projects != null) for (int i = 0; i < projects.length(); i++) { JSONObject p = projects.optJSONObject(i); ui.description(budget, p.optString("project") + String.format(Locale.US, "   ¥%.2f", p.optDouble("cost_cny"))); }
            JSONObject tasks = data.optJSONObject("tasks"); LinearLayout taskCard = ui.card(body); taskCard.addView(ui.title("定时任务", 19));
            if (!tasks.optBoolean("available")) ui.description(taskCard, tasks.optString("reason", "任务来源尚未连接。"));
            else { JSONArray items = tasks.optJSONArray("items"); if (items != null) for (int i = 0; i < items.length(); i++) { JSONObject task = items.optJSONObject(i); String name = task.optString("name"); ui.description(taskCard, name + " · " + task.optString("ActiveState") + " · " + task.optString("Result")); ui.actions(taskCard, ui.button("重跑 " + name, false, () -> confirm("执行任务", "此任务可能消耗资源，执行需要通行密钥验证。", () -> stepUp("run:" + name, proof -> action("/api/ops/tasks/" + NativeApi.encode(name) + "/run", "POST", NativeApi.object("confirmed", true, "step_up_token", proof), this::operations))))); } }
            LinearLayout events = ui.card(body); events.addView(ui.title("最近进展", 19)); JSONArray notifications = data.optJSONArray("events");
            if (notifications != null) for (int i = 0; i < notifications.length(); i++) { JSONObject event = notifications.optJSONObject(i); ui.gap(events, 13); events.addView(ui.text(event.optString("title"), 14, ui.ink)); ui.description(events, event.optString("priority") + " · " + NativeUi.time(event.optLong("created_at")) + " · " + (event.optString("delivered_via").equals("none") ? "未推送" : event.optString("delivered_via"))); }
            if (notifications == null || notifications.length() == 0) ui.description(events, "暂无通知事件。");
        });
    }

    private void meter(LinearLayout parent, double value, double maximum) {
        ProgressBar bar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal); bar.setMax(1000); bar.setProgress((int) Math.min(1000, 1000 * value / Math.max(1, maximum)));
        bar.setProgressTintList(android.content.res.ColorStateList.valueOf(ui.blue)); bar.setProgressBackgroundTintList(android.content.res.ColorStateList.valueOf(ui.line));
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, ui.dp(9)); p.topMargin = ui.dp(10); parent.addView(bar, p);
    }

    private void inbox(String status) {
        begin("Inbox.", "收集链接与灵感，准备好时再交给智能体。", "WORKSPACE / INBOX"); detail = "inbox";
        EditText draft = ui.input("记下一个想法，或粘贴链接…", true); draft.setMinLines(3); draft.setMaxLines(6); draft.setFilters(new android.text.InputFilter[]{new android.text.InputFilter.LengthFilter(32000)});
        if (sharedText != null) { draft.setText(sharedText); sharedText = null; } body.addView(draft, ui.fill());
        String idempotency = java.util.UUID.randomUUID().toString();
        ui.actions(body, ui.button("加入 Inbox", true, () -> {
            String text = draft.getText().toString().trim(); if (text.isEmpty()) { draft.setError("请填写内容。"); return; }
            action("/api/inbox", "POST", NativeApi.object("kind", "text", "content", text, "idempotency_key", idempotency), () -> { toast("已加入 Inbox"); inbox(status); });
        }), ui.button(status.equals("new") ? "查看全部" : "仅待处理", false, () -> inbox(status.equals("new") ? "all" : "new")));
        ui.gap(body, 18); LinearLayout items = ui.column(); body.addView(items, ui.fill());
        run(() -> api.list("/api/inbox?status=" + status), rows -> {
            if (rows.length() == 0) empty(items, "Inbox 已清空");
            for (int i = 0; i < rows.length(); i++) {
                JSONObject item = rows.optJSONObject(i); if (item == null) continue;
                LinearLayout card = ui.card(items); String content = item.optString("content", "");
                TextView value = ui.text(content.length() > 1000 ? content.substring(0, 1000) + "…" : content, 15, ui.ink); value.setTextIsSelectable(true); card.addView(value);
                if (item.has("url") && !item.isNull("url")) ui.description(card, item.optString("url")); ui.description(card, item.optString("status") + " · " + NativeUi.time(item.optLong("created_at")));
                if (content.length() > 1000) ui.actions(card, ui.button("查看全文", false, () -> showText("Inbox", content, false)));
                if (item.optString("status").equals("new")) ui.actions(card,
                    ui.button("归档", false, () -> action("/api/inbox/" + item.optString("id") + "/archive", "POST", NativeApi.object(), () -> inbox(status))),
                    ui.button("转成任务", true, () -> run(() -> api.send("/api/inbox/" + item.optString("id") + "/to-thread", "POST", NativeApi.object()), t -> { tab = 1; navigate(); thread(t.optString("thread_id"), "Inbox 任务"); })));
                else if (!item.isNull("thread_id")) ui.actions(card, ui.button("查看任务", false, () -> { tab = 1; navigate(); thread(item.optString("thread_id"), "Inbox 任务"); }));
            }
        });
    }

    private void settings() {
        begin("设置.", "让工作台，按你的方式运转。", "WORKSPACE / PREFERENCES");
        run(() -> NativeApi.object("preferences", api.get("/api/settings"), "devices", api.list("/api/devices")), data -> {
            JSONObject preferences = data.optJSONObject("preferences"); LinearLayout account = ui.card(body);
            account.addView(ui.label("CONNECTED WORKSPACE")); ui.gap(account, 10); account.addView(ui.title(session.optString("name"), 20)); ui.description(account, api.server);
            ui.description(account, "Android 原生客户端 · v" + BuildConfig.VERSION_NAME);
            ui.actions(account, ui.button("应用更新", true, () -> startActivity(new Intent(this, MainActivity.class).setAction("io.github.zuquanzhi.veladeck.SHOW_UPDATES"))),
                ui.button("更改连接", false, () -> startActivity(new Intent(this, MainActivity.class).setAction("io.github.zuquanzhi.veladeck.SHOW_CONNECTION"))));
            LinearLayout security = ui.card(body); security.addView(ui.title("设备与通行密钥", 19));
            ui.description(security, session.optBoolean("passkey") ? "当前设备已注册通行密钥。" : "注册后，可验证危险审批、删除与运维操作。");
            ui.actions(security, ui.button(session.optBoolean("passkey") ? "重新注册通行密钥" : "注册通行密钥", false, () ->
                run(() -> api.send("/api/auth/webauthn/register/options", "POST", NativeApi.object()), options -> NativePasskeys.register(this, options, response ->
                    run(() -> api.send("/api/auth/webauthn/register/verify", "POST", NativeApi.object("response", response)), ok -> run(() -> api.get("/api/session"), updated -> { session = updated; toast("通行密钥已注册"); settings(); })), this::passkeyError))));
            ui.description(security, "会话由 Android Keystore 加密保存。通行密钥需要工作台域名已关联此 App。");
            JSONArray devices = data.optJSONArray("devices"); if (devices != null) for (int i = 0; i < devices.length(); i++) {
                JSONObject device = devices.optJSONObject(i); if (device == null) continue;
                String id = device.optString("id"); ui.gap(security, 16);
                security.addView(ui.text(device.optString("name") + (id.equals(session.optString("id")) ? " · 本机" : ""), 14, ui.ink));
                ui.description(security, device.isNull("revoked_at") ? "最近使用 " + NativeUi.time(device.optLong("last_seen_at", device.optLong("created_at"))) : "已撤销");
                if (device.isNull("revoked_at")) ui.actions(security,
                    ui.button("重命名", false, () -> prompt("设备名称", device.optString("name"), false, value -> action("/api/devices/" + id, "PATCH", NativeApi.object("name", value), this::settings))),
                    ui.button("撤销", false, () -> confirm("撤销设备", "此设备需要重新配对才能访问工作台。", () -> action("/api/devices/" + id, "DELETE", NativeApi.object(), () -> { if (id.equals(session.optString("id"))) disconnect(); else settings(); }))));
            }
            LinearLayout appearance = ui.card(body); appearance.addView(ui.title("外观与保留", 19));
            ui.actions(appearance, ui.button("主题 · " + preferences.optString("theme"), false, () -> {
                String[] labels = {"跟随系统", "浅色", "深色"}, modes = {"system", "light", "dark"};
                new AlertDialog.Builder(this).setTitle("主题").setItems(labels, (d, which) -> updatePreference(preferences, "theme", modes[which], () -> { getSharedPreferences("native_preferences", MODE_PRIVATE).edit().putString("theme", modes[which]).apply(); recreate(); })).show();
            }), ui.button("保留 " + preferences.optInt("retain_days") + " 天", false, () -> prompt("默认保留天数", String.valueOf(preferences.optInt("retain_days")), false, value -> {
                try { int days = Integer.parseInt(value); if (days < 1 || days > 36500) throw new NumberFormatException(); updatePreference(preferences, "retain_days", days, this::settings); } catch (NumberFormatException error) { toast("请填写 1–36500 之间的整数。"); }
            })));
            LinearLayout notifications = ui.card(body); notifications.addView(ui.title("通知与专注", 19));
            Switch receive = new Switch(this); receive.setText("接收任务通知"); receive.setTextColor(ui.ink); receive.setChecked(preferences.optBoolean("notifications", true));
            receive.setOnCheckedChangeListener((v, checked) -> updatePreference(preferences, "notifications", checked, () -> {})); notifications.addView(receive);
            Switch nativeNotify = new Switch(this); nativeNotify.setText("本机后台提醒"); nativeNotify.setTextColor(ui.ink); nativeNotify.setChecked(getSharedPreferences("native_preferences", MODE_PRIVATE).getBoolean("notifications", false));
            nativeNotify.setOnCheckedChangeListener((button, checked) -> toggleNotifications(checked)); notifications.addView(nativeNotify);
            ui.description(notifications, "后台定时检查进展，实际执行时机由 Android 安排；无需保持电脑上的 App 在线。");
            Switch privacy = new Switch(this); privacy.setText("锁屏隐藏内容"); privacy.setTextColor(ui.ink); privacy.setChecked(preferences.optBoolean("lockscreen_hide", true));
            privacy.setOnCheckedChangeListener((v, checked) -> updatePreference(preferences, "lockscreen_hide", checked, () -> {})); notifications.addView(privacy);
            ui.actions(notifications, ui.button("免打扰开始 " + preferences.optString("dnd_start"), false, () -> chooseTime(preferences, "dnd_start")), ui.button("结束 " + preferences.optString("dnd_end"), false, () -> chooseTime(preferences, "dnd_end")));
            ui.gap(body, 12); body.addView(ui.button("退出此设备", false, () -> confirm("退出工作台", "将撤销当前设备会话，重新使用时需要配对。", () -> action("/api/logout", "POST", NativeApi.object(), this::disconnect))), ui.fill());
        });
    }

    private void updatePreference(JSONObject current, String key, Object value, Runnable done) {
        run(() -> { JSONObject updated = new JSONObject(current.toString()); updated.put(key, value); return api.send("/api/settings", "PUT", updated); }, saved -> { try { current.put(key, saved.opt(key)); } catch (Exception ignored) {} done.run(); });
    }
    private void chooseTime(JSONObject preferences, String key) {
        String[] time = preferences.optString(key, "00:00").split(":");
        new android.app.TimePickerDialog(this, (view, h, m) -> updatePreference(preferences, key, String.format(Locale.US, "%02d:%02d", h, m), this::settings), Integer.parseInt(time[0]), Integer.parseInt(time[1]), true).show();
    }
    private void toggleNotifications(boolean enabled) {
        if (enabled && android.os.Build.VERSION.SDK_INT >= 33 && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) { requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 83); return; }
        getSharedPreferences("native_preferences", MODE_PRIVATE).edit().putBoolean("notifications", enabled).putLong("notify_after", System.currentTimeMillis()).apply();
        NativeNotifications.schedule(this, enabled); toast(enabled ? "已开启后台定时提醒" : "已关闭本机后台提醒");
    }
    private void disconnect() { api.vault.clearCookie(); NativeNotifications.schedule(this, false); startActivity(new Intent(this, MainActivity.class).setAction("io.github.zuquanzhi.veladeck.SHOW_CONNECTION").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK)); finish(); }

    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(request, permissions, results);
        if (request == 83) { if (results.length > 0 && results[0] == android.content.pm.PackageManager.PERMISSION_GRANTED) toggleNotifications(true); else toast("通知权限未开启，可在系统设置中稍后启用。"); settings(); }
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data); if (result != RESULT_OK || data == null || data.getData() == null) return; Uri uri = data.getData();
        if (request == 81 && pendingSave != null) { File file = pendingSave; run(() -> { try (java.io.InputStream input = Files.newInputStream(file.toPath()); java.io.OutputStream output = getContentResolver().openOutputStream(uri)) { if (output == null) throw new java.io.IOException("Output unavailable"); byte[] bytes = new byte[16384]; int n; while ((n = input.read(bytes)) != -1) output.write(bytes, 0, n); } return true; }, done -> toast("文件已保存")); }
        else if (request == 82 && attachmentLabel != null) {
            run(() -> {
                String type = getContentResolver().getType(uri); if (type == null) type = "text/plain";
                if (!java.util.Arrays.asList("image/png", "image/jpeg", "application/pdf", "text/plain", "text/csv").contains(type)) throw new java.io.IOException("Unsupported attachment");
                String name = "attachment"; try (android.database.Cursor cursor = getContentResolver().query(uri, new String[]{android.provider.OpenableColumns.DISPLAY_NAME}, null, null, null)) { if (cursor != null && cursor.moveToFirst()) name = cursor.getString(0); }
                byte[] bytes; try (java.io.InputStream input = getContentResolver().openInputStream(uri)) { if (input == null) throw new java.io.IOException("File unavailable"); bytes = NativeApi.read(input, 20 * 1024 * 1024); }
                return NativeApi.object("name", name.length() > 200 ? name.substring(0, 200) : name, "type", type, "data", android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP));
            }, attachment -> {
                long encodedSize = attachment.optString("data").length(); for (int i = 0; i < attachments.length(); i++) encodedSize += attachments.optJSONObject(i).optString("data").length();
                if (attachments.length() >= 4 || encodedSize > 28_000_000) { toast("附件总大小不能超过 20 MB，数量不能超过 4 个。"); return; }
                attachments.put(attachment); attachmentLabel.setText("引用产物 " + attachedArtifacts.size() + " 份 · 附件 " + attachments.length() + " 个");
            });
        }
    }
    @Override public void onBackPressed() { if (!detail.isEmpty()) show(tab); else moveTaskToBack(true); }
    @Override protected void onSaveInstanceState(Bundle state) { state.putInt("tab", tab); super.onSaveInstanceState(state); }
    @Override protected void onDestroy() { generation++; if (stream != null) stream.close(); handler.removeCallbacksAndMessages(null); worker.shutdownNow(); super.onDestroy(); }
}
