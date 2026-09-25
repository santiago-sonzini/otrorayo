using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEditor.XR.Management;
using UnityEditor.XR.Management.Metadata;
using UnityEditor.XR.OpenXR.Features;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.XR.Management;
using UnityEngine.XR.OpenXR;
using UnityEngine.XR.OpenXR.Features.Interactions;
using UnityEngine.XR.OpenXR.Features.MetaQuestSupport;

namespace Otrorayo.Quest.Editor
{
    public static class QuestBuild
    {
        const string ScenePath = "Assets/OTRORAYO/Scenes/Quest.unity";

        [MenuItem("OTRORAYO/1. Configurar proyecto Quest")]
        public static void Configure()
        {
            PlayerSettings.companyName = "OTRORAYO";
            PlayerSettings.productName = "OTRORAYO VR";
            PlayerSettings.bundleVersion = "0.3.2";
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android, "com.otrorayo.quest");
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
            PlayerSettings.SetApiCompatibilityLevel(NamedBuildTarget.Android, ApiCompatibilityLevel.NET_Standard);
            PlayerSettings.SetManagedStrippingLevel(NamedBuildTarget.Android, ManagedStrippingLevel.Minimal);
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel32;
            PlayerSettings.Android.targetSdkVersion = AndroidSdkVersions.AndroidApiLevelAuto;
            PlayerSettings.Android.bundleVersionCode = 5;
            PlayerSettings.Android.applicationEntry = AndroidApplicationEntry.GameActivity;
            PlayerSettings.Android.forceInternetPermission = true;
            PlayerSettings.insecureHttpOption = InsecureHttpOption.AlwaysAllowed;
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.LandscapeLeft;
            PlayerSettings.colorSpace = ColorSpace.Linear;
            PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.Android, false);
            PlayerSettings.SetGraphicsAPIs(BuildTarget.Android, new[] { GraphicsDeviceType.OpenGLES3 });
            PlayerSettings.runInBackground = true;
            QualitySettings.vSyncCount = 0;
            QualitySettings.antiAliasing = 4;
            EditorUserBuildSettings.buildAppBundle = false;

            // OpenXR requires the Input System backend, including when consuming XR.InputDevices.
            var settingsObject = new SerializedObject(Resources.FindObjectsOfTypeAll<PlayerSettings>().First());
            var inputHandler = settingsObject.FindProperty("activeInputHandler");
            if (inputHandler == null) throw new BuildFailedException("No se encontró Active Input Handling");
            inputHandler.intValue = 1;
            settingsObject.ApplyModifiedPropertiesWithoutUndo();

            Directory.CreateDirectory("Assets/OTRORAYO/XR");
            if (!EditorBuildSettings.TryGetConfigObject<XRGeneralSettingsPerBuildTarget>(XRGeneralSettings.k_SettingsKey, out var perTarget))
            {
                perTarget = ScriptableObject.CreateInstance<XRGeneralSettingsPerBuildTarget>();
                AssetDatabase.CreateAsset(perTarget, "Assets/OTRORAYO/XR/XRGeneralSettings.asset");
                EditorBuildSettings.AddConfigObject(XRGeneralSettings.k_SettingsKey, perTarget, true);
            }
            if (!perTarget.HasManagerSettingsForBuildTarget(BuildTargetGroup.Android))
                perTarget.CreateDefaultManagerSettingsForBuildTarget(BuildTargetGroup.Android);
            var general = perTarget.SettingsForBuildTarget(BuildTargetGroup.Android);
            general.InitManagerOnStart = true;
            if (!XRPackageMetadataStore.AssignLoader(general.AssignedSettings, "UnityEngine.XR.OpenXR.OpenXRLoader", BuildTargetGroup.Android))
                throw new BuildFailedException("No se pudo habilitar OpenXR");
            // RefreshFeatures creates OpenXR's settings asset through the package's public API.
            // OpenXRPackageSettings itself is internal in OpenXR 1.16.1.
            FeatureHelpers.RefreshFeatures(BuildTargetGroup.Android);
            var xr = OpenXRSettings.GetSettingsForBuildTargetGroup(BuildTargetGroup.Android);
            if (xr == null) throw new BuildFailedException("No se pudieron crear los ajustes de OpenXR");
            xr.renderMode = OpenXRSettings.RenderMode.SinglePassInstanced;
            var quest = xr.GetFeature<MetaQuestFeature>();
            if (quest == null) throw new BuildFailedException("El paquete OpenXR no incluyó Meta Quest Support");
            quest.enabled = true;
            quest.ForceRemoveInternetPermission = false;
            var touch = xr.GetFeature<OculusTouchControllerProfile>();
            if (touch == null) throw new BuildFailedException("El paquete OpenXR no incluyó Oculus Touch");
            touch.enabled = true;
            // Keep the GLES decoder path; do not enable Vulkan-only symmetric projection.
            var serializedQuest = new SerializedObject(quest);
            var symmetric = serializedQuest.FindProperty("m_symmetricProjection");
            if (symmetric != null) symmetric.boolValue = false;
            var bufferDiscards = serializedQuest.FindProperty("m_optimizeBufferDiscards");
            if (bufferDiscards != null) bufferDiscards.boolValue = false;
            var foveation = serializedQuest.FindProperty("m_foveatedRenderingApi");
            if (foveation != null) foveation.intValue = (int)OpenXRSettings.BackendFovationApi.Legacy;
            serializedQuest.ApplyModifiedPropertiesWithoutUndo();
            EditorUtility.SetDirty(perTarget); EditorUtility.SetDirty(general);
            EditorUtility.SetDirty(general.AssignedSettings); EditorUtility.SetDirty(xr); EditorUtility.SetDirty(quest);
            EditorUtility.SetDirty(touch);

            if (!File.Exists(ScenePath))
            {
                Directory.CreateDirectory(Path.GetDirectoryName(ScenePath));
                var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
                // RuntimeInitializeOnLoad creates the entire scene without hand-wired references.
                EditorSceneManager.SaveScene(scene, ScenePath);
            }
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
            AssetDatabase.SaveAssets(); AssetDatabase.Refresh();
            Debug.Log("OTRORAYO: configuración Quest guardada. Reabrí Unity si solicita reiniciar Input System.");
        }

        [MenuItem("OTRORAYO/2. Generar APK")]
        public static void Build()
        {
            if (EditorUserBuildSettings.activeBuildTarget != BuildTarget.Android)
                throw new BuildFailedException("Seleccioná Android en Build Profiles, o usá el script quest.mjs build");
            if (!File.Exists(ScenePath)) throw new BuildFailedException("Ejecutá Configurar proyecto Quest primero");
            var xr = OpenXRSettings.GetSettingsForBuildTargetGroup(BuildTargetGroup.Android);
            if (xr == null || xr.GetFeature<MetaQuestFeature>()?.enabled != true)
                throw new BuildFailedException("Meta Quest Support no está habilitado");
            string output = Path.GetFullPath("Builds/OTRORAYO-Quest.apk");
            Directory.CreateDirectory(Path.GetDirectoryName(output));
            var result = BuildPipeline.BuildPlayer(new BuildPlayerOptions
            {
                scenes = new[] { ScenePath }, locationPathName = output,
                target = BuildTarget.Android, options = BuildOptions.None
            });
            if (result.summary.result != BuildResult.Succeeded)
                throw new BuildFailedException("No se generó el APK: " + result.summary.result);
            Debug.Log("OTRORAYO APK: " + output);
        }

        [MenuItem("OTRORAYO/3. Abrir escena de vista previa")]
        public static void OpenPreview()
        {
            if (!File.Exists(ScenePath)) Configure();
            EditorSceneManager.OpenScene(ScenePath);
        }
    }
}
