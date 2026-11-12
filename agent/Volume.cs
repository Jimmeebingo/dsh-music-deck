using System;
using System.Diagnostics;
using System.Runtime.InteropServices;

/// <summary>
/// Per-application volume through Core Audio session APIs.
/// Plain COM interop, so Add-Type can compile it without any SDK.
/// </summary>
public static class MDVolume
{
    private const int eRender = 0;
    private const int eMultimedia = 1;

    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    private class MMDeviceEnumerator
    {
    }

    [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IMMDeviceEnumerator
    {
        int EnumAudioEndpoints(int dataFlow, int stateMask, out IntPtr devices);
        int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice device);
        int GetDevice(string id, out IMMDevice device);
        int RegisterEndpointNotificationCallback(IntPtr client);
        int UnregisterEndpointNotificationCallback(IntPtr client);
    }

    [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IMMDevice
    {
        int Activate(ref Guid iid, int clsCtx, IntPtr activationParams,
            [MarshalAs(UnmanagedType.IUnknown)] out object instance);
        int OpenPropertyStore(int access, out IntPtr store);
        int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
        int GetState(out int state);
    }

    [ComImport, Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IAudioSessionManager2
    {
        int GetAudioSessionControl(IntPtr audioSessionGuid, int streamFlags, out IAudioSessionControl session);
        int GetSimpleAudioVolume(IntPtr audioSessionGuid, int streamFlags, out ISimpleAudioVolume volume);
        int GetSessionEnumerator(out IAudioSessionEnumerator enumerator);
        int RegisterSessionNotification(IntPtr client);
        int UnregisterSessionNotification(IntPtr client);
        int RegisterDuckNotification(string sessionId, IntPtr client);
        int UnregisterDuckNotification(IntPtr client);
    }

    [ComImport, Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IAudioSessionEnumerator
    {
        int GetCount(out int count);
        int GetSession(int index, out IAudioSessionControl session);
    }

    [ComImport, Guid("F4B1A599-7266-4319-A8CA-E70ACB11E8CD"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IAudioSessionControl
    {
        int GetState(out int state);
        int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string name);
        int SetDisplayName([MarshalAs(UnmanagedType.LPWStr)] string name, ref Guid context);
        int GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string path);
        int SetIconPath([MarshalAs(UnmanagedType.LPWStr)] string path, ref Guid context);
        int GetGroupingParam(out Guid param);
        int SetGroupingParam(ref Guid param, ref Guid context);
        int RegisterAudioSessionNotification(IntPtr client);
        int UnregisterAudioSessionNotification(IntPtr client);
    }

    [ComImport, Guid("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IAudioSessionControl2
    {
        int GetState(out int state);
        int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string name);
        int SetDisplayName([MarshalAs(UnmanagedType.LPWStr)] string name, ref Guid context);
        int GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string path);
        int SetIconPath([MarshalAs(UnmanagedType.LPWStr)] string path, ref Guid context);
        int GetGroupingParam(out Guid param);
        int SetGroupingParam(ref Guid param, ref Guid context);
        int RegisterAudioSessionNotification(IntPtr client);
        int UnregisterAudioSessionNotification(IntPtr client);
        int GetSessionIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string identifier);
        int GetSessionInstanceIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string identifier);
        int GetProcessId(out uint processId);
        int IsSystemSoundsSession();
        int SetDuckingPreference(bool enable);
    }

    [ComImport, Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface ISimpleAudioVolume
    {
        int SetMasterVolume(float level, ref Guid context);
        int GetMasterVolume(out float level);
        int SetMute(bool mute, ref Guid context);
        int GetMute(out bool mute);
    }

    private static IAudioSessionEnumerator EnumerateSessions()
    {
        var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumerator());
        IMMDevice device;
        enumerator.GetDefaultAudioEndpoint(eRender, eMultimedia, out device);

        var iid = typeof(IAudioSessionManager2).GUID;
        object instance;
        device.Activate(ref iid, 1 /* CLSCTX_ALL */, IntPtr.Zero, out instance);

        IAudioSessionEnumerator sessions;
        ((IAudioSessionManager2)instance).GetSessionEnumerator(out sessions);
        return sessions;
    }

    private sealed class Entry
    {
        public ISimpleAudioVolume Volume;
        public int State;
        public string ProcessName;
    }

    private static System.Collections.Generic.List<Entry> cached;
    private static DateTime cachedAt = DateTime.MinValue;

    /// <summary>
    /// All live sessions with their owning process name. Cached briefly so one
    /// poll pass that asks about three apps enumerates only once.
    /// </summary>
    private static System.Collections.Generic.List<Entry> Snapshot()
    {
        var now = DateTime.UtcNow;
        if (cached != null && (now - cachedAt).TotalMilliseconds < 250) return cached;

        var list = new System.Collections.Generic.List<Entry>();
        try
        {
            IAudioSessionEnumerator sessions = EnumerateSessions();
            int count;
            if (sessions.GetCount(out count) != 0) count = 0;

            for (var index = 0; index < count; index++)
            {
                IAudioSessionControl control;
                if (sessions.GetSession(index, out control) != 0 || control == null) continue;

                var control2 = control as IAudioSessionControl2;
                if (control2 == null) continue;

                uint processId;
                if (control2.GetProcessId(out processId) != 0 || processId == 0) continue;

                string processName;
                try { processName = Process.GetProcessById((int)processId).ProcessName; }
                catch { continue; }

                int state;
                control.GetState(out state);
                if (state == 2 /* expired */) continue;

                var volume = control as ISimpleAudioVolume;
                if (volume == null) continue;

                list.Add(new Entry { Volume = volume, State = state, ProcessName = processName });
            }
        }
        catch
        {
            /* keep whatever we have */
        }

        cached = list;
        cachedAt = now;
        return list;
    }

    private static System.Collections.Generic.List<Entry> Matching(string appId)
    {
        var result = new System.Collections.Generic.List<Entry>();
        if (string.IsNullOrEmpty(appId)) return result;
        foreach (var entry in Snapshot())
        {
            if (Matches(appId, entry.ProcessName)) result.Add(entry);
        }
        return result;
    }

    /// <summary>The session that is actually playing, falling back to any live one.</summary>
    private static ISimpleAudioVolume Primary(System.Collections.Generic.List<Entry> sessions)
    {
        if (sessions.Count == 0) return null;
        foreach (var session in sessions)
        {
            if (session.State == 1 /* active */) return session.Volume;
        }
        return sessions[0].Volume;
    }

    private static bool Matches(string appId, string processName)
    {
        var app = appId.ToLowerInvariant().Replace(".exe", "");
        var name = processName.ToLowerInvariant();
        if (app.Length == 0 || name.Length == 0) return false;
        if (app == name) return true;
        // Packaged apps report an AUMID such as AppleInc.AppleMusic_8wekyb3d8bbwe!App.
        return app.Contains(name) || name.Contains(app);
    }

    /// <summary>0..1 for this app, or -1 when it has no audio session.</summary>
    public static string Dump()
    {
        var lines = new System.Text.StringBuilder();
        try
        {
            var sessions = EnumerateSessions();
            int count;
            sessions.GetCount(out count);
            for (var index = 0; index < count; index++)
            {
                IAudioSessionControl control;
                if (sessions.GetSession(index, out control) != 0 || control == null) continue;
                var control2 = control as IAudioSessionControl2;
                uint pid = 0;
                if (control2 != null) control2.GetProcessId(out pid);
                var name = "?";
                try { name = Process.GetProcessById((int)pid).ProcessName; } catch { }
                var volume = control as ISimpleAudioVolume;
                float level = -1;
                bool muted = false;
                if (volume != null) { volume.GetMasterVolume(out level); volume.GetMute(out muted); }
                int state = -1;
                control.GetState(out state);
                lines.Append(name).Append("#").Append(pid)
                    .Append(" level=").Append(Math.Round(level, 3))
                    .Append(" muted=").Append(muted)
                    .Append(" state=").Append(state)
                    .Append("\n");
            }
        }
        catch (Exception error)
        {
            lines.Append("ERR ").Append(error.Message);
        }
        return lines.ToString();
    }

    public static double GetLevel(string appId)
    {
        try
        {
            var session = Primary(Matching(appId));
            if (session == null) return -1;
            float level;
            return session.GetMasterVolume(out level) == 0 ? Math.Round(level, 3) : -1;
        }
        catch
        {
            return -1;
        }
    }

    public static bool SetLevel(string appId, double level)
    {
        try
        {
            if (double.IsNaN(level)) return false;
            if (level < 0) level = 0;
            if (level > 1) level = 1;
            var sessions = Matching(appId);
            if (sessions.Count == 0) return false;
            var context = Guid.Empty;
            var applied = false;
            // Every session of the app, so a stale duplicate cannot swallow the change.
            foreach (var session in sessions)
            {
                if (session.Volume.SetMasterVolume((float)level, ref context) == 0) applied = true;
            }
            return applied;
        }
        catch
        {
            return false;
        }
    }

    public static int GetMuted(string appId)
    {
        try
        {
            var session = Primary(Matching(appId));
            if (session == null) return -1;
            bool muted;
            return session.GetMute(out muted) == 0 ? (muted ? 1 : 0) : -1;
        }
        catch
        {
            return -1;
        }
    }

    public static bool SetMuted(string appId, bool muted)
    {
        try
        {
            var sessions = Matching(appId);
            if (sessions.Count == 0) return false;
            var context = Guid.Empty;
            var applied = false;
            foreach (var session in sessions)
            {
                if (session.Volume.SetMute(muted, ref context) == 0) applied = true;
            }
            return applied;
        }
        catch
        {
            return false;
        }
    }
}