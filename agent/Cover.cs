using System;
using System.Threading;
using Windows.Foundation;
using Windows.Media.Control;
using Windows.Storage.Streams;

/// <summary>
/// Reads the album art a media app publishes on its Windows media session.
/// Compiled at runtime by the media agent: PowerShell cannot project the
/// WinRT stream interfaces, but compiled C# can.
/// </summary>
public static class MDCover
{
    public static string LastError = "";

    public static byte[] Read(string appId)
    {
        byte[] result = null;
        Exception failure = null;

        // WinRT async completion needs a pumping apartment; the agent's own
        // thread is STA, so the read runs on a dedicated MTA thread.
        var worker = new Thread(() =>
        {
            try { result = ReadInner(appId); }
            catch (Exception error) { failure = error; }
        });
        worker.SetApartmentState(ApartmentState.MTA);
        worker.IsBackground = true;
        worker.Start();

        if (!worker.Join(6000))
        {
            LastError = "cover read timed out";
            return null;
        }
        if (failure != null)
        {
            LastError = failure.GetType().Name + ": " + failure.Message;
            return null;
        }
        LastError = "";
        return result;
    }

    private static T Await<T>(IAsyncOperation<T> operation, string label)
    {
        var deadline = DateTime.UtcNow.AddSeconds(5);
        while (operation.Status == AsyncStatus.Started)
        {
            if (DateTime.UtcNow > deadline) throw new TimeoutException(label);
            Thread.Sleep(10);
        }
        return operation.GetResults();
    }

    private static byte[] ReadInner(string appId)
    {
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
        }
        if (session == null) session = manager.GetCurrentSession();
        if (session == null) return null;

        var props = Await(session.TryGetMediaPropertiesAsync(), "properties");
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