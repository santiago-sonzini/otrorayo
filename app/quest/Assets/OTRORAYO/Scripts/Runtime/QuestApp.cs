using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json;
using UnityEngine;
using UnityEngine.Video;

namespace Otrorayo.Quest
{
    // All Unity/VideoPlayer work stays on Unity's synchronization context.
    // Network workers only enqueue actions; a network outage never stops the decoder.
    public sealed class QuestApp : MonoBehaviour
    {
        readonly ConcurrentQueue<Action> inbox = new ConcurrentQueue<Action>();
        readonly Dictionary<string, object> acknowledgements = new Dictionary<string, object>();
        readonly Queue<string> acknowledgementOrder = new Queue<string>();
        readonly CancellationTokenSource lifetime = new CancellationTokenSource();
        readonly ClockSync clock = new ClockSync();
        QuestPresentation presentation;
        QuestConnection connection;
        ContentStore store;
        DeviceConfig config;
        ExperienceInfo experience;
        DesiredState pendingSnapshot;
        CancellationTokenSource operation;
        string playback = "LOBBY", lastError;
        int generation = -1, operationVersion, commandRevision;
        long lastClockSampleVersion, cachedFreeBytes = -1;
        double? scheduledLocalAt, timelineLocalOrigin, appliedStartAt, appliedScheduledAt;
        double appliedPausedAt;
        double nextHeartbeat, nextProbe, firstFrameDeadline;
        bool awaitingFirstFrame, transferBusy, preparing, destroyed, suspendedDuringPlayback;
        bool videoStarted, firstFramePrimed;
        const double VideoStartMs = WelcomeSequence.VideoStartSeconds * 1000;
        string logPath;
        VideoPlayer Player => presentation.Player;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Boot()
        {
            if (FindFirstObjectByType<QuestApp>() == null)
                new GameObject("OTRORAYO Quest").AddComponent<QuestApp>();
        }

        void Start()
        {
            DontDestroyOnLoad(gameObject);
            Application.runInBackground = true;
            Screen.sleepTimeout = SleepTimeout.NeverSleep;
            Application.targetFrameRate = 72;
            presentation = gameObject.AddComponent<QuestPresentation>();
            presentation.Initialize();
            presentation.Configure("OTRORAYO", new LobbyConfig());
            presentation.ShowLobby();
            logPath = Path.Combine(Application.persistentDataPath, "quest-events.jsonl");
            Player.errorReceived += OnVideoError;
            Player.frameReady += OnFrameReady;
            Player.loopPointReached += OnVideoEnded;
            Player.sendFrameReadyEvents = true;
            Player.waitForFirstFrame = true;
            try
            {
                var configPath = Path.Combine(Application.persistentDataPath, "quest-config.json");
                if (!File.Exists(configPath))
                {
                    presentation.SetStatus("VISOR SIN CONFIGURAR\nConectalo por USB y ejecutá el instalador.");
                    return;
                }
                config = JsonConvert.DeserializeObject<DeviceConfig>(File.ReadAllText(configPath));
                config.Validate();
                cachedFreeBytes = FreeBytes() ?? -1;
                store = new ContentStore(Path.Combine(Application.persistentDataPath, "content"), config, availableBytes: _ =>
                {
                    // ContentStore checks on worker threads: never call Unity/JNI from here.
                    long available = Interlocked.Read(ref cachedFreeBytes);
                    return available < 0 ? (long?)null : available;
                });
                connection = new QuestConnection();
                connection.MessageReceived += raw =>
                {
                    double receivedAt = clock.LocalNowMs;
                    inbox.Enqueue(() => Receive(raw, receivedAt));
                };
                connection.ConnectionChanged += online => inbox.Enqueue(() => ConnectionChanged(online));
                connection.Start(config);
                presentation.SetStatus(config.id + " · CONECTANDO CON LA MAC");
                Log("app_started", new { id = config.id, version = Application.version });
            }
            catch (Exception)
            {
                // Configuration contains a secret; never log the file or a raw network exception.
                lastError = "Configuración inválida. Volvé a ejecutar el instalador por USB.";
                presentation.SetStatus(lastError);
            }
        }

        void Update()
        {
            for (int i = 0; i < 100 && inbox.TryDequeue(out var action); i++)
            {
                try { action(); }
                catch (Exception) { Fail("Mensaje de control inválido"); }
            }
            if (connection == null) return;
            double now = clock.LocalNowMs;
            if (playback == "SCHEDULED" && scheduledLocalAt.HasValue && now >= scheduledLocalAt.Value)
            {
                if (now - scheduledLocalAt.Value > 250)
                {
                    CancelPreparation(); scheduledLocalAt = null; Player.Pause(); presentation.SetWelcomeAudio(false); playback = "PAUSED";
                    lastError = "El inicio programado venció. Ejecutá RESYNC desde la Mac.";
                    presentation.SetStatus(lastError); Heartbeat(); return;
                }
                scheduledLocalAt = null;
                playback = "PLAYING";
                videoStarted = false;
                Log("welcome_play_called", new { localMs = now, serverEstimateMs = clock.ServerNowMs });
                Heartbeat();
            }
            if (playback == "PLAYING" && timelineLocalOrigin.HasValue)
            {
                double elapsed = Math.Max(0, now - timelineLocalOrigin.Value);
                if (elapsed >= VideoStartMs && !videoStarted)
                {
                    videoStarted = true;
                    awaitingFirstFrame = true;
                    firstFrameDeadline = now + 10000;
                    Player.Play();
                    Log("video_play_called", new { localMs = now, showPositionMs = elapsed, decoderPrepared = Player.isPrepared });
                }
                float mix = videoStarted && !awaitingFirstFrame ? (float)(Player.time / WelcomeSequence.FadeSeconds) : 0;
                presentation.RenderWelcome((float)(elapsed / 1000), mix);
                presentation.SetWelcomeAudio(true,(float)(elapsed/1000));
            }
            if (awaitingFirstFrame && now > firstFrameDeadline)
                Fail("No se recibió el primer cuadro del video. Revisá formato y decodificador.");
            if (now >= nextHeartbeat) { nextHeartbeat = now + 500; Heartbeat(); }
            if (now >= nextProbe) { nextProbe = now + 3000; Probe(); }
        }

        double PositionMs
        {
            get
            {
                if (playback == "PAUSED" || playback == "SCHEDULED") return appliedPausedAt;
                if (playback != "PLAYING" || !timelineLocalOrigin.HasValue) return 0;
                return videoStarted && !awaitingFirstFrame ? VideoStartMs + Math.Max(0, Player.time * 1000)
                    : Math.Max(0, clock.LocalNowMs - timelineLocalOrigin.Value);
            }
        }
        void ConnectionChanged(bool online)
        {
            Log(online ? "network_connected" : "network_disconnected", new { playback });
            if (online) { clock.Reset(); lastClockSampleVersion = -1; Probe(); Heartbeat(); }
            if (playback == "LOBBY" || playback == "STANDBY" || playback == "READY")
                presentation.SetStatus(config.id + (online ? " · ESPERANDO AL OPERADOR" : " · RECONECTANDO CON LA MAC"));
        }
        void Probe() => Send(new { v = 1, type = "CLOCK_PROBE", clientSentAt = clock.LocalNowMs });
        void Send(object message)
        {
            if (connection != null && !destroyed) _ = SendSafely(message);
        }
        async Task SendSafely(object message)
        {
            try { await connection.Send(message); }
            catch (Exception) { /* Transport handles reconnect; don't interrupt local playback. */ }
        }
        void Heartbeat(bool newClockSample = false)
        {
            if (store == null || config == null || destroyed) return;
            long? free = FreeBytes();
            Interlocked.Exchange(ref cachedFreeBytes, free ?? -1);
            var message = new Dictionary<string, object>
            {
                ["v"] = 1, ["type"] = "HEARTBEAT",
                ["observed"] = new
                {
                    appVersion = "quest-" + Application.version,
                    battery = SystemInfo.batteryLevel < 0 ? (float?)null : SystemInfo.batteryLevel * 100,
                    charging = SystemInfo.batteryStatus == BatteryStatus.Charging || SystemInfo.batteryStatus == BatteryStatus.Full,
                    freeBytes = free, contentSha256 = store.ReadyHash, contentStatus = store.Status,
                    transferPercent = store.Progress, playback, positionMs = PositionMs, error = lastError
                }
            };
            // Never refresh the server's clock freshness with a cached measurement.
            if (newClockSample && clock.IsFresh)
                message["clock"] = new { offsetMs = clock.OffsetMs, rttMs = clock.RttMs, sampleAgeMs = Math.Max(0, clock.LocalNowMs - clock.SelectedSampleAt) };
            Send(message);
        }
        long? FreeBytes()
        {
            try
            {
#if UNITY_ANDROID && !UNITY_EDITOR
                using (var stat = new AndroidJavaObject("android.os.StatFs", Application.persistentDataPath))
                    return stat.Call<long>("getAvailableBytes");
#else
                return new DriveInfo(Path.GetPathRoot(Application.persistentDataPath)).AvailableFreeSpace;
#endif
            }
            catch { return null; }
        }

        void Receive(string raw, double receivedAt)
        {
            var message = JsonConvert.DeserializeObject<WireMessage>(raw);
            if (message == null || message.v != 1) return;
            switch (message.type)
            {
                case "CLOCK_REPLY":
                    bool accepted = clock.AcceptReply(message.clientSentAt, message.serverReceivedAt, message.serverSentAt, receivedAt);
                    bool newSample = accepted && clock.SampleVersion != lastClockSampleVersion;
                    if (newSample) lastClockSampleVersion = clock.SampleVersion;
                    Heartbeat(newSample);
                    if (pendingSnapshot != null && clock.IsFresh)
                    {
                        var snapshot = pendingSnapshot; pendingSnapshot = null; Reconcile(snapshot);
                    }
                    break;
                case "SNAPSHOT": Reconcile(message.desired); break;
                case "COMMAND": Command(message); break;
            }
        }
        void SetExperience(ExperienceInfo next, int newGeneration)
        {
            if (newGeneration < generation) throw new InvalidOperationException("Generación anterior");
            if (newGeneration > generation)
            {
                CancelPreparation();
                generation = newGeneration;
                ReturnToLobby();
            }
            if (next != null) experience = next;
            if (experience != null) presentation.Configure(experience.eventName, experience.lobby ?? new LobbyConfig());
        }
        void RememberAck(string id, string status, string detail = "")
        {
            var ack = new { v = 1, type = "ACK", commandId = id, status, detail };
            acknowledgements[id] = ack; acknowledgementOrder.Enqueue(id);
            while (acknowledgementOrder.Count > 128) acknowledgements.Remove(acknowledgementOrder.Dequeue());
            Send(ack);
        }
        void Command(WireMessage message)
        {
            if (string.IsNullOrEmpty(message.commandId)) return;
            if (acknowledgements.TryGetValue(message.commandId, out var prior)) { Send(prior); return; }
            // A new command supersedes deferred reconnect reconciliation.
            pendingSnapshot = null;
            commandRevision++;
            try
            {
                if (message.generation < generation) throw new InvalidOperationException("Comando de una experiencia anterior");
                SetExperience(message.experience, message.generation);
                switch (message.action)
                {
                    case "DISTRIBUTE":
                        RequireIdle();
                        if (transferBusy) throw new InvalidOperationException("Ya hay una descarga en curso");
                        if (message.content == null) throw new InvalidOperationException("Falta el archivo VR");
                        transferBusy = true;
                        RememberAck(message.commandId, "OK", "Descarga aceptada; consultar contenido en telemetría");
                        _ = Download(message.content);
                        return;
                    case "PREPARE":
                    case "RELOAD":
                        RequireIdle();
                        if (transferBusy) throw new InvalidOperationException("Esperá a que termine la descarga");
                        var content = message.content ?? experience?.vr;
                        if (content == null) throw new InvalidOperationException("No hay experiencia para preparar");
                        RememberAck(message.commandId, "OK", "Preparación aceptada; esperar playback READY");
                        _ = Prepare(content);
                        return;
                    case "PLAY_AT":
                        if (preparing || playback != "READY" || !firstFramePrimed || !clock.IsFresh) throw new InvalidOperationException("Visor o reloj no preparado");
                        if (message.experienceId != experience?.id) throw new InvalidOperationException("Experiencia incorrecta");
                        appliedPausedAt = 0;
                        presentation.BeginWelcome();
                        Schedule(message.startAt, message.startAt);
                        break;
                    case "PAUSE":
                        CancelPreparation(); Player.Pause(); presentation.SetWelcomeAudio(false); scheduledLocalAt = null;
                        playback = "PAUSED"; appliedPausedAt = message.targetPositionMs; awaitingFirstFrame = false;
                        break;
                    case "RESUME":
                        if (playback != "PAUSED" || !clock.IsFresh || !Player.isPrepared) throw new InvalidOperationException("Visor no pausado o reloj vencido");
                        BeginSeekSchedule(message.startAt, message.scheduledAt);
                        break;
                    case "RESYNC":
                        if (!clock.IsFresh || !Player.isPrepared) throw new InvalidOperationException("Necesita preparar el video y medir reloj");
                        BeginSeekSchedule(message.startAt, message.scheduledAt);
                        break;
                    case "STOP": case "LOBBY": ReturnToLobby(); break;
                    case "IDENTIFY": presentation.Identify(config.id); break;
                    default: throw new InvalidOperationException("Comando desconocido");
                }
                lastError = null;
                RememberAck(message.commandId, "OK");
                Log("command", new { message.action, message.commandId, message.generation });
                Heartbeat();
            }
            catch (Exception error)
            {
                RememberAck(message.commandId, "ERROR", error is InvalidOperationException ? error.Message : "No se pudo ejecutar el comando");
                Heartbeat();
            }
        }
        void RequireIdle()
        {
            if (playback == "PLAYING" || playback == "SCHEDULED" || playback == "PAUSED")
                throw new InvalidOperationException("Detené la reproducción antes de preparar o descargar");
        }
        async Task Download(ContentInfo content)
        {
            try
            {
                lastError = null; presentation.SetStatus(config.id + " · DESCARGANDO EXPERIENCIA");
                await store.DistributeAsync(content, lifetime.Token);
                if (!destroyed) presentation.SetStatus(config.id + " · ARCHIVO VERIFICADO");
                Log("content_verified", new { content.sha256, content.size });
            }
            catch (OperationCanceledException) { }
            catch (Exception) { if (!destroyed) Fail("Falló la descarga o el checksum. Revisá la red y volvé a distribuir."); }
            finally { transferBusy = false; Heartbeat(); }
        }
        void CancelPreparation()
        {
            operationVersion++;
            operation?.Cancel(); operation?.Dispose(); operation = null;
            preparing = false;
        }
        async Task<bool> Prepare(ContentInfo content)
        {
            CancelPreparation();
            int version = operationVersion;
            operation = CancellationTokenSource.CreateLinkedTokenSource(lifetime.Token);
            var cancellation = operation.Token;
            preparing = true; playback = "STANDBY"; lastError = null;
            scheduledLocalAt = null; awaitingFirstFrame = false; firstFramePrimed = false; videoStarted = false;
            Player.Stop(); presentation.ShowLobby(); presentation.SetStatus(config.id + " · PREPARANDO EXPERIENCIA");
            try
            {
                if (!await store.VerifyAsync(content, cancellation)) throw new IOException("Archivo no validado");
                cancellation.ThrowIfCancellationRequested();
                presentation.SetVideoFormat(content);
                Player.url = new Uri(store.LocalPath(content)).AbsoluteUri;
                Player.Prepare();
                double deadline = clock.LocalNowMs + 30000;
                while (!Player.isPrepared)
                {
                    cancellation.ThrowIfCancellationRequested();
                    if (lastError != null || clock.LocalNowMs > deadline) throw new IOException("Decodificador no preparado");
                    await Task.Delay(30, cancellation);
                }
                cancellation.ThrowIfCancellationRequested();
                if (version != operationVersion || destroyed) return false;
                // Decode the first actual frame silently before exposing READY. Pause retains
                // the decoder and texture throughout the native welcome (no second Prepare).
                var primed = new TaskCompletionSource<bool>();
                VideoPlayer.FrameReadyEventHandler first = (source, frame) =>
                {
                    source.Pause(); primed.TrySetResult(true);
                };
                Player.frameReady += first;
                try
                {
                    presentation.SetVideoAudio(0);
                    Player.Play();
                    if (await Task.WhenAny(primed.Task, Task.Delay(10000, cancellation)) != primed.Task)
                        throw new IOException("No se decodificó el primer cuadro");
                }
                finally { Player.frameReady -= first; }
                cancellation.ThrowIfCancellationRequested();
                if (version != operationVersion || destroyed) return false;
                Player.Pause(); firstFramePrimed = true; playback = "READY"; preparing = false;
                presentation.BeginWelcome();
                Log("first_frame_preloaded", new { frame = Player.frame, seconds = Player.time });
                presentation.SetStatus(config.id + " · LISTO PARA COMENZAR");
                Log("video_prepared", new { width = Player.width, height = Player.height, fps = Player.frameRate, seconds = Player.length });
                Heartbeat(); return true;
            }
            catch (OperationCanceledException) { return false; }
            catch (Exception)
            {
                if (version == operationVersion && !destroyed) Fail("No se pudo preparar el video. Revisá el archivo y su formato.");
                return false;
            }
            finally { if (version == operationVersion) preparing = false; }
        }
        void Schedule(double? startAt, double? playAt)
        {
            if (!startAt.HasValue || !playAt.HasValue || !clock.IsFresh || !Player.isPrepared)
                throw new InvalidOperationException("Línea de tiempo o reloj inválidos");
            double offset = clock.OffsetMs;
            double gate = playAt.Value - offset;
            if (clock.LocalNowMs > gate + 250)
                throw new InvalidOperationException("Inicio recibido tarde. Usá RESYNC");
            timelineLocalOrigin = startAt.Value - offset;
            scheduledLocalAt = gate;
            appliedStartAt = startAt; appliedScheduledAt = playAt;
            playback = "SCHEDULED";
            presentation.SetStatus(config.id + " · LA EXPERIENCIA ESTÁ POR COMENZAR");
        }
        void BeginSeekSchedule(double? startAt, double? scheduledAt)
        {
            if (!startAt.HasValue || !clock.IsFresh) throw new InvalidOperationException("Reloj o timeline inválidos");
            CancelPreparation();
            operation = CancellationTokenSource.CreateLinkedTokenSource(lifetime.Token);
            _ = SeekSchedule(startAt.Value, scheduledAt ?? startAt.Value, operationVersion, operation.Token);
        }
        async Task SeekSchedule(double startAt, double scheduledAt, int version, CancellationToken cancellation)
        {
            try
            {
                preparing = true; awaitingFirstFrame = false; this.scheduledLocalAt = null;
                Player.Pause(); presentation.SetWelcomeAudio(false); playback = "PAUSED";
                if (!Player.canSetTime) throw new InvalidOperationException("El video no permite seek");
                double offset = clock.OffsetMs;
                // Explicit resync may seek; reconnect alone preserves an already running decoder.
                double gate = Math.Max(scheduledAt - offset, clock.LocalNowMs + 2000);
                double origin = startAt - offset;
                double showPositionMs = Math.Max(0, gate - origin);
                double positionSeconds = Math.Max(0, showPositionMs - VideoStartMs) / 1000;
                if (Player.length > 0 && positionSeconds >= Player.length) { ReturnToLobby(); return; }
                var sought = new TaskCompletionSource<bool>();
                VideoPlayer.EventHandler completed = _ => sought.TrySetResult(true);
                Player.seekCompleted += completed;
                try
                {
                    // Setting time to the same value may not produce seekCompleted.
                    if (Math.Abs(Player.time - positionSeconds) > .01)
                    {
                        Player.time = positionSeconds;
                        var timeout = Task.Delay(10000, cancellation);
                        if (await Task.WhenAny(sought.Task, timeout) != sought.Task) throw new IOException("Seek vencido");
                    }
                }
                finally { Player.seekCompleted -= completed; }
                cancellation.ThrowIfCancellationRequested();
                if (version != operationVersion || destroyed) return;
                if (clock.LocalNowMs > gate - 50)
                    throw new IOException("El seek no terminó antes del inicio previsto");
                appliedStartAt = startAt; appliedScheduledAt = scheduledAt;
                timelineLocalOrigin = origin;
                this.scheduledLocalAt = gate;
                appliedPausedAt = showPositionMs; videoStarted = false;
                playback = "SCHEDULED"; preparing = false;
                Log("resync_scheduled", new { positionSeconds, seekLateMs = Math.Max(0, clock.LocalNowMs - gate) });
                Heartbeat();
            }
            catch (OperationCanceledException) { }
            catch (Exception) { if (version == operationVersion && !destroyed) Fail("No se pudo resincronizar el video. Volvé a preparar."); }
            finally { if (version == operationVersion) preparing = false; }
        }
        async void Reconcile(DesiredState snapshot)
        {
            if (snapshot == null || snapshot.generation < generation) return;
            try
            {
                int revision = commandRevision;
                SetExperience(snapshot.experience, snapshot.generation);
                if (snapshot.selected == null || !snapshot.selected.Contains(config.id) || snapshot.phase == "IDLE")
                {
                    ReturnToLobby();
                    return;
                }
                if ((snapshot.phase == "PLAYING" || snapshot.phase == "SCHEDULED" || snapshot.phase == "PAUSED") && !clock.IsFresh)
                { pendingSnapshot = snapshot; Probe(); return; }
                if (transferBusy || preparing || snapshot.experience?.vr == null) return;
                // Preserve continuity across network reconnection. Operator can explicitly RESYNC.
                bool sameTimeline = appliedStartAt == snapshot.startAt && appliedScheduledAt == snapshot.scheduledAt;
                if (snapshot.phase == "PLAYING" && playback == "PLAYING" && sameTimeline) { Heartbeat(); return; }
                if (snapshot.phase == "SCHEDULED" && playback == "SCHEDULED" && sameTimeline) { Heartbeat(); return; }
                if (snapshot.phase == "PAUSED" && playback == "PAUSED" && sameTimeline && appliedPausedAt == snapshot.pausedAtMs) { Heartbeat(); return; }
                // A newly connected/restarted visor must never jump into a welcome in progress.
                // Keep the current local timeline on reconnect; a fresh run requires PLAY_AT.
                if (!sameTimeline && (snapshot.phase == "PLAYING" || snapshot.phase == "SCHEDULED" || snapshot.phase == "PAUSED"))
                {
                    lastError = "Esta función ya comenzó. Volvé a LOBBY y PREPARAR para iniciar desde negro.";
                    Heartbeat(); return;
                }
                if (sameTimeline && snapshot.phase == "PAUSED")
                {
                    Player.Pause(); presentation.SetWelcomeAudio(false); scheduledLocalAt = null; awaitingFirstFrame = false;
                    appliedPausedAt = snapshot.pausedAtMs; playback = "PAUSED";
                    presentation.RenderWelcome((float)(appliedPausedAt/1000), (float)(Math.Max(0,appliedPausedAt-VideoStartMs)/1000/WelcomeSequence.FadeSeconds));
                    Heartbeat(); return;
                }
                bool shouldPrepare = new[] { "PREPARING", "READY", "PLAYING", "SCHEDULED", "PAUSED" }.Contains(snapshot.phase);
                if (!shouldPrepare) return;
                int before = operationVersion;
                if (playback != "READY" && !await Prepare(snapshot.experience.vr)) return;
                // Prepare increments the version once. Any other command invalidates recovery.
                if (commandRevision != revision || operationVersion > before + 1 || snapshot.generation != generation || destroyed) return;
                if (snapshot.phase == "PAUSED")
                {
                    if (Player.canSetTime) Player.time = Math.Max(0, snapshot.pausedAtMs - VideoStartMs) / 1000;
                    appliedStartAt = snapshot.startAt; appliedScheduledAt = snapshot.scheduledAt; appliedPausedAt = snapshot.pausedAtMs;
                    Player.Pause(); presentation.SetWelcomeAudio(false); playback = "PAUSED";
                }
                else if (snapshot.phase == "PLAYING" || snapshot.phase == "SCHEDULED")
                    BeginSeekSchedule(snapshot.startAt, snapshot.scheduledAt);
                Heartbeat();
            }
            catch (Exception) { if (!destroyed) Fail("No se pudo recuperar el estado. Usá Preparar desde la Mac."); }
        }
        void ReturnToLobby()
        {
            CancelPreparation(); scheduledLocalAt = null; timelineLocalOrigin = null;
            appliedStartAt = null; appliedScheduledAt = null; appliedPausedAt = 0;
            awaitingFirstFrame = false; videoStarted = false; firstFramePrimed = false; Player.Stop(); playback = "LOBBY";
            lastError = null; presentation.ShowLobby();
            presentation.SetStatus(config == null ? "OTRORAYO" : config.id + " · ESPERANDO AL OPERADOR");
            Heartbeat();
        }
        void OnFrameReady(VideoPlayer source, long frame)
        {
            if (playback != "PLAYING") return;
            if (awaitingFirstFrame)
            {
                awaitingFirstFrame = false;
                Log("first_decoded_frame", new { frame, positionMs = PositionMs, localMs = clock.LocalNowMs,
                    estimatedDriftMs = timelineLocalOrigin.HasValue ? PositionMs - (clock.LocalNowMs - timelineLocalOrigin.Value) : 0 });
            }
        }
        void OnVideoEnded(VideoPlayer source) { Log("video_ended", new { positionMs = PositionMs }); ReturnToLobby(); }
        void OnVideoError(VideoPlayer source, string detail) { Fail("El decodificador rechazó el video. Revisá codec, resolución y audio."); }
        void Fail(string message)
        {
            CancelPreparation(); timelineLocalOrigin = null;
            lastError = message; playback = "ERROR"; scheduledLocalAt = null; awaitingFirstFrame = false; firstFramePrimed = false; videoStarted = false;
            Player.Stop(); presentation.ShowLobby(); presentation.SetStatus(message); Log("error", new { message }); Heartbeat();
        }
        void Log(string kind, object data)
        {
            if (logPath == null || destroyed) return;
            try
            {
                if (File.Exists(logPath) && new FileInfo(logPath).Length > 4 * 1024 * 1024)
                {
                    string old = logPath + ".1"; if (File.Exists(old)) File.Delete(old); File.Move(logPath, old);
                }
                File.AppendAllText(logPath, JsonConvert.SerializeObject(new { at = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), kind, data }) + "\n");
            }
            catch (IOException) { }
        }
        void OnApplicationPause(bool paused)
        {
            if (presentation == null) return;
            Log(paused ? "app_suspended" : "app_resumed", new { playback });
            if (paused) suspendedDuringPlayback = playback == "PLAYING" || playback == "SCHEDULED" || preparing;
            if (!paused && connection != null)
            {
                if (suspendedDuringPlayback)
                {
                    suspendedDuringPlayback = false; CancelPreparation();
                    scheduledLocalAt = null; awaitingFirstFrame = false; Player.Pause(); presentation.SetWelcomeAudio(false);
                    playback = Player.isPrepared ? "PAUSED" : "ERROR";
                    lastError = "El visor se suspendió. Ejecutá RESYNC o volvé a preparar desde la Mac.";
                    presentation.SetStatus(lastError);
                }
                Probe(); Heartbeat();
            }
        }
        void OnDestroy()
        {
            destroyed = true; CancelPreparation(); lifetime.Cancel(); connection?.Dispose(); store?.Dispose();
            if (presentation != null && Player != null) { Player.errorReceived -= OnVideoError; Player.frameReady -= OnFrameReady; Player.loopPointReached -= OnVideoEnded; }
            lifetime.Dispose();
        }
    }
}
