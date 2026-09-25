using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Otrorayo.Quest;

static class Program
{
    static int assertions;

    static async Task Main(string[] args)
    {
        TestClock();
        await TestContent();
        if (args.Length == 2) await TestController(args[0], args[1]);
        Console.WriteLine($"PASS: {assertions} Quest core assertions" + (args.Length == 2 ? " including real Node controller" : ""));
    }

    static void Check(bool condition, string message)
    {
        assertions++;
        if (!condition) throw new Exception("FAIL: " + message);
    }

    static async Task Throws<T>(Func<Task> action, string message) where T : Exception
    {
        try { await action(); } catch (T) { assertions++; return; }
        throw new Exception("FAIL (expected " + typeof(T).Name + "): " + message);
    }

    static void TestClock()
    {
        double now = 1000010;
        var clock = new ClockSync(() => now);
        Check(!clock.IsFresh, "no unmeasured clock is fresh");
        Check(clock.AcceptReply(1000000, 1000105, 1000105, now), "accept NTP sample");
        Check(clock.OffsetMs == 100 && clock.RttMs == 10, "NTP offset and round trip");
        var fixedMapping = clock.FreezeMapping();
        double fixedDeadline = clock.ToLocalTime(1001000);
        now = 1000110;
        long version = clock.SampleVersion;
        Check(!clock.AcceptReply(1000010, 1000260, 1000260, now), "higher-latency sample must not renew freshness");
        Check(clock.OffsetMs == 100, "prefer low-latency sample");
        Check(clock.SampleVersion == version && clock.SelectedSampleAt == 1000010, "cached sample retains version and measured timestamp");
        now = 1000202;
        Check(clock.AcceptReply(1000200, 1000501, 1000501, now), "accept newer lower-latency sample");
        Check(clock.OffsetMs == 300, "lower-latency sample updates estimate");
        Check(fixedDeadline == 1000900 && fixedMapping.ToLocalTime(1001000) == 1000900, "playback deadlines never move with new probes");
        Check(!clock.AcceptReply(double.NaN, 0, 0, now), "reject non-finite timestamps");
        Check(!clock.AcceptReply(now + 1, now, now, now), "reject future probe timestamp");
        Check(!clock.AcceptReply(now - 6000, now, now, now), "reject stale reply");
        now += 15001;
        Check(!clock.IsFresh, "clock expires");
        clock.Reset();
        Check(!clock.IsFresh && clock.OffsetMs == 0, "disconnect can reset clock");
        now = 2000010;
        var aging = new ClockSync(() => now);
        aging.AcceptReply(now - 10, now + 95, now + 95, now);
        now = 2005020;
        Check(!aging.AcceptReply(now - 20, now + 90, now + 90, now), "slower runner-up is cached");
        now = 2015100;
        Check(!aging.AcceptReply(now - 100, now + 50, now + 50, now), "expired best cannot refresh freshness using cached runner-up");
        Check(aging.SelectedSampleAt == 2005020, "runner-up keeps original sample time");
        var monotonic = new ClockSync();
        Check(Math.Abs(monotonic.LocalNowMs - DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()) < 1000, "monotonic clock anchored at Unix time");
        var defaults = JsonConvert.DeserializeObject<ContentInfo>("{\"sha256\":\"a\",\"size\":5}");
        Check(defaults.projection == "360" && defaults.stereo == "mono" && defaults.muted, "legacy metadata defaults");
    }

    static async Task TestContent()
    {
        var bytes = Enumerable.Range(0, 300000).Select(i => (byte)(i % 251)).ToArray();
        var metadata = new ContentInfo { file = "../../escape.mov", size = bytes.Length, sha256 = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant() };
        var directory = Path.Combine(Path.GetTempPath(), "otrorayo-core-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(directory);
        var config = new DeviceConfig { serverUrl = "http://localhost:8787", id = "Q01", token = "test-only-token" };
        var handler = new FakeHandler();
        using var client = new HttpClient(handler);
        using var store = new ContentStore(directory, config, client, _ => 4L * 1024 * 1024 * 1024);
        try
        {
            string path = store.LocalPath(metadata);
            Check(Path.GetDirectoryName(path) == directory && path.EndsWith(metadata.sha256 + ".mp4"), "filenames come only from hash");
            handler.Reply = request =>
            {
                Check(request.RequestUri.AbsolutePath == "/device/content", "content endpoint");
                Check(request.RequestUri.Query.Contains(metadata.sha256), "hash in request");
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent(bytes) };
            };
            await store.DistributeAsync(metadata);
            Check(store.Status == "READY" && store.ReadyHash == metadata.sha256 && store.Progress == 100, "verified download ready");
            Check(File.ReadAllBytes(path).SequenceEqual(bytes), "download matches bytes");
            Check(await store.VerifyAsync(metadata), "cached content reverified");
            var requests = handler.Requests;
            await store.DistributeAsync(metadata);
            Check(requests == handler.Requests, "valid cache avoids network request");

            File.WriteAllBytes(path, bytes.Select((b, i) => i == 0 ? (byte)255 : b).ToArray());
            Check(!await store.VerifyAsync(metadata) && store.ReadyHash == null, "corrupt file fails verification");
            File.Delete(path);
            File.WriteAllBytes(path + ".part", bytes.Take(12345).ToArray());
            handler.Reply = request =>
            {
                Check(request.Headers.Range?.Ranges.Single().From == 12345, "resume requests exact saved offset");
                var response = new HttpResponseMessage(HttpStatusCode.PartialContent) { Content = new ByteArrayContent(bytes.Skip(12345).ToArray()) };
                response.Content.Headers.ContentRange = new ContentRangeHeaderValue(12345, bytes.Length - 1, bytes.Length);
                return response;
            };
            await store.DistributeAsync(metadata);
            Check(File.ReadAllBytes(path).SequenceEqual(bytes) && !File.Exists(path + ".part"), "range append verified and promoted");

            File.Delete(path);
            File.WriteAllBytes(path + ".part", bytes.Take(10).ToArray());
            handler.Reply = _ => new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent(bytes) };
            await store.DistributeAsync(metadata);
            Check(File.ReadAllBytes(path).SequenceEqual(bytes), "ignored Range truncates old partial");

            File.Delete(path);
            File.WriteAllBytes(path + ".part", bytes.Take(10).ToArray());
            handler.Reply = _ =>
            {
                var response = new HttpResponseMessage(HttpStatusCode.PartialContent) { Content = new ByteArrayContent(bytes.Skip(10).ToArray()) };
                response.Content.Headers.ContentRange = new ContentRangeHeaderValue(9, bytes.Length - 2, bytes.Length);
                return response;
            };
            await Throws<IOException>(() => store.DistributeAsync(metadata), "reject wrong Content-Range");
            Check(new FileInfo(path + ".part").Length == 10 && store.Status == "ERROR", "bad response never corrupts partial");
            File.Delete(path + ".part");

            handler.Reply = _ => new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent(new byte[bytes.Length]) };
            await Throws<IOException>(() => store.DistributeAsync(metadata), "reject hash mismatch");
            Check(!File.Exists(path) && !File.Exists(path + ".part") && store.ReadyHash == null, "corrupt complete download removed");

            handler.Reply = _ =>
            {
                var response = new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent(bytes.Take(100).ToArray()) };
                response.Content.Headers.ContentLength = bytes.Length;
                return response;
            };
            await Throws<IOException>(() => store.DistributeAsync(metadata), "truncated stream fails");
            Check(new FileInfo(path + ".part").Length == 100, "truncated download retains resumable prefix");
            File.Delete(path + ".part");

            File.WriteAllBytes(path + ".part", bytes);
            requests = handler.Requests;
            await store.DistributeAsync(metadata);
            Check(handler.Requests == requests && store.Status == "READY", "complete valid partial promotes without request");
            File.Delete(path);

            using (var noSpace = new ContentStore(directory, config, client, _ => 0))
                await Throws<IOException>(() => noSpace.DistributeAsync(metadata), "reject insufficient disk space before request");
            using (var canceled = new CancellationTokenSource())
            {
                canceled.Cancel();
                await Throws<OperationCanceledException>(() => store.DistributeAsync(metadata, canceled.Token), "honor cancellation");
            }
            handler.Reply = _ => throw new HttpRequestException("secret URL?token=test-only-token");
            try { await store.DistributeAsync(metadata); } catch (IOException error)
            {
                Check(!error.ToString().Contains("test-only-token"), "HTTP error cannot expose token");
            }
        }
        finally { Directory.Delete(directory, true); }
    }

    static async Task TestController(string serverUrl, string token)
    {
        var config = new DeviceConfig { id = "Q01", serverUrl = serverUrl, token = token };
        var clock = new ClockSync();
        var snapshot = new TaskCompletionSource<WireMessage>(TaskCreationOptions.RunContinuationsAsynchronously);
        var clockReply = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var command = new TaskCompletionSource<WireMessage>(TaskCreationOptions.RunContinuationsAsynchronously);
        var fragmented = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
        var reconnected = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var blackholeRecovered = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        int connectionCount = 0;
        using var connection = new QuestConnection();
        using var probes = new Timer(_ => _ = connection.Send(new { v = 1, type = "CLOCK_PROBE", clientSentAt = clock.LocalNowMs }), null, 1000, 1000);
        connection.ConnectionChanged += online =>
        {
            if (online)
            {
                _ = connection.Send(new { v = 1, type = "CLOCK_PROBE", clientSentAt = clock.LocalNowMs });
                int count = Interlocked.Increment(ref connectionCount);
                if (count == 2) reconnected.TrySetResult(true);
                if (count == 3) blackholeRecovered.TrySetResult(true);
            }
        };
        connection.MessageReceived += text =>
        {
            var message = JsonConvert.DeserializeObject<WireMessage>(text);
            if (message.type == "SNAPSHOT") snapshot.TrySetResult(message);
            if (message.type == "FRAGMENT_TEST") fragmented.TrySetResult(message.eventName);
            if (message.type == "CLOCK_REPLY") clockReply.TrySetResult(clock.AcceptReply(message.clientSentAt, message.serverReceivedAt, message.serverSentAt));
            if (message.type == "COMMAND")
            {
                command.TrySetResult(message);
                _ = connection.Send(new { v = 1, type = "ACK", commandId = message.commandId, status = "OK" });
            }
        };
        connection.Start(config);
        var received = await snapshot.Task.WaitAsync(TimeSpan.FromSeconds(10));
        Check(received.v == 1 && received.desired.experience.vr.size > 0, "real controller HELLO snapshot");
        Check(await clockReply.Task.WaitAsync(TimeSpan.FromSeconds(10)) && clock.IsFresh, "real controller clock probe roundtrip");
        using var http = new HttpClient();
        using var action = await http.PostAsync(serverUrl + "/api/action", new StringContent("{\"action\":\"IDENTIFY\",\"ids\":[\"Q01\"]}", System.Text.Encoding.UTF8, "application/json"));
        Check(action.IsSuccessStatusCode, "controller accepts command request");
        var receivedCommand = await command.Task.WaitAsync(TimeSpan.FromSeconds(10));
        Check(receivedCommand.action == "IDENTIFY" && !string.IsNullOrEmpty(receivedCommand.commandId), "command delivered to C# client");
        await connection.Send(new { v = 1, type = "HEARTBEAT", observed = new { appVersion = "core-test", battery = 85, charging = false, freeBytes = 10000000000L, playback = "LOBBY", contentStatus = "MISSING", positionMs = 0 }, clock = new { offsetMs = clock.OffsetMs, rttMs = clock.RttMs } });
        JObject state = null;
        for (int i = 0; i < 50; i++)
        {
            state = JObject.Parse(await http.GetStringAsync(serverUrl + "/api/state"));
            if ((string)state["devices"][0]["command"]?["status"] == "OK") break;
            await Task.Delay(20);
        }
        Check((string)state["devices"][0]["command"]?["status"] == "OK", "controller receives C# acknowledgment");
        Check(await fragmented.Task.WaitAsync(TimeSpan.FromSeconds(10)) == "órbita ✨", "fragmented UTF-8 WebSocket message reconstructed");
        Check(await reconnected.Task.WaitAsync(TimeSpan.FromSeconds(10)) && connection.IsConnected, "automatic reconnection after peer closes");
        await Task.WhenAll(Enumerable.Range(0, 16).Select(_ => connection.Send(new { v = 1, type = "CLOCK_PROBE", clientSentAt = clock.LocalNowMs })));
        Check(connection.IsConnected, "parallel sends serialize on current socket");
        var blackholeStart = System.Diagnostics.Stopwatch.StartNew();
        Check(await blackholeRecovered.Task.WaitAsync(TimeSpan.FromSeconds(20)), "silent half-open socket times out and reconnects");
        Check(blackholeStart.Elapsed.TotalSeconds >= 10, "recovery follows idle watchdog rather than server disconnect");

        var directory = Path.Combine(Path.GetTempPath(), "otrorayo-live-" + Guid.NewGuid().ToString("N"));
        using (var store = new ContentStore(directory, config))
        {
            try
            {
                await store.DistributeAsync(received.desired.experience.vr);
                Check(store.Status == "READY" && await store.VerifyAsync(received.desired.experience.vr), "real controller content stream and SHA-256");
                var local = store.LocalPath(received.desired.experience.vr);
                File.Move(local, local + ".part");
                using (var partial = new FileStream(local + ".part", FileMode.Open, FileAccess.Write)) partial.SetLength(100);
                await store.DistributeAsync(received.desired.experience.vr);
                Check(await store.VerifyAsync(received.desired.experience.vr), "real controller resumed HTTP range");
            }
            finally { Directory.Delete(directory, true); }
        }
    }

    sealed class FakeHandler : HttpMessageHandler
    {
        public Func<HttpRequestMessage, HttpResponseMessage> Reply;
        public int Requests;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            Requests++;
            return Task.FromResult(Reply(request));
        }
    }
}
