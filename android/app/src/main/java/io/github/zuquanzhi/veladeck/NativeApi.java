package io.github.zuquanzhi.veladeck;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;
import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.Closeable;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

/** HTTPS JSON/SSE client. No browser, WebView, global cookie jar or credentials in URLs. */
final class NativeApi {
    final SessionVault vault;
    final String server;

    NativeApi(Context context) {
        vault = new SessionVault(context);
        server = SessionVault.normalize(vault.server());
    }

    static final class ApiException extends IOException {
        final int status;
        ApiException(int status, String message) { super(message); this.status = status; }
    }

    static String encode(String value) { try { return URLEncoder.encode(value, "UTF-8"); } catch (Exception e) { throw new IllegalArgumentException(e); } }

    static JSONObject object(Object... pairs) {
        JSONObject value = new JSONObject();
        try { for (int i = 0; i < pairs.length; i += 2) value.put((String) pairs[i], pairs[i + 1]); }
        catch (Exception e) { throw new IllegalArgumentException(e); }
        return value;
    }

    JSONObject get(String path) throws Exception { return (JSONObject) call(path, "GET", null); }
    JSONArray list(String path) throws Exception { return (JSONArray) call(path, "GET", null); }
    JSONObject send(String path, String method, JSONObject body) throws Exception { return (JSONObject) call(path, method, body); }

    Object call(String path, String method, JSONObject body) throws Exception {
        HttpURLConnection connection = open(path, method, body, false);
        try {
            check(connection);
            captureCookie(connection);
            try (InputStream input = connection.getInputStream()) {
                return new JSONTokener(new String(read(input, 5 * 1024 * 1024), StandardCharsets.UTF_8)).nextValue();
            }
        } finally { connection.disconnect(); }
    }

    byte[] bytes(String path) throws Exception {
        HttpURLConnection connection = open(path, "GET", null, false);
        try { check(connection); try (InputStream input = connection.getInputStream()) { return read(input, 21 * 1024 * 1024); } }
        finally { connection.disconnect(); }
    }

    HttpURLConnection open(String path, String method, JSONObject body, boolean streaming) throws Exception {
        if (!path.startsWith("/api/") || path.contains("#") || path.contains("\\") || path.contains("\r") || path.contains("\n"))
            throw new SecurityException("Invalid API path");
        HttpURLConnection connection = (HttpURLConnection) new URL(server + path).openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(streaming ? 45000 : 20000);
        connection.setUseCaches(false);
        connection.setRequestMethod(method);
        connection.setRequestProperty("Accept", streaming ? "text/event-stream" : "application/json");
        connection.setRequestProperty("User-Agent", "VelaDeckNative/" + BuildConfig.VERSION_NAME);
        URI origin = URI.create(server);
        connection.setRequestProperty("Origin", origin.getScheme() + "://" + origin.getRawAuthority());
        String cookie = vault.cookie(server);
        if (!cookie.isEmpty()) connection.setRequestProperty("Cookie", cookie);
        if (body != null) {
            byte[] data = body.toString().getBytes(StandardCharsets.UTF_8);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            connection.setDoOutput(true);
            connection.setFixedLengthStreamingMode(data.length);
            try (java.io.OutputStream output = connection.getOutputStream()) { output.write(data); }
        }
        return connection;
    }

    private void captureCookie(HttpURLConnection connection) throws Exception {
        for (Map.Entry<String, List<String>> entry : connection.getHeaderFields().entrySet()) {
            if (!"Set-Cookie".equalsIgnoreCase(entry.getKey())) continue;
            for (String value : entry.getValue()) {
                String lower = value.toLowerCase(java.util.Locale.ROOT);
                if (value.startsWith("ad_device=") && lower.contains("secure") && lower.contains("httponly"))
                    vault.cookie(server, value.split(";", 2)[0]);
            }
        }
    }

    private void check(HttpURLConnection connection) throws Exception {
        int status = connection.getResponseCode();
        if (status >= 200 && status < 300) return;
        String message = status == 401 ? "设备登录已失效，请重新配对。" : "服务暂时无法完成请求，请稍后重试。";
        try (InputStream input = connection.getErrorStream()) {
            if (input != null) {
                JSONObject error = new JSONObject(new String(read(input, 8192), StandardCharsets.UTF_8)).optJSONObject("error");
                if (error != null && status < 500) message = error.optString("message", message);
            }
        } catch (Exception ignored) { /* Never show a response body or network URL as an error. */ }
        throw new ApiException(status, message.length() > 200 ? message.substring(0, 200) : message);
    }

    static byte[] read(InputStream input, int maximum) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[16384];
        int read;
        while ((read = input.read(buffer)) != -1) {
            if (Thread.currentThread().isInterrupted()) throw new IOException("Cancelled");
            if (output.size() + read > maximum) throw new IOException("内容超出手机预览大小限制。");
            output.write(buffer, 0, read);
        }
        return output.toByteArray();
    }

    final class Stream implements Closeable {
        volatile boolean closed;
        volatile HttpURLConnection connection;
        @Override public void close() { closed = true; if (connection != null) connection.disconnect(); }
        void run(String path, JSONObject body, Consumer<JSONObject> receive) throws Exception {
            connection = open(path, body == null ? "GET" : "POST", body, true);
            try {
                check(connection);
                try (BufferedReader input = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    StringBuilder data = new StringBuilder();
                    while (!closed && (line = input.readLine()) != null) {
                        if (line.startsWith("data:")) {
                            if (data.length() > 0) data.append('\n');
                            data.append(line.substring(5).trim());
                            if (data.length() > 1024 * 1024) throw new IOException("事件过大。");
                        } else if (line.isEmpty() && data.length() > 0) {
                            receive.accept(new JSONObject(data.toString()));
                            data.setLength(0);
                        }
                    }
                }
            } finally { connection.disconnect(); }
        }
    }
}
