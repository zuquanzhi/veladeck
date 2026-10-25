package io.github.zuquanzhi.veladeck;

import org.junit.Test;
import static org.junit.Assert.*;

public class NativeDataTest {
    @Test public void workspaceScopeRequiresHttpsAndCanonicalizesTheOrigin() {
        assertEquals("https://workspace.example/dock", SessionVault.normalize("  HTTPS://WORKSPACE.EXAMPLE:443/dock/  "));
        assertEquals("https://workspace.example:8443/private/dock", SessionVault.normalize("https://workspace.example:8443/private/dock"));
        for (String value : new String[]{"http://workspace.example", "https://user:secret@workspace.example", "https://workspace.example?token=test", "https://workspace.example/#fragment", "https://workspace.example:70000", "https://workspace.example/../dock", "https://workspace.example/%2e%2e/dock"})
            assertThrows(IllegalArgumentException.class, () -> SessionVault.normalize(value));
    }
    @Test public void nativeCsvSupportsQuotedCommasNewlinesAndEscapedQuotes() {
        java.util.ArrayList<java.util.ArrayList<String>> rows = NativeText.csv("name,value\r\n\"comma,field\",\"line1\nline2\"\nquote,\"a\"\"b\"");
        assertEquals(3, rows.size());
        assertEquals("value", rows.get(0).get(1));
        assertEquals("comma,field", rows.get(1).get(0));
        assertEquals("line1\nline2", rows.get(1).get(1));
        assertEquals("a\"b", rows.get(2).get(1));
    }
    @Test public void nativeCsvPreservesTrailingEmptyColumns() {
        assertEquals(java.util.Arrays.asList("a", "", ""), NativeText.csv("a,,").get(0));
    }
}
