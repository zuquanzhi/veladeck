package io.github.zuquanzhi.veladeck;

import android.graphics.Typeface;
import android.text.Html;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.RelativeSizeSpan;
import android.text.style.StyleSpan;
import android.widget.TextView;
import java.util.ArrayList;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class NativeText {
    static void render(TextView view, String source, String kind) {
        if (kind.equals("html")) { view.setText(Html.fromHtml(source, Html.FROM_HTML_MODE_LEGACY)); return; }
        if (!kind.equals("markdown")) { view.setTypeface(Typeface.MONOSPACE); view.setText(source); return; }
        String text = source.replaceAll("(?m)^#{1,6} +", "").replaceAll("\\*\\*([^*]+)\\*\\*", "$1").replaceAll("(?m)^[-*] +", "• ");
        SpannableString formatted = new SpannableString(text); int offset = 0;
        for (String line : source.split("\n", -1)) {
            String plain = line.replaceFirst("^#{1,6} +", "").replaceAll("\\*\\*([^*]+)\\*\\*", "$1").replaceFirst("^[-*] +", "• ");
            if (line.startsWith("#") && offset + plain.length() <= formatted.length()) { formatted.setSpan(new StyleSpan(Typeface.BOLD), offset, offset + plain.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE); formatted.setSpan(new RelativeSizeSpan(line.startsWith("# ") ? 1.6f : 1.25f), offset, offset + plain.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE); }
            offset += plain.length() + 1;
        }
        view.setText(formatted);
    }
    static ArrayList<ArrayList<String>> csv(String text) {
        ArrayList<ArrayList<String>> rows = new ArrayList<>(); ArrayList<String> row = new ArrayList<>(); StringBuilder cell = new StringBuilder(); boolean quoted = false;
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (c == '"') { if (quoted && i + 1 < text.length() && text.charAt(i + 1) == '"') { cell.append('"'); i++; } else quoted = !quoted; }
            else if (c == ',' && !quoted) { row.add(cell.toString()); cell.setLength(0); }
            else if (c == '\n' && !quoted) { row.add(cell.toString().replaceFirst("\\r$", "")); rows.add(row); row = new ArrayList<>(); cell.setLength(0); }
            else cell.append(c);
            if (rows.size() > 2000) break;
        }
        if (cell.length() > 0 || !row.isEmpty()) { row.add(cell.toString()); rows.add(row); } return rows;
    }
}
