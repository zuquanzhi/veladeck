package io.github.zuquanzhi.veladeck;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Device cookies are encrypted with a non-exportable Android Keystore key. */
final class SessionVault {
    private static final String KEY = "veladeck.session.v1";
    private final SharedPreferences preferences;

    SessionVault(Context context) { preferences = context.getSharedPreferences("native_session", Context.MODE_PRIVATE); }

    static String normalize(String value) {
        URI uri;
        try { uri = URI.create(value.trim().replaceAll("/+$", "")); }
        catch (IllegalArgumentException error) { throw new IllegalArgumentException("请输入完整的 HTTPS 工作台地址。"); }
        if (!"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null
                || uri.getQuery() != null || uri.getFragment() != null || uri.getPort() == 0
                || uri.getPath().contains("..") || uri.getRawPath().contains("%"))
            throw new IllegalArgumentException("请输入 HTTPS 地址，不要包含账号、参数或片段。");
        return uri.toString();
    }

    synchronized String server() { return preferences.getString("server", ""); }

    synchronized void connect(String server) {
        String normalized = normalize(server);
        if (!normalized.equals(server())) preferences.edit().clear().putString("server", normalized).commit();
    }

    synchronized boolean paired() { return !server().isEmpty() && preferences.contains("cookie"); }

    synchronized String cookie(String server) throws Exception {
        if (!server().equals(server) || !preferences.contains("cookie")) return "";
        byte[] iv = Base64.decode(preferences.getString("iv", ""), Base64.NO_WRAP);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, iv));
        cipher.updateAAD(server.getBytes(StandardCharsets.UTF_8));
        return new String(cipher.doFinal(Base64.decode(preferences.getString("cookie", ""), Base64.NO_WRAP)), StandardCharsets.UTF_8);
    }

    synchronized void cookie(String server, String cookie) throws Exception {
        if (!server().equals(server) || !cookie.matches("ad_device=[A-Za-z0-9_.-]+")) throw new SecurityException("Invalid session scope");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key());
        cipher.updateAAD(server.getBytes(StandardCharsets.UTF_8));
        byte[] encrypted = cipher.doFinal(cookie.getBytes(StandardCharsets.UTF_8));
        preferences.edit().putString("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
                .putString("cookie", Base64.encodeToString(encrypted, Base64.NO_WRAP)).commit();
    }

    synchronized void clearCookie() { preferences.edit().remove("cookie").remove("iv").commit(); }

    private static SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(KEY)) return (SecretKey) store.getKey(KEY, null);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true).setKeySize(256).build());
        return generator.generateKey();
    }
}
