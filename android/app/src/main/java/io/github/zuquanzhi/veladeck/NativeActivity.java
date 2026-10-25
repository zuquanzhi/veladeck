package io.github.zuquanzhi.veladeck;

import android.app.Activity;
import android.content.Context;
import android.content.res.Configuration;

/** Apply the chosen native theme before Android creates views and dialogs. */
public abstract class NativeActivity extends Activity {
    @Override protected void attachBaseContext(Context base) {
        String theme = base.getSharedPreferences("native_preferences", MODE_PRIVATE).getString("theme", "system");
        if (!"system".equals(theme)) {
            Configuration configuration = new Configuration(base.getResources().getConfiguration());
            configuration.uiMode = (configuration.uiMode & ~Configuration.UI_MODE_NIGHT_MASK)
                    | ("dark".equals(theme) ? Configuration.UI_MODE_NIGHT_YES : Configuration.UI_MODE_NIGHT_NO);
            base = base.createConfigurationContext(configuration);
        }
        super.attachBaseContext(base);
    }
}
