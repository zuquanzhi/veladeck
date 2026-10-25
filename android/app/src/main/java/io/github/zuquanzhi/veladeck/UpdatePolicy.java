package io.github.zuquanzhi.veladeck;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Platform-independent rules shared by release discovery, download and installation. */
final class UpdatePolicy {
    static final String REPOSITORY = "https://github.com/zuquanzhi/veladeck";
    static final long MAX_APK_BYTES = 100L * 1024 * 1024;
    private static final Pattern VERSION = Pattern.compile("(0|[1-9][0-9]{0,3})\\.(0|[1-9][0-9]{0,2})\\.(0|[1-9][0-9]{0,2})");

    static long versionCode(String version) {
        Matcher match = VERSION.matcher(version);
        if (!match.matches()) throw new IllegalArgumentException("Invalid version");
        long result = Long.parseLong(match.group(1)) * 1000000L
                + Long.parseLong(match.group(2)) * 1000L + Long.parseLong(match.group(3));
        if (result <= 0 || result > 2100000000L) throw new IllegalArgumentException("Version out of range");
        return result;
    }

    static final class Release {
        final String version, url, sha256, notes;
        final long size, code;

        Release(String tag, String name, String url, long size, String digest, String notes) {
            if (!tag.startsWith("v")) throw new IllegalArgumentException("Invalid tag");
            version = tag.substring(1);
            code = versionCode(version);
            String expectedName = "VelaDeck-" + version + "-preview.apk";
            if (!expectedName.equals(name) || !(REPOSITORY + "/releases/download/" + tag + "/" + name).equals(url)
                    || size <= 0 || size > MAX_APK_BYTES || !digest.matches("sha256:[a-f0-9]{64}"))
                throw new IllegalArgumentException("Invalid release asset");
            this.url = url;
            this.size = size;
            sha256 = digest.substring(7);
            this.notes = notes.length() > 1600 ? notes.substring(0, 1600) + "…" : notes;
        }
    }

    static Release newest(List<Release> releases, long installedCode) {
        Release newest = null;
        for (Release release : releases)
            if (release.code > installedCode && (newest == null || release.code > newest.code)) newest = release;
        return newest;
    }

    static boolean allowedDownloadHost(URI uri) {
        String host = uri.getHost();
        return "https".equals(uri.getScheme()) && uri.getUserInfo() == null
                && (uri.getPort() == -1 || uri.getPort() == 443)
                && ("github.com".equals(host) || "release-assets.githubusercontent.com".equals(host)
                    || "objects.githubusercontent.com".equals(host));
    }

    interface Progress { void received(long bytes); }

    static void copyVerified(InputStream input, OutputStream output, Release release, Progress progress) throws IOException {
        MessageDigest digest = sha256();
        byte[] buffer = new byte[16384];
        long count = 0, deadline = System.nanoTime() + 180000000000L;
        int read;
        while ((read = input.read(buffer)) != -1) {
            if (Thread.currentThread().isInterrupted() || System.nanoTime() > deadline) throw new IOException("Download interrupted");
            count += read;
            if (count > release.size) throw new IOException("APK_SIZE");
            digest.update(buffer, 0, read);
            output.write(buffer, 0, read);
            progress.received(count);
        }
        if (count != release.size) throw new IOException("APK_SIZE");
        if (!hex(digest.digest()).equals(release.sha256)) throw new IOException("APK_SHA256");
    }

    static void validatePackage(Release release, String packageName, String expectedPackage, long code,
                                String versionName, long installedCode, Set<String> signers, Set<String> installedSigners) throws IOException {
        if (!expectedPackage.equals(packageName)) throw new IOException("APK_PACKAGE");
        if (code != release.code || code <= installedCode || !(release.version + "-preview").equals(versionName))
            throw new IOException("APK_VERSION");
        if (installedSigners.isEmpty() || !installedSigners.equals(signers)) throw new IOException("APK_SIGNER");
    }

    static MessageDigest sha256() {
        try { return MessageDigest.getInstance("SHA-256"); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }

    static String hex(byte[] bytes) {
        char[] digits = "0123456789abcdef".toCharArray(), out = new char[bytes.length * 2];
        for (int i = 0; i < bytes.length; i++) {
            out[i * 2] = digits[(bytes[i] & 255) >>> 4];
            out[i * 2 + 1] = digits[bytes[i] & 15];
        }
        return new String(out);
    }
}
