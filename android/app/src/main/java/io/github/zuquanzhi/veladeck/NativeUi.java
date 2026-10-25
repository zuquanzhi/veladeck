package io.github.zuquanzhi.veladeck;

import android.app.Activity;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

final class NativeUi {
    final Context context;
    final int background, surface, ink, muted, line, blue, error;

    NativeUi(Context context) {
        this.context = context;
        background = context.getColor(R.color.app_background); surface = context.getColor(R.color.app_surface);
        ink = context.getColor(R.color.app_text); muted = context.getColor(R.color.app_secondary);
        line = context.getColor(R.color.app_line); blue = context.getColor(R.color.brand_blue); error = context.getColor(R.color.app_error);
    }
    int dp(int value) { return Math.round(value * context.getResources().getDisplayMetrics().density); }
    LinearLayout column() { LinearLayout v = new LinearLayout(context); v.setOrientation(LinearLayout.VERTICAL); return v; }
    LinearLayout row() { LinearLayout v = new LinearLayout(context); v.setGravity(Gravity.CENTER_VERTICAL); return v; }
    LinearLayout.LayoutParams fill() { return new LinearLayout.LayoutParams(-1, -2); }
    void gap(LinearLayout parent, int size) { View gap = new View(context); parent.addView(gap, new LinearLayout.LayoutParams(1, dp(size))); }
    void pad(View view, int x, int y) { view.setPadding(dp(x), dp(y), dp(x), dp(y)); }
    GradientDrawable rounded(int color, int radius, boolean border) {
        GradientDrawable drawable = new GradientDrawable(); drawable.setColor(color); drawable.setCornerRadius(dp(radius));
        if (border) drawable.setStroke(dp(1), line); return drawable;
    }
    TextView text(String value, int size, int color) {
        TextView view = new TextView(context); view.setText(value); view.setTextSize(size); view.setTextColor(color);
        view.setFontFeatureSettings("kern"); view.setLineSpacing(dp(3), 1); return view;
    }
    TextView label(String value) {
        TextView view = text(value, 10, muted); view.setTypeface(Typeface.MONOSPACE); view.setLetterSpacing(.09f); return view;
    }
    TextView title(String value, int size) {
        TextView view = text(value, size, ink); view.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL)); view.setLetterSpacing(-.025f);
        if (value.endsWith(".")) { android.text.SpannableString styled = new android.text.SpannableString(value); styled.setSpan(new android.text.style.ForegroundColorSpan(blue), value.length() - 1, value.length(), android.text.Spanned.SPAN_EXCLUSIVE_EXCLUSIVE); view.setText(styled); }
        return view;
    }
    Button button(String title, boolean primary, Runnable click) {
        Button view = new Button(context); view.setText(title); view.setAllCaps(false); view.setTextSize(13);
        view.setMinHeight(dp(44)); view.setMinimumHeight(dp(44)); view.setMinWidth(0); view.setMinimumWidth(0);
        view.setTextColor(primary ? 0xFFFFFFFF : ink); pad(view, 15, 8); view.setStateListAnimator(null); view.setElevation(0);
        view.setBackground(new android.graphics.drawable.RippleDrawable(android.content.res.ColorStateList.valueOf(0x26087CFA), rounded(primary ? blue : surface, 12, !primary), rounded(0xFFFFFFFF, 12, false)));
        view.setOnClickListener(v -> click.run()); return view;
    }
    EditText input(String hint, boolean multiline) {
        EditText view = new EditText(context); view.setHint(hint); view.setContentDescription(hint); view.setTextColor(ink); view.setHintTextColor(muted);
        view.setTextSize(14); view.setSingleLine(!multiline); view.setMinHeight(dp(48)); pad(view, 14, 12);
        view.setBackground(rounded(surface, 13, true)); return view;
    }
    LinearLayout card(LinearLayout parent) {
        LinearLayout card = column(); pad(card, 18, 18); card.setBackground(rounded(surface, 18, true));
        LinearLayout.LayoutParams params = fill(); params.bottomMargin = dp(12); parent.addView(card, params); return card;
    }
    void description(LinearLayout parent, String value) { TextView text = text(value, 13, muted); text.setTextIsSelectable(true); gap(parent, 6); parent.addView(text); }
    void actions(LinearLayout parent, Button... buttons) {
        LinearLayout row = row(); gap(parent, 12);
        for (int i = 0; i < buttons.length; i++) { LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, -2, 1); if (i > 0) p.leftMargin = dp(7); row.addView(buttons[i], p); }
        parent.addView(row, fill());
    }
    void systemBars(Activity activity, View root) {
        boolean dark = (context.getResources().getConfiguration().uiMode & 0x30) == 0x20;
        activity.getWindow().setStatusBarColor(background); activity.getWindow().setNavigationBarColor(background);
        activity.getWindow().getDecorView().setSystemUiVisibility(dark ? 0 : View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        if (Build.VERSION.SDK_INT >= 35) root.setOnApplyWindowInsetsListener((v, insets) -> {
            v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom()); return insets;
        });
    }
    static String time(long value) { return new SimpleDateFormat("MM-dd HH:mm", Locale.getDefault()).format(new Date(value)); }
    static String bytes(long value) { return value < 1024 ? value + " B" : value < 1048576 ? String.format(Locale.US, "%.1f KB", value / 1024.0) : String.format(Locale.US, "%.1f MB", value / 1048576.0); }

    Drawable icon(String name, int color) { return new Mark(name, color); }
    private static final class Mark extends Drawable {
        final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG); final String name;
        Mark(String name, int color) { this.name = name; paint.setColor(color); paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(1.6f); paint.setStrokeCap(Paint.Cap.ROUND); paint.setStrokeJoin(Paint.Join.ROUND); }
        @Override public void draw(Canvas canvas) {
            canvas.save(); canvas.translate(getBounds().left, getBounds().top); canvas.scale(getBounds().width() / 24f, getBounds().height() / 24f);
            Path path = new Path();
            switch (name) {
                case "layers": path.moveTo(12, 3); path.lineTo(3, 8); path.lineTo(12, 13); path.lineTo(21, 8); path.close(); path.moveTo(3, 12); path.lineTo(12, 17); path.lineTo(21, 12); path.moveTo(3, 16); path.lineTo(12, 21); path.lineTo(21, 16); break;
                case "chat": path.moveTo(4, 18); path.lineTo(4, 8); path.cubicTo(4, 2, 21, 2, 21, 10); path.cubicTo(21, 17, 13, 18, 8, 17); path.lineTo(4, 21); path.close(); break;
                case "shield": path.moveTo(12, 3); path.lineTo(21, 7); path.cubicTo(20, 15, 16, 20, 12, 22); path.cubicTo(7, 20, 3, 14, 3, 7); path.close(); path.moveTo(8, 12); path.lineTo(11, 15); path.lineTo(17, 9); break;
                case "activity": canvas.drawRoundRect(3, 4, 21, 21, 4, 4, paint); path.moveTo(3, 13); path.lineTo(7, 13); path.lineTo(10, 8); path.lineTo(14, 17); path.lineTo(17, 12); path.lineTo(21, 12); break;
                case "settings": for (int i = 0; i < 3; i++) { int y = 6 + i * 6, x = i == 1 ? 15 : 8; canvas.drawLine(3, y, x - 3, y, paint); canvas.drawCircle(x, y, 3, paint); canvas.drawLine(x + 3, y, 21, y, paint); } break;
                default: path.moveTo(6, 3); path.lineTo(15, 3); path.lineTo(20, 8); path.lineTo(20, 21); path.lineTo(5, 21); path.lineTo(5, 3); path.moveTo(15, 3); path.lineTo(15, 9); path.lineTo(20, 9); path.moveTo(8, 14); path.lineTo(17, 14); path.moveTo(8, 17); path.lineTo(15, 17);
            }
            canvas.drawPath(path, paint); canvas.restore();
        }
        @Override public void setAlpha(int alpha) { paint.setAlpha(alpha); invalidateSelf(); }
        @Override public void setColorFilter(ColorFilter filter) { paint.setColorFilter(filter); invalidateSelf(); }
        @Override public int getOpacity() { return PixelFormat.TRANSLUCENT; }
    }
}
