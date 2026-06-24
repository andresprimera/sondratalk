import type { ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import { CallControls, DisabledCallControls } from "@/components/call-controls"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const livekitState = vi.hoisted(() => ({
  participant: { isMicrophoneEnabled: true, isCameraEnabled: true },
}))

vi.mock("@livekit/components-react", () => ({
  TrackToggle: ({
    children,
    className,
    "aria-label": ariaLabel,
  }: {
    children: ReactNode
    className?: string
    "aria-label"?: string
  }) => (
    <button className={className} aria-label={ariaLabel}>
      {children}
    </button>
  ),
  useLocalParticipant: () => livekitState.participant,
}))

vi.mock("livekit-client", () => ({
  Track: { Source: { Microphone: "microphone", Camera: "camera" } },
}))

describe("CallControls", () => {
  it("shows on-state labels and neutral styling when mic and camera are enabled", () => {
    livekitState.participant = {
      isMicrophoneEnabled: true,
      isCameraEnabled: true,
    }

    render(<CallControls />)

    expect(screen.getByText("Mic on")).toBeTruthy()
    expect(screen.getByText("Camera on")).toBeTruthy()
    expect(screen.getByLabelText("Microphone").className).not.toContain(
      "bg-destructive",
    )
  })

  it("shows off-state labels and destructive styling when disabled", () => {
    livekitState.participant = {
      isMicrophoneEnabled: false,
      isCameraEnabled: false,
    }

    render(<CallControls />)

    expect(screen.getByText("Mic off")).toBeTruthy()
    expect(screen.getByText("Camera off")).toBeTruthy()
    expect(screen.getByLabelText("Microphone").className).toContain(
      "bg-destructive",
    )
    expect(screen.getByLabelText("Camera").className).toContain("bg-destructive")
  })

  it("reflects a mixed state (mic on, camera off) independently", () => {
    livekitState.participant = {
      isMicrophoneEnabled: true,
      isCameraEnabled: false,
    }

    render(<CallControls />)

    expect(screen.getByText("Mic on")).toBeTruthy()
    expect(screen.getByText("Camera off")).toBeTruthy()
    expect(screen.getByLabelText("Microphone").className).not.toContain(
      "bg-destructive",
    )
    expect(screen.getByLabelText("Camera").className).toContain("bg-destructive")
  })
})

describe("DisabledCallControls", () => {
  it("renders non-interactive mic and camera placeholders", () => {
    render(<DisabledCallControls />)

    const mic = screen.getByLabelText("Microphone")
    const camera = screen.getByLabelText("Camera")
    expect(mic.hasAttribute("disabled")).toBe(true)
    expect(camera.hasAttribute("disabled")).toBe(true)
  })
})
