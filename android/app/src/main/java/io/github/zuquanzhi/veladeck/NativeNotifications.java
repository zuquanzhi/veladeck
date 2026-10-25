package io.github.zuquanzhi.veladeck;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import androidx.core.app.NotificationCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import java.time.LocalTime;
import java.util.HashSet;
import java.util.Set;

/** Opt-in system scheduled notification checks; no always-on service or hosted push account. */
public final class NativeNotifications extends JobService {
    private static final int JOB = 20260;
    private volatile Thread worker;
    static void schedule(Context context, boolean enabled) {
        JobScheduler scheduler = context.getSystemService(JobScheduler.class);
        if (!enabled) { scheduler.cancel(JOB); return; }
        scheduler.schedule(new JobInfo.Builder(JOB, new ComponentName(context, NativeNotifications.class))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPeriodic(15 * 60 * 1000L).setPersisted(true).build());
    }
    @Override public boolean onStartJob(JobParameters parameters) {
        worker = new Thread(() -> {
            try { poll(); } catch (Exception ignored) { /* Offline/revoked clients retry at the next system check. */ }
            finally { jobFinished(parameters, false); }
        }, "veladeck-notifications"); worker.start(); return true;
    }
    @Override public boolean onStopJob(JobParameters parameters) { if (worker != null) worker.interrupt(); return true; }
    private void poll() throws Exception {
        SharedPreferences local = getSharedPreferences("native_preferences", MODE_PRIVATE);
        if (!local.getBoolean("notifications", false) || !new SessionVault(this).paired()) return;
        NativeApi api = new NativeApi(this); JSONObject preferences = api.get("/api/settings"); JSONArray events = api.list("/api/notify/events");
        Set<String> seen = new HashSet<>(local.getStringSet("notification_seen", new HashSet<>())), latest = new HashSet<>();
        long after = local.getLong("notify_after", System.currentTimeMillis()); boolean quiet = quiet(preferences);
        JSONObject projects = preferences.optJSONObject("projects"); NotificationManager manager = getSystemService(NotificationManager.class);
        manager.createNotificationChannel(new NotificationChannel("agent-progress", "智能体进展", NotificationManager.IMPORTANCE_DEFAULT));
        for (int i = events.length() - 1; i >= 0; i--) {
            JSONObject event = events.optJSONObject(i); if (event == null) continue;
            String id = event.optString("id"); latest.add(id);
            if (seen.contains(id) || event.optLong("created_at") <= after || quiet || !preferences.optBoolean("notifications", true)
                    || event.optString("priority").equals("P3") || (projects != null && !projects.optBoolean(event.optString("project"), true))) continue;
            boolean hide = preferences.optBoolean("lockscreen_hide", true);
            Intent intent = new Intent(this, MainActivity.class).putExtra("native_link", event.optString("deep_link"));
            PendingIntent open = PendingIntent.getActivity(this, id.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            NotificationCompat.Builder notification = new NotificationCompat.Builder(this, "agent-progress")
                .setSmallIcon(R.drawable.ic_brand_foreground).setContentTitle(hide ? "VelaDeck 有新进展" : event.optString("title"))
                .setContentText("打开原生工作台查看进展").setAutoCancel(true).setContentIntent(open)
                .setVisibility(hide ? NotificationCompat.VISIBILITY_SECRET : NotificationCompat.VISIBILITY_PRIVATE).setGroup("veladeck-progress");
            if (android.os.Build.VERSION.SDK_INT < 33 || checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == android.content.pm.PackageManager.PERMISSION_GRANTED)
                manager.notify(id.hashCode(), notification.build());
        }
        local.edit().putStringSet("notification_seen", latest).apply();
    }
    private boolean quiet(JSONObject preferences) {
        try {
            LocalTime now = LocalTime.now(), start = LocalTime.parse(preferences.optString("dnd_start")), end = LocalTime.parse(preferences.optString("dnd_end"));
            if (start.equals(end)) return false;
            return start.isBefore(end) ? !now.isBefore(start) && now.isBefore(end) : !now.isBefore(start) || now.isBefore(end);
        } catch (Exception error) { return true; }
    }
}
