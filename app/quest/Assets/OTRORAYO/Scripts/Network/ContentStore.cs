using System;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;

namespace Otrorayo.Quest
{
    /// <summary>Hash-addressed files, resumable transfers, and verification before READY is reported.</summary>
    public sealed class ContentStore : IDisposable
    {
        private const long ReserveBytes = 64L * 1024 * 1024;
        private readonly string directory;
        private readonly DeviceConfig config;
        private readonly HttpClient http;
        private readonly bool ownsHttp;
        private readonly Func<string, long?> freeBytes;
        private readonly object stateGate = new object();
        private readonly SemaphoreSlim operationGate = new SemaphoreSlim(1, 1);
        private readonly CancellationTokenSource lifetime = new CancellationTokenSource();
        private string readyHash;
        private string status = "MISSING";
        private double progress;
        private bool disposed;

        public ContentStore(string directory, DeviceConfig config, HttpClient client = null, Func<string, long?> availableBytes = null)
        {
            DeviceEndpoints.Origin(config);
            this.directory = Path.GetFullPath(directory ?? throw new ArgumentNullException(nameof(directory)));
            this.config = new DeviceConfig { id = config.id, serverUrl = config.serverUrl, token = config.token };
            Directory.CreateDirectory(this.directory);
            ownsHttp = client == null;
            // A controller redirect must not move a token-bearing request to an unrelated host.
            http = client ?? new HttpClient(new HttpClientHandler { AllowAutoRedirect = false, UseProxy = false });
            if (ownsHttp) http.Timeout = Timeout.InfiniteTimeSpan;
            freeBytes = availableBytes ?? ReadAvailableBytes;
        }

        public string ReadyHash { get { lock (stateGate) return readyHash; } }
        public double Progress { get { lock (stateGate) return progress; } }
        public string Status { get { lock (stateGate) return status; } }
        public long? AvailableBytes => freeBytes(directory);

        public string LocalPath(ContentInfo content) => Path.Combine(directory, ValidHash(content) + ".mp4");

        public async Task<bool> VerifyAsync(ContentInfo content, CancellationToken cancellation = default)
        {
            var target = LocalPath(content);
            using (var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellation, lifetime.Token))
            {
                await operationGate.WaitAsync(linked.Token).ConfigureAwait(false);
                try
                {
                    ThrowIfDisposed();
                    SetState("LOADING", null, 0);
                    var valid = await MatchesAsync(target, content, linked.Token).ConfigureAwait(false);
                    SetState(valid ? "READY" : "MISSING", valid ? ValidHash(content) : null, valid ? 100 : 0);
                    return valid;
                }
                catch (OperationCanceledException) { SetState("MISSING", null, 0); throw; }
                catch { SetState("ERROR", null, 0); throw; }
                finally { operationGate.Release(); }
            }
        }

        public async Task DistributeAsync(ContentInfo content, CancellationToken cancellation = default)
        {
            var target = LocalPath(content);
            var partial = target + ".part";
            using (var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellation, lifetime.Token))
            {
                await operationGate.WaitAsync(linked.Token).ConfigureAwait(false);
                try
                {
                    ThrowIfDisposed();
                    SetState("LOADING", null, 0);
                    if (await MatchesAsync(target, content, linked.Token).ConfigureAwait(false))
                    {
                        SetState("READY", ValidHash(content), 100);
                        return;
                    }

                    long offset = File.Exists(partial) ? new FileInfo(partial).Length : 0;
                    if (offset == content.size && await MatchesAsync(partial, content, linked.Token).ConfigureAwait(false))
                    {
                        Promote(partial, target);
                        SetState("READY", ValidHash(content), 100);
                        return;
                    }
                    if (offset >= content.size) { File.Delete(partial); offset = 0; }
                    EnsureDiskSpace(content.size - offset);
                    SetProgress(100.0 * offset / content.size);
                    await DownloadAsync(content, partial, offset, linked.Token).ConfigureAwait(false);
                    linked.Token.ThrowIfCancellationRequested();
                    if (!await MatchesAsync(partial, content, linked.Token).ConfigureAwait(false))
                    {
                        File.Delete(partial); // A corrupted prefix must not poison every resumed retry.
                        throw new IOException("El archivo recibido no coincide con su SHA-256.");
                    }
                    Promote(partial, target);
                    SetState("READY", ValidHash(content), 100);
                }
                catch (OperationCanceledException) { SetState("MISSING", null, 0); throw; }
                catch { SetState("ERROR", null, Progress); throw; }
                finally { operationGate.Release(); }
            }
        }

        private async Task DownloadAsync(ContentInfo content, string partial, long offset, CancellationToken cancellation)
        {
            using (var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellation))
            using (var request = new HttpRequestMessage(HttpMethod.Get, DeviceEndpoints.Content(config, ValidHash(content))))
            {
                if (offset > 0) request.Headers.Range = new RangeHeaderValue(offset, null);
                timeout.CancelAfter(TimeSpan.FromSeconds(30));
                try
                {
                    using (var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, timeout.Token).ConfigureAwait(false))
                    {
                        if (response.StatusCode != HttpStatusCode.OK && response.StatusCode != HttpStatusCode.PartialContent)
                            throw new IOException("El controlador rechazó la descarga (HTTP " + (int)response.StatusCode + ").");
                        if (response.StatusCode == HttpStatusCode.PartialContent)
                        {
                            var range = response.Content.Headers.ContentRange;
                            if (range == null || range.Unit != "bytes" || range.From != offset ||
                                range.To != content.size - 1 || range.Length != content.size)
                                throw new IOException("El controlador devolvió un rango de descarga inválido.");
                        }
                        else
                        {
                            offset = 0; // A server ignoring Range requires truncation, never append.
                            EnsureDiskSpace(content.size);
                        }
                        var remaining = content.size - offset;
                        if (response.Content.Headers.ContentLength.HasValue && response.Content.Headers.ContentLength.Value != remaining)
                            throw new IOException("El tamaño informado por el controlador no coincide.");
                        using (var input = await response.Content.ReadAsStreamAsync().ConfigureAwait(false))
                        using (var output = new FileStream(partial, offset > 0 ? FileMode.Append : FileMode.Create, FileAccess.Write, FileShare.None, 128 * 1024, true))
                        {
                            var buffer = new byte[128 * 1024];
                            while (true)
                            {
                                timeout.CancelAfter(TimeSpan.FromSeconds(30));
                                int count = await input.ReadAsync(buffer, 0, buffer.Length, timeout.Token).ConfigureAwait(false);
                                if (count == 0) break;
                                if (count > content.size - offset)
                                    throw new IOException("La descarga excedió el tamaño esperado.");
                                await output.WriteAsync(buffer, 0, count, timeout.Token).ConfigureAwait(false);
                                offset += count;
                                // Reserve the final percent for SHA-256 verification.
                                SetProgress(Math.Min(99, 100.0 * offset / content.size));
                            }
                            await output.FlushAsync(timeout.Token).ConfigureAwait(false);
                        }
                        if (offset != content.size) throw new IOException("La descarga quedó incompleta; se reanudará al reintentar.");
                    }
                }
                catch (HttpRequestException)
                {
                    // HttpClient exception text can include the query token. Do not propagate it.
                    throw new IOException("No se pudo descargar el contenido del controlador.");
                }
                catch (OperationCanceledException) when (!cancellation.IsCancellationRequested)
                {
                    throw new IOException("La descarga no respondió durante 30 segundos.");
                }
            }
        }

        private static async Task<bool> MatchesAsync(string path, ContentInfo content, CancellationToken cancellation)
        {
            if (!File.Exists(path) || new FileInfo(path).Length != content.size) return false;
            using (var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 128 * 1024, true))
            using (var hash = SHA256.Create())
            {
                var buffer = new byte[128 * 1024];
                int count;
                while ((count = await stream.ReadAsync(buffer, 0, buffer.Length, cancellation).ConfigureAwait(false)) != 0)
                {
                    cancellation.ThrowIfCancellationRequested();
                    hash.TransformBlock(buffer, 0, count, buffer, 0);
                }
                hash.TransformFinalBlock(Array.Empty<byte>(), 0, 0);
                var result = new StringBuilder(64);
                foreach (var b in hash.Hash) result.Append(b.ToString("x2"));
                return string.Equals(result.ToString(), content.sha256, StringComparison.OrdinalIgnoreCase);
            }
        }

        private static string ValidHash(ContentInfo content)
        {
            if (content == null || content.size <= 0 || content.size > 9007199254740991L ||
                !Regex.IsMatch(content.sha256 ?? "", "^[a-fA-F0-9]{64}$"))
                throw new ArgumentException("El contenido requiere tamaño y SHA-256 válidos.");
            return content.sha256.ToLowerInvariant();
        }

        private static void Promote(string partial, string target)
        {
            if (File.Exists(target)) File.Delete(target);
            File.Move(partial, target);
        }

        private void EnsureDiskSpace(long remaining)
        {
            long? available = freeBytes(directory);
            if (available.HasValue && available.Value < remaining + ReserveBytes)
                throw new IOException("No hay espacio suficiente para el contenido y 64 MB de reserva.");
        }

        private static long? ReadAvailableBytes(string path)
        {
            try { return new DriveInfo(Path.GetPathRoot(path)).AvailableFreeSpace; }
            catch (IOException) { return null; }
            catch (UnauthorizedAccessException) { return null; }
            catch (NotSupportedException) { return null; }
            catch (ArgumentException) { return null; }
        }

        private void SetState(string value, string hash, double percent)
        {
            lock (stateGate) { status = value; readyHash = hash; progress = percent; }
        }
        private void SetProgress(double value) { lock (stateGate) progress = value; }
        private void ThrowIfDisposed() { if (disposed) throw new ObjectDisposedException(nameof(ContentStore)); }

        public void Dispose()
        {
            if (disposed) return;
            disposed = true;
            lifetime.Cancel();
            if (ownsHttp) http.Dispose();
        }
    }
}
