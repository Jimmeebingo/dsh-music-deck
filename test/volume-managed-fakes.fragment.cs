// This fragment is appended inside the in-memory MDVolume class. The original
// source is changed only at `new MMDeviceEnumerator()` to select this factory.
// All production enumeration, matching, caching and volume methods are intact.
public static class ReviewAudioState
{
    public static readonly uint ProcessId = (uint)System.Diagnostics.Process.GetCurrentProcess().Id;
    public static int ProcessIdResult;
    public static int DefaultEndpointCalls;
    public static int AllEndpointsCalls;
    public static int[] Writes = new int[2];
    public static float[] Levels = new float[] { 1f, 1f };
}

private sealed class ReviewDeviceEnumerator : IMMDeviceEnumerator
{
    __REVIEW_ENUM_METHOD__
    public int GetDefaultAudioEndpoint(int flow, int role, out IMMDevice device)
    {
        ReviewAudioState.DefaultEndpointCalls++;
        device = new ReviewDevice(0);
        return 0;
    }
    public int GetDevice(string id, out IMMDevice device) { device = new ReviewDevice(0); return 0; }
    public int RegisterEndpointNotificationCallback(System.IntPtr client) { return 0; }
    public int UnregisterEndpointNotificationCallback(System.IntPtr client) { return 0; }
}

__REVIEW_COLLECTION_CLASS__

private sealed class ReviewDevice : IMMDevice
{
    private readonly int endpoint;
    public ReviewDevice(int endpoint) { this.endpoint = endpoint; }
    public int Activate(ref System.Guid iid, int clsCtx, System.IntPtr activationParams, out object instance)
    {
        instance = new ReviewSessionManager(endpoint);
        return 0;
    }
    public int OpenPropertyStore(int access, out System.IntPtr store) { store = System.IntPtr.Zero; return 0; }
    public int GetId(out string id) { id = "review-endpoint-" + endpoint; return 0; }
    public int GetState(out int state) { state = 1; return 0; }
}

private sealed class ReviewSessionManager : IAudioSessionManager2
{
    private readonly int endpoint;
    public ReviewSessionManager(int endpoint) { this.endpoint = endpoint; }
    public int GetAudioSessionControl(System.IntPtr guid, int flags, out IAudioSessionControl session)
    { session = new ReviewAudioSession(endpoint); return 0; }
    public int GetSimpleAudioVolume(System.IntPtr guid, int flags, out ISimpleAudioVolume volume)
    { volume = new ReviewAudioSession(endpoint); return 0; }
    public int GetSessionEnumerator(out IAudioSessionEnumerator enumerator)
    { enumerator = new ReviewSessionEnumerator(endpoint); return 0; }
    public int RegisterSessionNotification(System.IntPtr client) { return 0; }
    public int UnregisterSessionNotification(System.IntPtr client) { return 0; }
    public int RegisterDuckNotification(string sessionId, System.IntPtr client) { return 0; }
    public int UnregisterDuckNotification(System.IntPtr client) { return 0; }
}

private sealed class ReviewSessionEnumerator : IAudioSessionEnumerator
{
    private readonly int endpoint;
    public ReviewSessionEnumerator(int endpoint) { this.endpoint = endpoint; }
    public int GetCount(out int count) { count = 1; return 0; }
    public int GetSession(int index, out IAudioSessionControl session)
    { session = index == 0 ? new ReviewAudioSession(endpoint) : null; return index == 0 ? 0 : -1; }
}

private sealed class ReviewAudioSession : IAudioSessionControl, IAudioSessionControl2, ISimpleAudioVolume
{
    private readonly int endpoint;
    public ReviewAudioSession(int endpoint) { this.endpoint = endpoint; }
    public int GetState(out int state) { state = 1; return 0; }
    public int GetDisplayName(out string name) { name = "review-session"; return 0; }
    public int SetDisplayName(string name, ref System.Guid context) { return 0; }
    public int GetIconPath(out string value) { value = ""; return 0; }
    public int SetIconPath(string value, ref System.Guid context) { return 0; }
    public int GetGroupingParam(out System.Guid value) { value = System.Guid.Empty; return 0; }
    public int SetGroupingParam(ref System.Guid value, ref System.Guid context) { return 0; }
    public int RegisterAudioSessionNotification(System.IntPtr client) { return 0; }
    public int UnregisterAudioSessionNotification(System.IntPtr client) { return 0; }
    public int GetSessionIdentifier(out string value) { value = "review-session-" + endpoint; return 0; }
    public int GetSessionInstanceIdentifier(out string value) { value = "review-instance-" + endpoint; return 0; }
    public int GetProcessId(out uint processId) { processId = ReviewAudioState.ProcessId; return ReviewAudioState.ProcessIdResult; }
    public int IsSystemSoundsSession() { return 1; }
    public int SetDuckingPreference(bool enable) { return 0; }
    public int SetMasterVolume(float level, ref System.Guid context)
    {
        ReviewAudioState.Writes[endpoint]++;
        ReviewAudioState.Levels[endpoint] = level;
        return 0;
    }
    public int GetMasterVolume(out float level) { level = ReviewAudioState.Levels[endpoint]; return 0; }
    public int SetMute(bool muted, ref System.Guid context) { return 0; }
    public int GetMute(out bool muted) { muted = false; return 0; }
}
