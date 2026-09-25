using System;

namespace Otrorayo.Quest
{
    // Public fields preserve the controller's JSON names with Newtonsoft.Json and Unity's inspector.
    [Serializable]
    public sealed class DeviceConfig
    {
        public string id = "Q01";
        public string serverUrl = "http://192.168.1.100:8787";
        public string token = "";

        public void Validate()
        {
            DeviceEndpoints.Origin(this);
            if (!System.Text.RegularExpressions.Regex.IsMatch(id ?? "", @"^Q(0[1-9]|10)$"))
                throw new ArgumentException("Usá un ID entre Q01 y Q10.");
        }
    }

    [Serializable]
    public sealed class ContentInfo
    {
        public string file;
        public long size;
        public string sha256;
        public string projection = "360";
        public string stereo = "mono";
        public bool muted = true;
    }

    [Serializable]
    public sealed class LobbyConfig
    {
        public string preset = "orbit";
        public string color = "#75dec9";
        public float particleIntensity = 0.5f;
    }

    [Serializable]
    public sealed class ExperienceInfo
    {
        public string id;
        public string eventName;
        public string name;
        public ContentInfo vr;
        public LobbyConfig lobby = new LobbyConfig();
    }

    [Serializable]
    public sealed class DesiredState
    {
        public string phase;
        public string[] selected;
        public double? startAt;
        public double? scheduledAt;
        public double pausedAtMs;
        public int generation;
        public ExperienceInfo experience;
        public string eventName;
    }

    [Serializable]
    public sealed class WireMessage
    {
        public int v;
        public string type;
        public string commandId;
        public int generation;
        public string action;
        public ContentInfo content;
        public string experienceId;
        public ExperienceInfo experience;
        public string eventName;
        public double? startAt;
        public double? scheduledAt;
        public double targetPositionMs;
        public DesiredState desired;
        public double clientSentAt;
        public double serverReceivedAt;
        public double serverSentAt;
        public double serverTime;
    }

    internal static class DeviceEndpoints
    {
        internal static Uri Origin(DeviceConfig config)
        {
            if (config == null) throw new ArgumentNullException(nameof(config));
            Uri uri;
            if (!Uri.TryCreate(config.serverUrl, UriKind.Absolute, out uri) ||
                (uri.Scheme != "http" && uri.Scheme != "https") ||
                string.IsNullOrWhiteSpace(uri.Host) || !string.IsNullOrEmpty(uri.UserInfo) ||
                !string.IsNullOrEmpty(uri.Query) || !string.IsNullOrEmpty(uri.Fragment) ||
                (uri.AbsolutePath != "/" && uri.AbsolutePath != ""))
                throw new ArgumentException("La dirección del controlador debe ser http(s)://IP:puerto.");
            if (string.IsNullOrWhiteSpace(config.token)) throw new ArgumentException("Falta el token del controlador.");
            return uri;
        }

        internal static Uri WebSocket(DeviceConfig config)
        {
            var origin = Origin(config);
            var builder = new UriBuilder(origin)
            {
                Scheme = origin.Scheme == "https" ? "wss" : "ws",
                Path = "/ws/device",
                Query = "token=" + Uri.EscapeDataString(config.token)
            };
            return builder.Uri;
        }

        internal static Uri Content(DeviceConfig config, string hash)
        {
            return new UriBuilder(Origin(config))
            {
                Path = "/device/content",
                Query = "sha256=" + Uri.EscapeDataString(hash) + "&token=" + Uri.EscapeDataString(config.token)
            }.Uri;
        }
    }
}
