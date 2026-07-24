import { MediaDeviceFailure } from "livekit-client"

export type CallDeviceKind = "microphone" | "camera"

// Map the browser's MediaDeviceKind (as reported by LiveKit's
// onMediaDeviceFailure) to the device our call controls expose. Output devices
// and unknown kinds return undefined so callers fall back to a generic message.
export function toCallDeviceKind(
  kind: MediaDeviceKind | undefined,
): CallDeviceKind | undefined {
  if (kind === "audioinput") return "microphone"
  if (kind === "videoinput") return "camera"
  return undefined
}

// Turn a device-acquisition failure into a user-facing, *actionable* message.
// The returned English string doubles as the i18n key — callers wrap it in
// t(). A blocked permission or a mic held by another app can't be forced on
// from JS, so the message tells the user how to recover instead of dead-ending
// on a generic "couldn't turn on" line (which is what left the customer stuck).
export function deviceFailureMessageKey(
  device: CallDeviceKind | undefined,
  failure: MediaDeviceFailure | undefined,
): string {
  if (device === "microphone") {
    switch (failure) {
      case MediaDeviceFailure.PermissionDenied:
        return "Microphone access is blocked. Allow it in your browser settings, then try again."
      case MediaDeviceFailure.DeviceInUse:
        return "Your microphone is in use by another app. Close it and try again."
      case MediaDeviceFailure.NotFound:
        return "No microphone was found on this device."
      default:
        return "Couldn't turn on the microphone."
    }
  }
  if (device === "camera") {
    switch (failure) {
      case MediaDeviceFailure.PermissionDenied:
        return "Camera access is blocked. Allow it in your browser settings, then try again."
      case MediaDeviceFailure.DeviceInUse:
        return "Your camera is in use by another app. Close it and try again."
      case MediaDeviceFailure.NotFound:
        return "No camera was found on this device."
      default:
        return "Couldn't turn on the camera."
    }
  }
  return "We couldn't access your microphone or camera. Check your browser permissions and try again."
}
