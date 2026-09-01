import { useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import {
  RegistrationQuestionStep,
  type RegistrationOption,
} from "@/components/onboarding/registration-question-step"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      key.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => String(opts?.[k] ?? "")),
  }),
}))

const SINGLE_OPTIONS: RegistrationOption[] = [
  { value: "a", label: "Option A", reply: "Reply A", source: "Source A" },
  { value: "b", label: "Option B", reply: "Reply B" },
]

function SingleHarness({
  onNext,
  freeText,
}: {
  onNext: () => void
  freeText?: { placeholder: string; reply: string }
}) {
  const [value, setValue] = useState<string | string[]>("")
  return (
    <RegistrationQuestionStep
      counter="Question 1 of 7"
      heading="Heading"
      subline="Subline"
      options={SINGLE_OPTIONS}
      value={value}
      onChange={setValue}
      freeText={freeText}
      onNext={onNext}
    />
  )
}

const MULTI_OPTIONS: RegistrationOption[] = [
  { value: "x", label: "X" },
  { value: "y", label: "Y" },
  { value: "z", label: "Z" },
]

function MultiHarness({ onNext }: { onNext: () => void }) {
  const [value, setValue] = useState<string | string[]>([])
  return (
    <RegistrationQuestionStep
      counter="Question 6 of 7"
      heading="Circles"
      subline="Subline"
      options={MULTI_OPTIONS}
      multi
      minSelect={2}
      value={value}
      onChange={setValue}
      multiReply="Two is enough."
      onNext={onNext}
    />
  )
}

function submitButton(): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>("button", {
    name: "Submit answer",
  })
}

function replyContainer(container: HTMLElement): Element | null {
  return container.querySelector(".onboarding-reply")
}

describe("RegistrationQuestionStep", () => {
  it("gates the submit button until an option is selected (single)", () => {
    render(<SingleHarness onNext={vi.fn()} />)
    expect(submitButton().disabled).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: "Option A" }))
    expect(submitButton().disabled).toBe(false)
  })

  it("reveals the selected option's reply, then continues", () => {
    const onNext = vi.fn()
    const { container } = render(<SingleHarness onNext={onNext} />)

    fireEvent.click(screen.getByRole("button", { name: "Option A" }))
    expect(replyContainer(container)?.getAttribute("data-visible")).toBe("false")

    fireEvent.click(submitButton())
    expect(replyContainer(container)?.getAttribute("data-visible")).toBe("true")
    expect(screen.getByText("Reply A")).toBeTruthy()
    expect(screen.getByText("Source A")).toBeTruthy()

    // Button flips to Continue; clicking it advances.
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it("resets the reveal when the selection changes", () => {
    const { container } = render(<SingleHarness onNext={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "Option A" }))
    fireEvent.click(submitButton())
    expect(replyContainer(container)?.getAttribute("data-visible")).toBe("true")

    fireEvent.click(screen.getByRole("button", { name: "Option B" }))
    expect(replyContainer(container)?.getAttribute("data-visible")).toBe("false")
    expect(screen.getByText("Reply B")).toBeTruthy()
  })

  it("accepts free text as the answer and shows its reply", () => {
    const { container } = render(
      <SingleHarness
        onNext={vi.fn()}
        freeText={{ placeholder: "Say more", reply: "Free reply" }}
      />,
    )
    fireEvent.change(screen.getByPlaceholderText("Say more"), {
      target: { value: "something else" },
    })
    expect(submitButton().disabled).toBe(false)
    fireEvent.click(submitButton())
    expect(replyContainer(container)?.getAttribute("data-visible")).toBe("true")
    expect(screen.getByText("Free reply")).toBeTruthy()
  })

  it("requires minSelect picks before submitting (multi)", () => {
    render(<MultiHarness onNext={vi.fn()} />)
    expect(submitButton().disabled).toBe(true)

    fireEvent.click(screen.getByRole("button", { name: "X" }))
    expect(submitButton().disabled).toBe(true)

    fireEvent.click(screen.getByRole("button", { name: "Y" }))
    expect(submitButton().disabled).toBe(false)
  })

  it("shows the fixed multi reply on submit", () => {
    const { container } = render(<MultiHarness onNext={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "X" }))
    fireEvent.click(screen.getByRole("button", { name: "Y" }))
    fireEvent.click(submitButton())
    expect(replyContainer(container)?.getAttribute("data-visible")).toBe("true")
    expect(screen.getByText("Two is enough.")).toBeTruthy()
  })
})
