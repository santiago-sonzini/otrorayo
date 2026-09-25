using System.Collections.Generic;
using UnityEngine;
using UnityEngine.XR;

namespace Otrorayo.Quest
{
    /// <summary>Small tracked camera driver using the XR provider, without controller bindings.</summary>
    public sealed class QuestHeadPose : MonoBehaviour
    {
        private readonly List<XRInputSubsystem> subsystems = new List<XRInputSubsystem>();
        private InputDevice device;
        private float eyeHeight = 1.65f;
        private float nextOriginCheck;
        private XRInputSubsystem configuredSubsystem;

        private void OnEnable()
        {
            Application.onBeforeRender += ApplyPose;
            transform.localPosition = Vector3.up * eyeHeight;
        }

        private void OnDisable()
        {
            Application.onBeforeRender -= ApplyPose;
        }

        private void Update()
        {
            if (Time.unscaledTime >= nextOriginCheck)
            {
                nextOriginCheck = Time.unscaledTime + 1f;
                ConfigureOrigin();
            }
            ApplyPose();
        }

        private void ConfigureOrigin()
        {
            SubsystemManager.GetSubsystems(subsystems);
            foreach (var subsystem in subsystems)
            {
                if (!subsystem.running) continue;
                // Device origin gives seated audiences a comfortable, consistent lobby height.
                if (configuredSubsystem != subsystem)
                {
                    subsystem.TrySetTrackingOriginMode(TrackingOriginModeFlags.Device);
                    configuredSubsystem = subsystem;
                }
                eyeHeight = subsystem.GetTrackingOriginMode() == TrackingOriginModeFlags.Floor ? 0f : 1.65f;
                break;
            }
        }

        private void ApplyPose()
        {
            if (!device.isValid) device = InputDevices.GetDeviceAtXRNode(XRNode.CenterEye);
            if (!device.isValid) return;
            if (device.TryGetFeatureValue(CommonUsages.centerEyePosition, out Vector3 position) ||
                device.TryGetFeatureValue(CommonUsages.devicePosition, out position))
                transform.localPosition = position + Vector3.up * eyeHeight;
            if (device.TryGetFeatureValue(CommonUsages.centerEyeRotation, out Quaternion rotation) ||
                device.TryGetFeatureValue(CommonUsages.deviceRotation, out rotation))
                transform.localRotation = rotation;
        }
    }
}
