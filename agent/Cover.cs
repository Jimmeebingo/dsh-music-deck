using System;
using System.Threading;
using Windows.Foundation;
using Windows.Media.Control;
using Windows.Storage.Streams;

/// <summary>
/// Reads the album art a media app publishes on its Windows media session.
///
/// Reading is asynchronous on purpose: the agent asks for one thumbnail and
/// keeps running; it collects the result on a later tick. A single long-lived
/// worker thread performs the reads, so a slow or hung WinRT call can never
/// stall the media loop and can never pile up extra threads.
/// </summary>
public static class MDCover
{
    public static string LastError = "";

    private static readonly object Gate = new object();
    private static Thread worker;
    private static bool hasRequest;
    private static string requestApp = "";
    private static string requestToken = "";
    private static bool busy;
    private static bool hasResult;
    private static string resultToken = "";
    private static byte[] resultBytes;
    private static string resultError = "";
    private static string resultIdentity = "";

    /// <summary>Identity of the media the last read actually saw.</summary>
    public static string LastIdentity = "";

    public static bool Busy
    {
        get { lock (Gate) { return busy || hasRequest; } }
    }

    /// <summary>Start the reader once. Safe to call repeatedly.</summary>
    public static void Start()
    {
        lock (Gate)
        {
            if (worker != null) return;
            worker = new Thread(Loop);
            worker.IsBackground = true;
            // WinRT async completion needs a pumping apartment; the agent's own
            // thread is STA, so the reads live on this dedicated MTA thread.
            worker.SetApartmentState(ApartmentState.MTA);
            worker.Start();
        }
    }

    /// <summary>Queue one read. False when a read is already in flight.</summary>
    public static bool Request(string appId, string token)
    {
        lock (Gate)
        {
            if (hasRequest || busy) return false;
            requestApp = appId ?? "";
            requestToken = token ?? "";
            hasRequest = true;
            Monitor.PulseAll(Gate);
            return true;
        }
    }

    /// <summary>Collect a finished read without waiting. False when nothing is ready.</summary>
    public static bool TryTake(ref string token, ref byte[] bytes, ref string error, ref string identity)
    {
        lock (Gate)
        {
            if (!hasResult) return false;
            token = resultToken;
            bytes = resultBytes;
            error = resultError;
            identity = resultIdentity;
            hasResult = false;
            resultBytes = null;
            return true;
        }
    }

    private static void Loop()
    {
        while (true)
        {
            string app;
            string token;
            lock (Gate)
            {
                while (!hasRequest) Monitor.Wait(Gate, 100);
                app = requestApp;
                token = requestToken;
                hasRequest = false;
                busy = true;
            }

            byte[] bytes = null;
            string error = "";
            string identity = "";
            try
            {
                bytes = ReadInner(app);
                identity = LastIdentity;
            }
            catch (Exception failure)
            {
                error = failure.GetType().Name + ": " + failure.Message;
            }

            lock (Gate)
            {
                resultToken = token;
                resultBytes = bytes;
                resultError = error;
                resultIdentity = identity;
                hasResult = true;
                busy = false;
            }
        }
    }

    private static T Await<T>(IAsyncOperation<T> operation, string label)
    {
        var deadline = DateTime.UtcNow.AddSeconds(2);
        while (operation.Status == AsyncStatus.Started)
        {
            if (DateTime.UtcNow > deadline) throw new TimeoutException(label);
            Thread.Sleep(10);
        }
        return operation.GetResults();
    }

    private static byte[] ReadInner(string appId)
    {
        LastIdentity = "";
        var manager = Await(GlobalSystemMediaTransportControlsSessionManager.RequestAsync(), "manager");
        GlobalSystemMediaTransportControlsSession session = null;

        if (!string.IsNullOrEmpty(appId))
        {
            foreach (var candidate in manager.GetSessions())
            {
                if (string.Equals(candidate.SourceAppUserModelId, appId, StringComparison.OrdinalIgnoreCase))
                {
                    session = candidate;
                    break;
                }
            }
            if (session == null) return null;
        }
        if (session == null) session = manager.GetCurrentSession();
        if (session == null) return null;

        var props = Await(session.TryGetMediaPropertiesAsync(), "properties");
        // Record what the read actually saw: the caller compares it with the
        // track it asked for, so a track change mid-read cannot be mistaken for
        // artwork of the wrong song.
        LastIdentity = (session.SourceAppUserModelId ?? "")
            + "|" + (props.Title ?? "")
            + "|" + (props.Artist ?? "")
            + "|" + (props.AlbumTitle ?? "");

        if (props.Thumbnail == null) return null;

        var stream = Await(props.Thumbnail.OpenReadAsync(), "stream");
        if (stream == null || stream.Size == 0 || stream.Size > 8000000) return null;

        var reader = new DataReader(stream.GetInputStreamAt(0));
        reader.InputStreamOptions = InputStreamOptions.Partial;

        uint remaining = (uint)stream.Size;
        var buffer = new byte[remaining];
        uint offset = 0;
        while (remaining > 0)
        {
            var loaded = Await(reader.LoadAsync(remaining), "read");
            if (loaded == 0) break;
            var chunk = new byte[loaded];
            reader.ReadBytes(chunk);
            Array.Copy(chunk, 0, buffer, offset, loaded);
            offset += loaded;
            remaining -= loaded;
        }
        reader.Dispose();
        if (offset == buffer.Length) return buffer;
        var trimmed = new byte[offset];
        Array.Copy(buffer, trimmed, offset);
        return trimmed;
    }
}