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
    private const int DeviceStateActive = 1;

    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    private class MMDeviceEnumerator
    {
    }

    [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IMMDeviceEnumerator
    {
        [PreserveSig] int EnumAudioEndpoints(int dataFlow, int stateMask, out IMMDeviceCollection devices);
        [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice device);
        [PreserveSig] int GetDevice(string id, out IMMDevice device);
        [PreserveSig] int RegisterEndpointNotificationCallback(IntPtr client);
        [PreserveSig] int UnregisterEndpointNotificationCallback(IntPtr client);
    }

    [ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IMMDeviceCollection
    {
        [PreserveSig] int GetCount(out uint count);
        [PreserveSig] int Item(uint index, out IMMDevice device);
    }

    [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IMMDevice
    {
        [PreserveSig] int Activate(ref Guid iid, int clsCtx, IntPtr activationParams,
            [MarshalAs(UnmanagedType.IUnknown)] out object instance);
        [PreserveSig] int OpenPropertyStore(int access, out IntPtr store);
        [PreserveSig] int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
        [PreserveSig] int GetState(out int state);
    }

    [ComImport, Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IAudioSessionManager2
    {
        [PreserveSig] int GetAudioSessionControl(IntPtr audioSessionGuid, int streamFlags, out IAudioSessionControl session);
        [PreserveSig] int GetSimpleAudioVolume(IntPtr audioSessionGuid, int streamFlags, out ISimpleAudioVolume volume);
        [PreserveSig] int GetSessionEnumerator(out IAudioSessionEnumerator enumerator);
        [PreserveSig] int RegisterSessionNotification(IntPtr client);
        [PreserveSig] int UnregisterSessionNotification(IntPtr client);
        [PreserveSig] int RegisterDuckNotification(string sessionId, IntPtr client);
        [PreserveSig] int UnregisterDuckNotification(IntPtr client);
    }

    [ComImport, Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IAudioSessionEnumerator
    {
        [PreserveSig] int GetCount(out int count);
        [PreserveSig] int GetSession(int index, out IAudioSessionControl session);
    }

    [ComImport, Guid("F4B1A599-7266-4319-A8CA-E70ACB11E8CD"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IAudioSessionControl
    {
        [PreserveSig] int GetState(out int state);
        [PreserveSig] int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string name);
        [PreserveSig] int SetDisplayName([MarshalAs(UnmanagedType.LPWStr)] string name, ref Guid context);
        [PreserveSig] int GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string path);
        [PreserveSig] int SetIconPath([MarshalAs(UnmanagedType.LPWStr)] string path, ref Guid context);
        [PreserveSig] int GetGroupingParam(out Guid param);
        [PreserveSig] int SetGroupingParam(ref Guid param, ref Guid context);
        [PreserveSig] int RegisterAudioSessionNotification(IntPtr client);
        [PreserveSig] int UnregisterAudioSessionNotification(IntPtr client);
    }

    [ComImport, Guid("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IAudioSessionControl2
    {
        [PreserveSig] int GetState(out int state);
        [PreserveSig] int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string name);
        [PreserveSig] int SetDisplayName([MarshalAs(UnmanagedType.LPWStr)] string name, ref Guid context);
        [PreserveSig] int GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string path);
        [PreserveSig] int SetIconPath([MarshalAs(UnmanagedType.LPWStr)] string path, ref Guid context);
        [PreserveSig] int GetGroupingParam(out Guid param);
        [PreserveSig] int SetGroupingParam(ref Guid param, ref Guid context);
        [PreserveSig] int RegisterAudioSessionNotification(IntPtr client);
        [PreserveSig] int UnregisterAudioSessionNotification(IntPtr client);
        [PreserveSig] int GetSessionIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string identifier);
        [PreserveSig] int GetSessionInstanceIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string identifier);
        [PreserveSig] int GetProcessId(out uint processId);
        [PreserveSig] int IsSystemSoundsSession();
        [PreserveSig] int SetDuckingPreference(bool enable);
    }

    [ComImport, Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface ISimpleAudioVolume
    {
        [PreserveSig] int SetMasterVolume(float level, ref Guid context);
        [PreserveSig] int GetMasterVolume(out float level);
        [PreserveSig] int SetMute(bool mute, ref Guid context);
        [PreserveSig] int GetMute(out bool mute);
    }

    private static System.Collections.Generic.List<IAudioSessionEnumerator> EnumerateSessions()
    {
        var result = new System.Collections.Generic.List<IAudioSessionEnumerator>();
        var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumerator());
        IMMDeviceCollection devices;
        Marshal.ThrowExceptionForHR(enumerator.EnumAudioEndpoints(eRender, DeviceStateActive, out devices));
        if (devices == null) return result;
        uint count;
        Marshal.ThrowExceptionForHR(devices.GetCount(out count));
        for (uint index = 0; index < count; index++)
        {
            try
            {
                IMMDevice device;
                if (devices.Item(index, out device) != 0 || device == null) continue;
                var iid = typeof(IAudioSessionManager2).GUID;
                object instance;
                if (device.Activate(ref iid, 23 /* CLSCTX_ALL */, IntPtr.Zero, out instance) != 0 || instance == null) continue;
                IAudioSessionEnumerator sessions;
                if (((IAudioSessionManager2)instance).GetSessionEnumerator(out sessions) == 0 && sessions != null)
                    result.Add(sessions);
            }
            catch
            {
                // A disconnected endpoint must not hide the remaining devices.
            }
        }
        return result;
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
            foreach (var sessions in EnumerateSessions())
            {
                int count;
                if (sessions.GetCount(out count) != 0) continue;
                for (var index = 0; index < count; index++)
                {
                    IAudioSessionControl control;
                    if (sessions.GetSession(index, out control) != 0 || control == null) continue;
                    var control2 = control as IAudioSessionControl2;
                    if (control2 == null) continue;
                    uint processId;
                    if (control2.GetProcessId(out processId) < 0 || processId == 0) continue;
                    string processName;
                    try { using (var process = Process.GetProcessById((int)processId)) processName = process.ProcessName; }
                    catch { continue; }
                    int state;
                    if (control.GetState(out state) != 0 || state == 2 /* expired */) continue;
                    var volume = control as ISimpleAudioVolume;
                    if (volume == null) continue;
                    list.Add(new Entry { Volume = volume, State = state, ProcessName = processName });
                }
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
        if (string.IsNullOrEmpty(appId) || string.IsNullOrEmpty(processName)) return false;
        var app = appId.ToLowerInvariant();
        var separator = Math.Max(app.LastIndexOf('\\'), app.LastIndexOf('/'));
        if (separator >= 0) app = app.Substring(separator + 1);
        if (app.EndsWith(".exe", StringComparison.Ordinal)) app = app.Substring(0, app.Length - 4);
        var name = processName.ToLowerInvariant();
        if (app.Length == 0 || name.Length == 0) return false;
        if (app == name) return true;
        // Packaged apps report an AUMID such as AppleInc.AppleMusic_8wekyb3d8bbwe!App.
        return System.Text.RegularExpressions.Regex.IsMatch(app,
            @"(?<![\p{L}\p{N}])" + System.Text.RegularExpressions.Regex.Escape(name) + @"(?![\p{L}\p{N}])");
    }

    /// <summary>0..1 for this app, or -1 when it has no audio session.</summary>
    public static string Dump()
    {
        var lines = new System.Text.StringBuilder();
        try
        {
            foreach (var sessions in EnumerateSessions())
            {
                int count;
                if (sessions.GetCount(out count) != 0) continue;
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
        }
        catch (Exception error)
        {
            lines.Append("ERR ").Append(error.Message);
        }
        return lines.ToString();
    }

    /// <summary>Process name owning this app's audio session, or null when none matches.</summary>
    public static string MatchProcess(string appId)
    {
        try
        {
            foreach (var entry in Matching(appId))
            {
                if (!string.IsNullOrEmpty(entry.ProcessName)) return entry.ProcessName;
            }
            return null;
        }
        catch
        {
            return null;
        }
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
