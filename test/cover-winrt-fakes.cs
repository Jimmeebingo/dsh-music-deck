// Test-only WinRT surface used to compile the actual Cover.cs without Windows
// media access. Every operation completes synchronously against in-memory data.
namespace Windows.Foundation
{
    public enum AsyncStatus { Started, Completed, Canceled, Error }
    public interface IAsyncOperation<T>
    {
        AsyncStatus Status { get; }
        T GetResults();
    }
    public sealed class ReviewCompleted<T> : IAsyncOperation<T>
    {
        private readonly T value;
        public ReviewCompleted(T value) { this.value = value; }
        public AsyncStatus Status { get { return AsyncStatus.Completed; } }
        public T GetResults() { return value; }
    }
}

namespace Windows.Media.Control
{
    public sealed class GlobalSystemMediaTransportControlsSessionManager
    {
        public static Windows.Foundation.IAsyncOperation<GlobalSystemMediaTransportControlsSessionManager> RequestAsync()
        {
            return new Windows.Foundation.ReviewCompleted<GlobalSystemMediaTransportControlsSessionManager>(
                new GlobalSystemMediaTransportControlsSessionManager());
        }
        public GlobalSystemMediaTransportControlsSession[] GetSessions()
        {
            return new[] { new GlobalSystemMediaTransportControlsSession("B") };
        }
        public GlobalSystemMediaTransportControlsSession GetCurrentSession()
        {
            ReviewCoverState.CurrentLookups++;
            return new GlobalSystemMediaTransportControlsSession("B");
        }
    }
    public sealed class GlobalSystemMediaTransportControlsSession
    {
        private readonly string id;
        public GlobalSystemMediaTransportControlsSession(string id) { this.id = id; }
        public string SourceAppUserModelId { get { return id; } }
        public Windows.Foundation.IAsyncOperation<GlobalSystemMediaTransportControlsSessionMediaProperties> TryGetMediaPropertiesAsync()
        {
            if (id == "B") ReviewCoverState.BPropertyReads++;
            return new Windows.Foundation.ReviewCompleted<GlobalSystemMediaTransportControlsSessionMediaProperties>(
                new GlobalSystemMediaTransportControlsSessionMediaProperties());
        }
    }
    public sealed class GlobalSystemMediaTransportControlsSessionMediaProperties
    {
        public Windows.Storage.Streams.ReviewThumbnail Thumbnail
        {
            get { return new Windows.Storage.Streams.ReviewThumbnail(); }
        }
    }
}

namespace Windows.Storage.Streams
{
    public enum InputStreamOptions { None = 0, Partial = 1 }
    public interface IInputStream { byte[] Bytes { get; } }
    public sealed class ReviewInputStream : IInputStream
    {
        public byte[] Bytes { get { return new byte[] { 66, 67, 68, 69 }; } }
    }
    public sealed class ReviewThumbnail
    {
        public Windows.Foundation.IAsyncOperation<ReviewRandomAccessStream> OpenReadAsync()
        {
            ReviewCoverState.BStreamOpens++;
            return new Windows.Foundation.ReviewCompleted<ReviewRandomAccessStream>(new ReviewRandomAccessStream());
        }
    }
    public sealed class ReviewRandomAccessStream : System.IDisposable
    {
        public ulong Size { get { return 4; } }
        public IInputStream GetInputStreamAt(ulong position) { return new ReviewInputStream(); }
        public void Dispose() { }
    }
    public sealed class DataReader : System.IDisposable
    {
        private readonly byte[] bytes;
        private int offset;
        public DataReader(IInputStream input) { bytes = input.Bytes; }
        public InputStreamOptions InputStreamOptions { get; set; }
        public Windows.Foundation.IAsyncOperation<uint> LoadAsync(uint count)
        {
            return new Windows.Foundation.ReviewCompleted<uint>(
                System.Math.Min(count, (uint)(bytes.Length - offset)));
        }
        public void ReadBytes(byte[] target)
        {
            System.Array.Copy(bytes, offset, target, 0, target.Length);
            offset += target.Length;
        }
        public void Dispose() { }
    }
}

public static class ReviewCoverState
{
    public static int CurrentLookups;
    public static int BPropertyReads;
    public static int BStreamOpens;
}
