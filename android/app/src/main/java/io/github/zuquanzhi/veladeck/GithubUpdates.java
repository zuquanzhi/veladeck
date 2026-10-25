package io.github.zuquanzhi.veladeck;

import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.os.Build;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Set;

/** Public GitHub requests only. Workspace cookies and tokens never enter this client. */
final class GithubUpdates {
    private static final String LOG_TAG = "VelaDeckUpdate";
    private static final String API = "https://api.github.com/repos/zuquanzhi/veladeck/releases?per_page=30";
    private final Context context;

    GithubUpdates(Context context) { this.context = context.getApplicationContext(); }

    UpdatePolicy.Release check(boolean manual) throws Exception {
        HttpURLConnection connection = connect(URI.create(API), manual ? 10000 : 2000, manual ? 15000 : 2000);
        connection.setRequestProperty("Accept", "application/vnd.github+json");
        try {
            if (connection.getResponseCode() != 200) throw new IOException("GitHub unavailable");
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            try (InputStream input = connection.getInputStream()) {
                byte[] buffer = new byte[8192];
                int read;
                long deadline = System.nanoTime() + (manual ? 30000000000L : 5000000000L);
                while ((read = input.read(buffer)) != -1) {
                    if (Thread.currentThread().isInterrupted() || System.nanoTime() > deadline) throw new IOException("Update check interrupted");
                    if (output.size() + read > 3 * 1024 * 1024) throw new IOException("Oversized release metadata");
                    output.write(buffer, 0, read);
                }
            }
            JSONArray releases = new JSONArray(new String(output.toByteArray(), StandardCharsets.UTF_8));
            ArrayList<UpdatePolicy.Release> candidates = new ArrayList<>();
            for (int i = 0; i < releases.length(); i++) {
                JSONObject release = releases.getJSONObject(i);
                if (release.optBoolean("draft", true)) continue;
                JSONArray assets = release.optJSONArray("assets");
                if (assets == null) continue;
                for (int j = 0; j < assets.length(); j++) {
                    JSONObject asset = assets.getJSONObject(j);
                    try {
                        candidates.add(new UpdatePolicy.Release(release.optString("tag_name"), asset.optString("name"),
                            asset.optString("browser_download_url"), asset.optLong("size"), asset.optString("digest"), release.optString("body")));
                    } catch (IllegalArgumentException ignored) { /* Other platforms, incomplete and legacy assets are not updates. */ }
                }
            }
            return UpdatePolicy.newest(candidates, BuildConfig.VERSION_CODE);
        } finally { connection.disconnect(); }
    }

    File download(UpdatePolicy.Release release, UpdatePolicy.Progress progress) throws Exception {
        File directory = new File(context.getCacheDir(), "updates");
        if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("Cannot create update cache");
        File partial = new File(directory, "download.part.apk"), ready = new File(directory, "verified-update.apk");
        HttpURLConnection connection = null;
        String stage = "connection";
        try {
            connection = downloadConnection(URI.create(release.url));
            stage = "transfer";
            long length = connection.getContentLengthLong();
            Log.i(LOG_TAG, "Download length=" + length + ", expected=" + release.size);
            if (length >= 0 && length != release.size) throw new IOException("Unexpected download size");
            try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(partial)) {
                UpdatePolicy.copyVerified(input, output, release, progress);
            }
            stage = "identity";
            validateApk(partial, release);
            stage = "cache";
            Files.move(partial.toPath(), ready.toPath(), StandardCopyOption.REPLACE_EXISTING);
            return ready;
        } catch (Exception error) {
            String reason = error.getMessage();
            if (reason == null || !reason.matches("APK_(SIZE|SHA256|PACKAGE|VERSION|SIGNER)|Invalid APK|Unexpected download size|Download HTTP [0-9]{3}|Untrusted download host|Too many download redirects")) reason = "IO_OR_NETWORK";
            Log.w(LOG_TAG, "Update failed: stage=" + stage + ", type=" + error.getClass().getSimpleName() + ", reason=" + reason);
            throw error;
        } finally {
            if (connection != null) connection.disconnect();
            Files.deleteIfExists(partial.toPath());
        }
    }

    void validateApk(File file, UpdatePolicy.Release release) throws Exception {
        // Recheck the bytes before handing the cached file to the system installer.
        try (InputStream input = new FileInputStream(file)) {
            UpdatePolicy.copyVerified(input, new OutputSink(), release, bytes -> {});
        }
        PackageManager manager = context.getPackageManager();
        int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo archive = manager.getPackageArchiveInfo(file.getAbsolutePath(), flags);
        PackageInfo installed = manager.getPackageInfo(context.getPackageName(), flags);
        if (archive == null) throw new IOException("Invalid APK");
        long code = Build.VERSION.SDK_INT >= 28 ? archive.getLongVersionCode() : archive.versionCode;
        Log.i(LOG_TAG, "APK code=" + code + ", expected=" + release.code + ", installed=" + BuildConfig.VERSION_CODE);
        UpdatePolicy.validatePackage(release, archive.packageName, context.getPackageName(), code,
                archive.versionName, BuildConfig.VERSION_CODE, signers(archive), signers(installed));
    }

    @SuppressWarnings("deprecation")
    private static Set<String> signers(PackageInfo info) {
        Signature[] signatures = Build.VERSION.SDK_INT >= 28
                ? (info.signingInfo == null ? null : info.signingInfo.getApkContentsSigners()) : info.signatures;
        Set<String> hashes = new HashSet<>();
        if (signatures != null) for (Signature signature : signatures)
            hashes.add(UpdatePolicy.hex(UpdatePolicy.sha256().digest(signature.toByteArray())));
        return hashes;
    }

    private static HttpURLConnection connect(URI uri, int connectTimeout, int readTimeout) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) uri.toURL().openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(connectTimeout);
        connection.setReadTimeout(readTimeout);
        connection.setUseCaches(false);
        connection.setRequestProperty("User-Agent", "VelaDeck/" + BuildConfig.VERSION_NAME);
        return connection;
    }

    private static HttpURLConnection downloadConnection(URI uri) throws IOException {
        for (int i = 0; i < 6; i++) {
            if (!UpdatePolicy.allowedDownloadHost(uri)) throw new IOException("Untrusted download host");
            HttpURLConnection connection = connect(uri, 15000, 20000);
            connection.setRequestProperty("Accept", "application/octet-stream");
            int status;
            try { status = connection.getResponseCode(); }
            catch (IOException e) { connection.disconnect(); throw e; }
            Log.i(LOG_TAG, "Download response=" + status + ", host=" + uri.getHost());
            if (status == 200) return connection;
            String location = connection.getHeaderField("Location");
            connection.disconnect();
            if ((status != 301 && status != 302 && status != 303 && status != 307 && status != 308) || location == null)
                throw new IOException("Download HTTP " + status);
            uri = uri.resolve(location);
        }
        throw new IOException("Too many download redirects");
    }

    private static final class OutputSink extends java.io.OutputStream {
        @Override public void write(int value) {}
        @Override public void write(byte[] buffer, int offset, int length) {}
    }
}
