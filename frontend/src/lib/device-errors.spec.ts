import { MediaDeviceFailure } from "livekit-client"
import { deviceFailureMessageKey, toCallDeviceKind } from "@/lib/device-errors"

describe("toCallDeviceKind", () => {
  it("maps audioinput to microphone", () => {
    expect(toCallDeviceKind("audioinput")).toBe("microphone")
  })

  it("maps videoinput to camera", () => {
    expect(toCallDeviceKind("videoinput")).toBe("camera")
  })

  it("returns undefined for output/unknown kinds", () => {
    expect(toCallDeviceKind("audiooutput")).toBeUndefined()
    expect(toCallDeviceKind(undefined)).toBeUndefined()
  })
})

describe("deviceFailureMessageKey", () => {
  it("gives actionable, device-specific guidance for a blocked microphone", () => {
    expect(
      deviceFailureMessageKey("microphone", MediaDeviceFailure.PermissionDenied),
    ).toBe(
      "Microphone access is blocked. Allow it in your browser settings, then try again.",
    )
  })

  it("gives actionable guidance for a microphone held by another app", () => {
    expect(
      deviceFailureMessageKey("microphone", MediaDeviceFailure.DeviceInUse),
    ).toBe("Your microphone is in use by another app. Close it and try again.")
  })

  it("reports a missing microphone", () => {
    expect(
      deviceFailureMessageKey("microphone", MediaDeviceFailure.NotFound),
    ).toBe("No microphone was found on this device.")
  })

  it("falls back to the generic microphone message for Other/unknown failures", () => {
    expect(
      deviceFailureMessageKey("microphone", MediaDeviceFailure.Other),
    ).toBe("Couldn't turn on the microphone.")
    expect(deviceFailureMessageKey("microphone", undefined)).toBe(
      "Couldn't turn on the microphone.",
    )
  })

  it("gives camera-specific guidance for a blocked camera", () => {
    expect(
      deviceFailureMessageKey("camera", MediaDeviceFailure.PermissionDenied),
    ).toBe(
      "Camera access is blocked. Allow it in your browser settings, then try again.",
    )
  })

  it("falls back to a combined message when the device is unknown", () => {
    expect(deviceFailureMessageKey(undefined, undefined)).toBe(
      "We couldn't access your microphone or camera. Check your browser permissions and try again.",
    )
  })
})
