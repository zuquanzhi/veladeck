package io.github.zuquanzhi.veladeck;

import org.junit.Test;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import static org.junit.Assert.*;

public class UpdatePolicyTest {
    private static final byte[] APK = "test APK bytes".getBytes(StandardCharsets.UTF_8);
    private static final String HASH = UpdatePolicy.hex(UpdatePolicy.sha256().digest(APK));

    private UpdatePolicy.Release release(String version) {
        return new UpdatePolicy.Release("v" + version, "VelaDeck-" + version + "-preview.apk",
                UpdatePolicy.REPOSITORY + "/releases/download/v" + version + "/VelaDeck-" + version + "-preview.apk",
                APK.length, "sha256:" + HASH, "Release notes");
    }

    @Test public void semanticVersionsSortNumericallyAndNeverDowngrade() {
        UpdatePolicy.Release r = UpdatePolicy.newest(Arrays.asList(release("0.1.2"), release("0.10.0"), release("0.9.9")), 1001);
        assertEquals("0.10.0", r.version);
        assertNull(UpdatePolicy.newest(Collections.singletonList(release("0.1.2")), 1002));
        assertNull(UpdatePolicy.newest(Collections.singletonList(release("0.1.1")), 1002));
        assertEquals(1002, UpdatePolicy.versionCode("0.1.2"));
    }

    @Test public void invalidAndAmbiguousVersionsAreRejected() {
        for (String version : Arrays.asList("", "v0.1.2", "0.1", "01.1.2", "0.1.2-rc1", "0.1000.1", "9999.0.0", "0.0.0"))
            assertThrows(IllegalArgumentException.class, () -> UpdatePolicy.versionCode(version));
    }

    @Test public void onlyExactOfficialVersionedAssetsAreAccepted() {
        UpdatePolicy.Release good = release("0.1.3");
        for (String url : Arrays.asList(good.url.replace("https:", "http:"), good.url.replace("zuquanzhi", "attacker"),
                good.url + "?download=1", good.url.replace("github.com/", "github.com.evil.example/"), "https://evil.example/app.apk"))
            assertThrows(IllegalArgumentException.class, () -> new UpdatePolicy.Release("v0.1.3", "VelaDeck-0.1.3-preview.apk", url, APK.length, "sha256:" + HASH, ""));
        assertThrows(IllegalArgumentException.class, () -> new UpdatePolicy.Release("v0.1.3", "other.apk", good.url, APK.length, "sha256:" + HASH, ""));
    }

    @Test public void missingDigestAndExcessiveSizesAreRejected() {
        UpdatePolicy.Release good = release("0.1.3");
        for (String digest : Arrays.asList("", "null", "sha256:abcd", "md5:" + HASH))
            assertThrows(IllegalArgumentException.class, () -> new UpdatePolicy.Release("v0.1.3", "VelaDeck-0.1.3-preview.apk", good.url, APK.length, digest, ""));
        for (long size : new long[] {-1, 0, UpdatePolicy.MAX_APK_BYTES + 1})
            assertThrows(IllegalArgumentException.class, () -> new UpdatePolicy.Release("v0.1.3", "VelaDeck-0.1.3-preview.apk", good.url, size, "sha256:" + HASH, ""));
    }

    @Test public void redirectTrustDoesNotAllowDowngradesUserInfoOrLookalikeHosts() {
        assertTrue(UpdatePolicy.allowedDownloadHost(URI.create("https://release-assets.githubusercontent.com/download?signed=value")));
        assertTrue(UpdatePolicy.allowedDownloadHost(URI.create("https://objects.githubusercontent.com/file")));
        for (String url : Arrays.asList("http://github.com/file", "https://github.com.evil.example/file", "https://evil.example/file",
                "https://user@github.com/file", "https://github.com:444/file", "file:///tmp/file", "https://raw.githubusercontent.com/file"))
            assertFalse(url, UpdatePolicy.allowedDownloadHost(URI.create(url)));
    }

    @Test public void completeDownloadMustMatchBothSizeAndSha256() throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        UpdatePolicy.copyVerified(new ByteArrayInputStream(APK), output, release("0.1.3"), bytes -> {});
        assertArrayEquals(APK, output.toByteArray());
        for (byte[] bad : Arrays.asList(Arrays.copyOf(APK, APK.length - 1), Arrays.copyOf(APK, APK.length + 1), new byte[APK.length]))
            assertThrows(java.io.IOException.class, () -> UpdatePolicy.copyVerified(new ByteArrayInputStream(bad), new ByteArrayOutputStream(), release("0.1.3"), bytes -> {}));
    }

    @Test public void packageIdentityVersionAndInstalledSignerMustAllMatch() throws Exception {
        UpdatePolicy.Release r = release("0.1.3");
        java.util.Set<String> certificate = Collections.singleton("trusted-certificate");
        UpdatePolicy.validatePackage(r, "app.preview", "app.preview", 1003, "0.1.3-preview", 1002, certificate, certificate);
        assertThrows(java.io.IOException.class, () -> UpdatePolicy.validatePackage(r, "attacker.app", "app.preview", 1003, "0.1.3-preview", 1002, certificate, certificate));
        assertThrows(java.io.IOException.class, () -> UpdatePolicy.validatePackage(r, "app.preview", "app.preview", 1002, "0.1.3-preview", 1002, certificate, certificate));
        assertThrows(java.io.IOException.class, () -> UpdatePolicy.validatePackage(r, "app.preview", "app.preview", 1003, "0.1.2-preview", 1002, certificate, certificate));
        assertThrows(java.io.IOException.class, () -> UpdatePolicy.validatePackage(r, "app.preview", "app.preview", 1003, "0.1.3-preview", 1002, Collections.singleton("wrong-certificate"), certificate));
        assertThrows(java.io.IOException.class, () -> UpdatePolicy.validatePackage(r, "app.preview", "app.preview", 1003, "0.1.3-preview", 1002, Collections.emptySet(), Collections.emptySet()));
        assertThrows(java.io.IOException.class, () -> UpdatePolicy.validatePackage(r, "app.preview", "app.preview", 1003, "0.1.3-preview", 1002, new HashSet<>(Arrays.asList("trusted-certificate", "extra-signer")), certificate));
    }
}
