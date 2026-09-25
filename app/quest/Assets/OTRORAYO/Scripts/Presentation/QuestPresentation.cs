using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Video;

namespace Otrorayo.Quest
{
    /// <summary>
    /// Runtime-only native presentation. The controller owns prepare/play/seek and decides
    /// when the first decoded frame may replace the lobby.
    /// </summary>
    public sealed class QuestPresentation : MonoBehaviour
    {
        public VideoPlayer Player { get; private set; }
        public Camera HeadCamera { get; private set; }

        private static readonly Color DefaultAccent = new Color(0.43f, 0.92f, 0.86f);
        private readonly List<Material> ownedMaterials = new List<Material>();
        private readonly List<LineRenderer> rings = new List<LineRenderer>();
        private GameObject lobbyRoot;
        private Transform titleRoot;
        private Transform orbitRoot;
        private Renderer videoRenderer;
        private Transform videoSphere;
        private Transform ambienceSphere;
        private Material videoMaterial;
        private Material ambienceMaterial;
        private Material lineMaterial;
        private Material textMaterial;
        private Font font;
        private Texture2D particleTexture;
        private ParticleSystem particles;
        private TextMesh eventLabel;
        private TextMesh statusLabel;
        private TextMesh identityLabel;
        private GameObject identityRoot;
        private float identifyUntil;
        private Color accent = DefaultAccent;
        private string currentPreset = "orbit";
        private float particleIntensity = 0.5f;
        private bool initialized;
        private WelcomeSequence welcome;
        private AudioSource videoAudio;
        private bool videoMuted;

        public void Initialize()
        {
            if (initialized) return;
            initialized = true;
            var head = new GameObject("Quest head");
            head.transform.SetParent(transform, false);
            head.tag = "MainCamera";
            HeadCamera = head.AddComponent<Camera>();
            HeadCamera.clearFlags = CameraClearFlags.SolidColor;
            HeadCamera.backgroundColor = Color.black;
            HeadCamera.nearClipPlane = 0.05f;
            HeadCamera.farClipPlane = 150f;
            if (!UnityEngine.XR.XRSettings.enabled) HeadCamera.fieldOfView = 90f;
            HeadCamera.stereoTargetEye = StereoTargetEyeMask.Both;
            HeadCamera.allowHDR = false;
            head.AddComponent<AudioListener>();
            head.AddComponent<QuestHeadPose>();

            font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            lineMaterial = MakeMaterial("UnlitAlpha");
            textMaterial = MakeMaterial("UnlitAlpha");
            textMaterial.renderQueue = 3100;
            RefreshFontTexture(font);
            Font.textureRebuilt += RefreshFontTexture;

            BuildLobby();
            BuildVideo();
            BuildIdentity();
            welcome = new GameObject("OTRORAYO welcome sequence").AddComponent<WelcomeSequence>();
            welcome.transform.SetParent(transform, false);
            welcome.Initialize();
            Configure("Tu experiencia está por comenzar", null);
            SetStatus("Conectando con el operador…");
            ShowLobby();
            Application.onBeforeRender += FollowHeadPosition;
        }

        public void Configure(string eventName, LobbyConfig lobby)
        {
            Initialize();
            eventLabel.text = Wrap(eventName, 26, 3, "Tu experiencia está por comenzar");
            accent = DefaultAccent;
            if (lobby != null && !string.IsNullOrWhiteSpace(lobby.color) &&
                ColorUtility.TryParseHtmlString(lobby.color, out Color parsed))
                accent = new Color(parsed.r, parsed.g, parsed.b, 1f);
            currentPreset = lobby == null || string.IsNullOrWhiteSpace(lobby.preset)
                ? "orbit" : lobby.preset.Trim().ToLowerInvariant();
            particleIntensity = lobby == null || float.IsNaN(lobby.particleIntensity)
                ? 0.5f : Mathf.Clamp01(lobby.particleIntensity);
            ambienceMaterial.SetColor("_Tint", accent);
            ambienceMaterial.SetFloat("_Preset", currentPreset == "aurora" ? 1f : currentPreset == "minimal" ? 2f : 0f);
            statusLabel.color = Color.Lerp(accent, Color.white, 0.3f);
            for (int i = 0; i < rings.Count; i++)
            {
                float alpha = rings[i].startColor.a;
                var tint = new Color(accent.r, accent.g, accent.b, alpha);
                rings[i].startColor = tint;
                rings[i].endColor = tint;
            }
            // Minimal deliberately retains orientation rings, without orbit decoration.
            orbitRoot.gameObject.SetActive(currentPreset != "minimal");
            var emission = particles.emission;
            emission.rateOverTime = currentPreset == "minimal" ? 0f : particleIntensity * 16f;
            var main = particles.main;
            main.startColor = new ParticleSystem.MinMaxGradient(
                new Color(accent.r, accent.g, accent.b, 0.35f), new Color(0.9f, 0.95f, 1f, 0.7f));
            if (particleIntensity <= 0f || currentPreset == "minimal") particles.Clear();
        }

        public void SetStatus(string text)
        {
            Initialize();
            statusLabel.text = Wrap(text, 44, 3, "Esperando al operador");
        }

        public void Identify(string id)
        {
            Initialize();
            identityLabel.text = "ESTE VISOR\n" + Wrap(id, 18, 2, "QUEST") + "\nIDENTIFICACIÓN";
            identifyUntil = Time.unscaledTime + 8f;
            identityRoot.SetActive(true);
        }

        public void ShowLobby()
        {
            Initialize();
            SetVideoVisible(false);
        }

        /// <summary>Call with true only after receiving the first frameReady event.</summary>
        public void SetVideoVisible(bool visible)
        {
            Initialize();
            lobbyRoot.SetActive(false);
            videoRenderer.enabled = visible;
            videoMaterial.SetFloat("_Exposure", visible ? 1 : 0);
            if (!visible && welcome != null) welcome.gameObject.SetActive(false);
            SetVideoAudio(visible ? 1 : 0);
        }

        public void BeginWelcome()
        {
            Initialize();
            lobbyRoot.SetActive(false);
            welcome.Align(HeadCamera);
            videoSphere.rotation = Quaternion.Euler(0, HeadCamera.transform.eulerAngles.y, 0);
            RenderWelcome(0, 0);
        }

        public void RenderWelcome(float seconds, float mix)
        {
            mix = Mathf.SmoothStep(0, 1, Mathf.Clamp01(mix));
            lobbyRoot.SetActive(false);
            welcome.RenderAt(seconds, mix);
            videoRenderer.enabled = mix > 0;
            videoMaterial.SetFloat("_Exposure", mix);
            SetVideoAudio(mix);
        }

        public void SetWelcomeAudio(bool playing,float seconds=0)
        {
            welcome.SetAudioPlaying(playing,seconds);
        }

        public void SetVideoAudio(float volume)
        {
            if (videoAudio != null) videoAudio.volume = videoMuted ? 0 : Mathf.Clamp01(volume);
        }

        public void SetVideoFormat(ContentInfo content)
        {
            Initialize();
            string projection = content == null ? "360" : content.projection;
            string stereo = content == null ? "mono" : content.stereo;
            videoMaterial.SetFloat("_Projection180", projection == "180" ? 1f : 0f);
            string layout = (stereo ?? "mono").Trim().ToLowerInvariant().Replace("_", "-");
            float packed = layout == "top-bottom" || layout == "tb" || layout == "over-under" ? 1f
                : layout == "side-by-side" || layout == "sbs" || layout == "left-right" ? 2f : 0f;
            videoMaterial.SetFloat("_StereoLayout", packed);
            // New videos begin facing the viewer. Rotation stays fixed throughout playback.
            videoSphere.rotation = Quaternion.Euler(0f, HeadCamera.transform.eulerAngles.y, 0f);
            bool muted = content != null && content.muted;
            videoMuted = muted;
            // Set before Prepare so every encoded audio track obeys the event's mute setting.
            Player.audioOutputMode = VideoAudioOutputMode.AudioSource;
            Player.controlledAudioTrackCount = 1;
            Player.EnableAudioTrack(0, true);
            Player.SetTargetAudioSource(0, videoAudio);
            SetVideoAudio(0);
        }

        private void BuildVideo()
        {
            videoMaterial = MakeMaterial("Equirectangular");
            var sphere = CreateSphere("VR video", transform, 80f, videoMaterial);
            videoSphere = sphere.transform;
            videoRenderer = sphere.GetComponent<Renderer>();
            videoRenderer.enabled = false;
            // Unity allocates a decoder texture at the actual source resolution. There is
            // no duplicate fixed 8K render target and no downsampling of packed stereo eyes.
            Player = sphere.AddComponent<VideoPlayer>();
            Player.playOnAwake = false;
            Player.source = VideoSource.Url;
            Player.renderMode = VideoRenderMode.MaterialOverride;
            Player.targetMaterialRenderer = videoRenderer;
            Player.targetMaterialProperty = "_MainTex";
            videoAudio = sphere.AddComponent<AudioSource>();
            videoAudio.playOnAwake = false;
            videoAudio.spatialBlend = 0;
            videoAudio.volume = 0;
            Player.audioOutputMode = VideoAudioOutputMode.AudioSource;
            Player.controlledAudioTrackCount = 1;
            Player.SetTargetAudioSource(0, videoAudio);
            Player.waitForFirstFrame = true;
            Player.isLooping = false;
            Player.skipOnDrop = true;
            Player.sendFrameReadyEvents = true;
        }

        private void BuildLobby()
        {
            lobbyRoot = new GameObject("OTRORAYO waiting room");
            lobbyRoot.transform.SetParent(transform, false);
            ambienceMaterial = MakeMaterial("Ambience");
            ambienceSphere = CreateSphere("Night atmosphere", lobbyRoot.transform, 120f, ambienceMaterial).transform;

            titleRoot = new GameObject("Experience title").transform;
            titleRoot.SetParent(lobbyRoot.transform, false);
            CreateText("Brand", titleRoot, "O T R O R A Y O", new Vector3(0f, 2.45f, 3.7f), 0.12f,
                new Color(0.68f, 0.79f, 0.8f, 0.9f));
            eventLabel = CreateText("Event", titleRoot, "", new Vector3(0f, 1.95f, 3.7f), 0.22f, Color.white);
            statusLabel = CreateText("Status", titleRoot, "", new Vector3(0f, 1.15f, 3.7f), 0.08f, accent);
            CreateText("Comfort cue", titleRoot, "Acomodate · mirá a tu alrededor", new Vector3(0f, 0.88f, 3.7f), 0.065f,
                new Color(0.48f, 0.55f, 0.62f));
            CreateLine("Title divider", titleRoot,
                new[] { new Vector3(-0.3f, 1.42f, 3.69f), new Vector3(0.3f, 1.42f, 3.69f) }, 0.008f, false);

            for (int i = 0; i < 3; i++)
            {
                float radius = 2.1f + i * 2.6f;
                CreateRingPair("Floor orbit " + i, lobbyRoot.transform,
                    new Vector3(0f, -0.25f - i * 0.035f, 0f), Quaternion.identity, radius, 0.007f);
            }
            orbitRoot = new GameObject("Orbital sculpture").transform;
            orbitRoot.SetParent(lobbyRoot.transform, false);
            orbitRoot.localPosition = new Vector3(0f, 2.1f, 8.8f);
            CreateRingPair("Outer halo", orbitRoot, Vector3.zero, Quaternion.Euler(73f, 10f, 0f), 3.7f, 0.014f);
            CreateRingPair("Inner halo", orbitRoot, Vector3.zero, Quaternion.Euler(112f, -18f, 0f), 3.55f, 0.011f);
            CreateParticles();
        }

        private void CreateParticles()
        {
            var obj = new GameObject("Quiet particles");
            obj.transform.SetParent(lobbyRoot.transform, false);
            obj.transform.localPosition = new Vector3(0f, 3f, 0f);
            particles = obj.AddComponent<ParticleSystem>();
            particles.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            var main = particles.main;
            main.loop = true;
            main.duration = 40f;
            main.prewarm = true;
            main.startLifetime = new ParticleSystem.MinMaxCurve(30f, 45f);
            main.startSpeed = new ParticleSystem.MinMaxCurve(0.015f, 0.035f);
            main.startSize = new ParticleSystem.MinMaxCurve(0.014f, 0.038f);
            main.maxParticles = 750;
            main.simulationSpace = ParticleSystemSimulationSpace.Local;
            var shape = particles.shape;
            shape.shapeType = ParticleSystemShapeType.Sphere;
            shape.radius = 11f;
            shape.radiusThickness = 0.65f;
            var emission = particles.emission;
            emission.rateOverTime = 8f;
            var fade = particles.colorOverLifetime;
            fade.enabled = true;
            var gradient = new Gradient();
            gradient.SetKeys(new[] { new GradientColorKey(Color.white, 0f), new GradientColorKey(Color.white, 1f) },
                new[] { new GradientAlphaKey(0f, 0f), new GradientAlphaKey(0.65f, 0.15f),
                    new GradientAlphaKey(0.65f, 0.8f), new GradientAlphaKey(0f, 1f) });
            fade.color = gradient;
            var material = MakeMaterial("UnlitAlpha");
            particleTexture = MakeParticleTexture();
            material.mainTexture = particleTexture;
            var renderer = obj.GetComponent<ParticleSystemRenderer>();
            renderer.sharedMaterial = material;
            renderer.renderMode = ParticleSystemRenderMode.Billboard;
            renderer.shadowCastingMode = ShadowCastingMode.Off;
            renderer.receiveShadows = false;
            particles.Play();
        }

        private void BuildIdentity()
        {
            identityRoot = new GameObject("Identify this headset");
            identityRoot.transform.SetParent(HeadCamera.transform, false);
            var panel = GameObject.CreatePrimitive(PrimitiveType.Quad);
            panel.name = "Identification backdrop";
            panel.transform.SetParent(identityRoot.transform, false);
            panel.transform.localPosition = new Vector3(0f, 0f, 1.65f);
            panel.transform.localScale = new Vector3(1.8f, 0.75f, 1f);
            Destroy(panel.GetComponent<Collider>());
            var material = MakeMaterial("UnlitAlpha");
            material.color = new Color(0.01f, 0.015f, 0.025f, 0.96f);
            material.renderQueue = 3150;
            panel.GetComponent<Renderer>().sharedMaterial = material;
            identityLabel = CreateText("Headset identifier", identityRoot.transform, "", new Vector3(0f, 0f, 1.6f),
                0.09f, new Color(1f, 0.79f, 0.38f));
            var identityMaterial = new Material(textMaterial) { renderQueue = 3200 };
            ownedMaterials.Add(identityMaterial);
            identityLabel.GetComponent<Renderer>().sharedMaterial = identityMaterial;
            identityRoot.SetActive(false);
        }

        private void Update()
        {
            if (!initialized) return;
            if (identityRoot.activeSelf && Time.unscaledTime >= identifyUntil) identityRoot.SetActive(false);
            if (lobbyRoot.activeSelf)
            {
                float speed = currentPreset == "aurora" ? 0.65f : 0.35f;
                orbitRoot.localRotation = Quaternion.Euler(0f, 0f, Mathf.Sin(Time.unscaledTime * 0.055f) * 5f * speed);
            }
            FollowHeadPosition();
        }

        private void FollowHeadPosition()
        {
            if (!initialized || HeadCamera == null) return;
            // Translation must not create parallax in footage recorded at one fixed point.
            videoSphere.position = HeadCamera.transform.position;
            ambienceSphere.position = HeadCamera.transform.position;
        }

        private void FaceLobbyTowardViewer()
        {
            var pose = HeadCamera.transform;
            titleRoot.position = new Vector3(pose.position.x, transform.position.y, pose.position.z);
            titleRoot.rotation = Quaternion.Euler(0f, pose.eulerAngles.y, 0f);
        }

        private Material MakeMaterial(string name)
        {
            var shader = Resources.Load<Shader>("Otrorayo/" + name);
            if (shader == null) throw new InvalidOperationException("Missing bundled OTRORAYO shader: " + name);
            var material = new Material(shader) { name = "OTRORAYO " + name, enableInstancing = true };
            ownedMaterials.Add(material);
            return material;
        }

        private static GameObject CreateSphere(string name, Transform parent, float diameter, Material material)
        {
            var sphere = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            sphere.name = name;
            sphere.transform.SetParent(parent, false);
            sphere.transform.localScale = Vector3.one * diameter;
            Destroy(sphere.GetComponent<Collider>());
            var renderer = sphere.GetComponent<Renderer>();
            renderer.sharedMaterial = material;
            renderer.shadowCastingMode = ShadowCastingMode.Off;
            renderer.receiveShadows = false;
            renderer.lightProbeUsage = LightProbeUsage.Off;
            renderer.reflectionProbeUsage = ReflectionProbeUsage.Off;
            return sphere;
        }

        private TextMesh CreateText(string name, Transform parent, string text, Vector3 position, float size, Color color)
        {
            var obj = new GameObject(name);
            obj.transform.SetParent(parent, false);
            obj.transform.localPosition = position;
            var label = obj.AddComponent<TextMesh>();
            label.font = font;
            label.fontSize = 96;
            // TextMesh uses ten font pixels per world unit at characterSize = 1.
            // Keep the font atlas crisp while controlling physical text size in metres.
            label.characterSize = size * 10f / label.fontSize;
            label.anchor = TextAnchor.MiddleCenter;
            label.alignment = TextAlignment.Center;
            label.lineSpacing = 1.12f;
            label.richText = false;
            label.color = color;
            label.text = text;
            var renderer = obj.GetComponent<Renderer>();
            renderer.sharedMaterial = textMaterial;
            renderer.shadowCastingMode = ShadowCastingMode.Off;
            renderer.receiveShadows = false;
            return label;
        }

        private void CreateRingPair(string name, Transform parent, Vector3 center, Quaternion rotation, float radius, float width)
        {
            const int segments = 128;
            var points = new Vector3[segments];
            for (int i = 0; i < segments; i++)
            {
                float angle = i * Mathf.PI * 2f / segments;
                points[i] = center + rotation * new Vector3(Mathf.Cos(angle) * radius, 0f, Mathf.Sin(angle) * radius);
            }
            CreateLine(name, parent, points, width, true);
            CreateLine(name + " glow", parent, points, width * 7f, true, 0.07f);
        }

        private void CreateLine(string name, Transform parent, Vector3[] points, float width, bool loop, float alpha = 0.6f)
        {
            var obj = new GameObject(name);
            obj.transform.SetParent(parent, false);
            var line = obj.AddComponent<LineRenderer>();
            line.useWorldSpace = false;
            line.loop = loop;
            line.positionCount = points.Length;
            line.SetPositions(points);
            line.startWidth = line.endWidth = width;
            line.startColor = line.endColor = new Color(accent.r, accent.g, accent.b, alpha);
            line.sharedMaterial = lineMaterial;
            line.shadowCastingMode = ShadowCastingMode.Off;
            line.receiveShadows = false;
            line.numCornerVertices = 2;
            rings.Add(line);
        }

        private void RefreshFontTexture(Font updated)
        {
            if (updated != font || textMaterial == null) return;
            textMaterial.mainTexture = font.material.mainTexture;
            if (identityLabel != null) identityLabel.GetComponent<Renderer>().sharedMaterial.mainTexture = font.material.mainTexture;
        }

        private static Texture2D MakeParticleTexture()
        {
            const int size = 32;
            var texture = new Texture2D(size, size, TextureFormat.RGBA32, false) { name = "Soft particle", wrapMode = TextureWrapMode.Clamp };
            var pixels = new Color[size * size];
            for (int y = 0; y < size; y++)
            for (int x = 0; x < size; x++)
            {
                float radius = new Vector2((x + 0.5f) / size * 2f - 1f, (y + 0.5f) / size * 2f - 1f).magnitude;
                pixels[y * size + x] = new Color(1f, 1f, 1f, Mathf.Pow(Mathf.Clamp01(1f - radius), 2f));
            }
            texture.SetPixels(pixels);
            texture.Apply(false, true);
            return texture;
        }

        private static string Wrap(string source, int columns, int maxLines, string fallback)
        {
            string text = string.IsNullOrWhiteSpace(source) ? fallback : source.Trim();
            text = text.Replace('\r', ' ').Replace('\n', ' ').Replace('\t', ' ');
            var lines = new List<string>();
            while (text.Length > columns && lines.Count < maxLines - 1)
            {
                int split = text.LastIndexOf(' ', columns, columns);
                if (split < columns / 3) split = columns;
                lines.Add(text.Substring(0, split));
                text = text.Substring(split).TrimStart();
            }
            if (text.Length > columns) text = text.Substring(0, columns - 1) + "…";
            lines.Add(text);
            return string.Join("\n", lines);
        }

        private void OnDestroy()
        {
            Application.onBeforeRender -= FollowHeadPosition;
            Font.textureRebuilt -= RefreshFontTexture;
            foreach (var material in ownedMaterials) if (material != null) Destroy(material);
            if (particleTexture != null) Destroy(particleTexture);
        }
    }
}
