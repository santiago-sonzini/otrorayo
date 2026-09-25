using System;
using System.Collections.Generic;
using System.Diagnostics;

namespace Otrorayo.Quest
{
    /// <summary>Unix milliseconds anchored once, then advanced only by a monotonic stopwatch.</summary>
    public sealed class ClockSync
    {
        public const double FreshForMs = 15000;
        private readonly object gate = new object();
        private readonly Func<double> localNow;
        private readonly List<Sample> samples = new List<Sample>();
        private double offset;
        private double rtt;
        private double measuredAt = double.NegativeInfinity;
        private long sampleVersion;

        private struct Sample
        {
            public double Offset, Rtt, At;
        }

        public ClockSync(Func<double> localNowMs = null)
        {
            if (localNowMs != null) localNow = localNowMs;
            else
            {
                var unixBase = (DateTime.UtcNow - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalMilliseconds;
                var stopwatch = Stopwatch.StartNew();
                localNow = () => unixBase + stopwatch.Elapsed.TotalMilliseconds;
            }
        }

        public double LocalNowMs => localNow();
        public double ServerNowMs { get { lock (gate) return localNow() + offset; } }
        public double OffsetMs { get { lock (gate) return offset; } }
        public double RttMs { get { lock (gate) return rtt; } }
        public double SelectedSampleAt { get { lock (gate) return measuredAt; } }
        public long SampleVersion { get { lock (gate) return sampleVersion; } }
        public bool IsFresh { get { lock (gate) return localNow() - measuredAt >= 0 && localNow() - measuredAt < FreshForMs; } }

        public bool AcceptReply(double clientSentAt, double serverReceivedAt, double serverSentAt)
        {
            return AcceptReply(clientSentAt, serverReceivedAt, serverSentAt, localNow());
        }

        // True means the INCOMING sample was selected. Selecting a cached runner-up must not renew server freshness.
        public bool AcceptReply(double clientSentAt, double serverReceivedAt, double serverSentAt, double localReceivedAt)
        {
            if (!Finite(clientSentAt) || !Finite(serverReceivedAt) || !Finite(serverSentAt) || !Finite(localReceivedAt)) return false;
            double elapsed = localReceivedAt - clientSentAt;
            double serverElapsed = serverSentAt - serverReceivedAt;
            double sampleRtt = elapsed - serverElapsed;
            // Ignore delayed/invalid probes. Negative RTT up to 1 ms can be Date.now() quantization.
            if (elapsed < 0 || elapsed > 5000 || serverElapsed < 0 || sampleRtt < -1 || sampleRtt > 2000) return false;
            var sampleOffset = ((serverReceivedAt - clientSentAt) + (serverSentAt - localReceivedAt)) / 2;
            lock (gate)
            {
                if (localReceivedAt < measuredAt) return false;
                samples.RemoveAll(s => localReceivedAt - s.At >= FreshForMs);
                samples.Add(new Sample { Offset = sampleOffset, Rtt = Math.Max(0, sampleRtt), At = localReceivedAt });
                while (samples.Count > 8) samples.RemoveAt(0);
                var best = samples[0];
                foreach (var sample in samples) if (sample.Rtt <= best.Rtt) best = sample;
                bool changed = measuredAt != best.At || offset != best.Offset || rtt != best.Rtt;
                offset = best.Offset;
                rtt = best.Rtt;
                measuredAt = best.At;
                if (changed) sampleVersion++;
                return changed && best.At == localReceivedAt;
            }
        }

        // Store this returned number when accepting PLAY_AT; never recompute an active deadline on new probes.
        public double ToLocalTime(double serverTimestamp) => FreezeMapping().ToLocalTime(serverTimestamp);
        public double ServerToLocalMs(double serverTimestamp) => ToLocalTime(serverTimestamp);

        public ClockMapping FreezeMapping()
        {
            lock (gate)
            {
                if (localNow() - measuredAt >= FreshForMs || localNow() < measuredAt)
                    throw new InvalidOperationException("El reloj necesita una medición reciente.");
                return new ClockMapping(offset);
            }
        }

        public void Reset()
        {
            lock (gate) { samples.Clear(); measuredAt = double.NegativeInfinity; offset = 0; rtt = 0; }
        }

        private static bool Finite(double value) => !double.IsNaN(value) && !double.IsInfinity(value);
    }

    public readonly struct ClockMapping
    {
        public double OffsetMs { get; }
        internal ClockMapping(double offsetMs) { OffsetMs = offsetMs; }
        public double ToLocalTime(double serverTimestamp) => serverTimestamp - OffsetMs;
    }
}
