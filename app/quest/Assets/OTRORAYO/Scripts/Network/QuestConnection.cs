using System;
using System.IO;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json;

namespace Otrorayo.Quest
{
    /// <summary>Callbacks run on background threads. The Unity host must dispatch them onto its main thread.</summary>
    public sealed class QuestConnection : IDisposable
    {
        private const int MaxMessageBytes = 65536;
        private readonly object gate = new object();
        private readonly SemaphoreSlim sendGate = new SemaphoreSlim(1, 1);
        private readonly CancellationTokenSource lifetime = new CancellationTokenSource();
        private ClientWebSocket socket;
        private bool started, disposed, connected;

        public event Action<string> MessageReceived;
        public event Action<bool> ConnectionChanged;
        public bool IsConnected { get { lock (gate) return connected; } }

        public void Start(DeviceConfig config)
        {
            config?.Validate();
            var endpoint = DeviceEndpoints.WebSocket(config);
            var id = config.id;
            lock (gate)
            {
                if (disposed) throw new ObjectDisposedException(nameof(QuestConnection));
                if (started) throw new InvalidOperationException("La conexión ya está iniciada.");
                started = true;
            }
            // Observe the loop internally; it never leaks connection exceptions or token-bearing URLs.
            Task.Run(() => RunAsync(endpoint, id, lifetime.Token));
        }

        public async Task Send(object message)
        {
            ClientWebSocket current;
            lock (gate) { if (disposed || !connected) return; current = socket; }
            var json = JsonConvert.SerializeObject(message);
            try { await SendTextAsync(current, json, lifetime.Token).ConfigureAwait(false); }
            catch (OperationCanceledException) { Abort(current); }
            catch (WebSocketException) { Abort(current); }
            catch (ObjectDisposedException) { }
            catch (IOException) { Abort(current); }
            catch (InvalidOperationException) { Abort(current); }
        }

        private async Task RunAsync(Uri endpoint, string id, CancellationToken cancellation)
        {
            int attempt = 0;
            var random = new Random();
            try
            {
                while (!cancellation.IsCancellationRequested)
                {
                    var current = new ClientWebSocket();
                    current.Options.KeepAliveInterval = TimeSpan.Zero;
                    current.Options.Proxy = null;
                    var connectedFor = System.Diagnostics.Stopwatch.StartNew();
                    try
                    {
                        lock (gate) { if (disposed) break; socket = current; }
                        using (var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellation))
                        {
                            timeout.CancelAfter(TimeSpan.FromSeconds(10));
                            await current.ConnectAsync(endpoint, timeout.Token).ConfigureAwait(false);
                        }
                        await SendTextAsync(current, JsonConvert.SerializeObject(new { v = 1, type = "HELLO", id }), cancellation).ConfigureAwait(false);
                        connectedFor.Restart();
                        SetConnected(true);
                        await ReceiveAsync(current, cancellation).ConfigureAwait(false);
                    }
                    catch (OperationCanceledException) { }
                    catch (WebSocketException) { }
                    catch (IOException) { }
                    catch (ObjectDisposedException) { }
                    catch (InvalidOperationException) { }
                    finally
                    {
                        SetConnected(false);
                        lock (gate) { if (ReferenceEquals(socket, current)) socket = null; }
                        Abort(current);
                        current.Dispose();
                    }
                    if (cancellation.IsCancellationRequested) break;
                    if (connectedFor.Elapsed.TotalSeconds > 10) attempt = 0;
                    var delayMs = Math.Min(15000, 500 * Math.Pow(2, Math.Min(attempt++, 5))) + random.Next(0, 250);
                    try { await Task.Delay(TimeSpan.FromMilliseconds(delayMs), cancellation).ConfigureAwait(false); }
                    catch (OperationCanceledException) { break; }
                }
            }
            finally { SetConnected(false); }
        }

        private async Task SendTextAsync(ClientWebSocket current, string json, CancellationToken cancellation)
        {
            var bytes = Encoding.UTF8.GetBytes(json);
            if (bytes.Length > MaxMessageBytes) throw new ArgumentException("El mensaje supera el límite de 64 KB.");
            await sendGate.WaitAsync(cancellation).ConfigureAwait(false);
            try
            {
                // A send waiting behind another send must not cross into a replacement connection.
                lock (gate) { if (disposed || !ReferenceEquals(socket, current)) return; }
                if (current.State != WebSocketState.Open) return;
                using (var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellation))
                {
                    timeout.CancelAfter(TimeSpan.FromSeconds(5));
                    await current.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, timeout.Token).ConfigureAwait(false);
                }
            }
            finally { sendGate.Release(); }
        }

        private async Task ReceiveAsync(ClientWebSocket current, CancellationToken cancellation)
        {
            var buffer = new byte[8192];
            var utf8 = new UTF8Encoding(false, true);
            using (var message = new MemoryStream())
            using (var receiveTimeout = CancellationTokenSource.CreateLinkedTokenSource(cancellation))
            {
                while (!cancellation.IsCancellationRequested && current.State == WebSocketState.Open)
                {
                    // CLOCK_REPLY arrives every three seconds. Silence detects half-open Wi-Fi/TCP sessions.
                    receiveTimeout.CancelAfter(TimeSpan.FromSeconds(15));
                    var result = await current.ReceiveAsync(new ArraySegment<byte>(buffer), receiveTimeout.Token).ConfigureAwait(false);
                    if (result.MessageType == WebSocketMessageType.Close) return;
                    if (result.MessageType != WebSocketMessageType.Text || message.Length + result.Count > MaxMessageBytes)
                        throw new IOException("Mensaje del controlador inválido.");
                    message.Write(buffer, 0, result.Count);
                    if (!result.EndOfMessage) continue;
                    string text;
                    try { text = utf8.GetString(message.GetBuffer(), 0, (int)message.Length); }
                    catch (DecoderFallbackException) { throw new IOException("Mensaje del controlador inválido."); }
                    message.SetLength(0);
                    var handlers = MessageReceived;
                    if (handlers != null)
                        foreach (Action<string> handler in handlers.GetInvocationList())
                            try { handler(text); } catch { /* A subscriber must not kill the network loop. */ }
                }
            }
        }

        private void SetConnected(bool value)
        {
            lock (gate) { if (value && disposed) return; if (connected == value) return; connected = value; }
            var handlers = ConnectionChanged;
            if (handlers != null)
                foreach (Action<bool> handler in handlers.GetInvocationList())
                    try { handler(value); } catch { }
        }

        private static void Abort(ClientWebSocket current)
        {
            try { current?.Abort(); } catch (ObjectDisposedException) { }
        }

        public void Dispose()
        {
            lock (gate)
            {
                if (disposed) return;
                disposed = true;
                lifetime.Cancel();
                Abort(socket);
            }
        }
    }
}
