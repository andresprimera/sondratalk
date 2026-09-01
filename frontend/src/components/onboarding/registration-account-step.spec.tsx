import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { RegistrationAccountStep } from "@/components/onboarding/registration-account-step"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      key.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => String(opts?.[k] ?? "")),
  }),
}))

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}))

function fill(placeholder: string, value: string) {
  fireEvent.change(screen.getByPlaceholderText(placeholder), {
    target: { value },
  })
}

describe("RegistrationAccountStep", () => {
  it("submits name, email and password when valid", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<RegistrationAccountStep onSubmit={onSubmit} onBack={vi.fn()} />)

    fill("Your name", "Ada Lovelace")
    fill("Email address", "ada@example.com")
    fill("Choose a password", "password123")
    fireEvent.click(screen.getByRole("button", { name: "Enter Sondra" }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        name: "Ada Lovelace",
        email: "ada@example.com",
        password: "password123",
      }),
    )
  })

  it("blocks submission and shows an error when a field is invalid", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<RegistrationAccountStep onSubmit={onSubmit} onBack={vi.fn()} />)

    // Valid email + password, but no name.
    fill("Email address", "ada@example.com")
    fill("Choose a password", "password123")
    fireEvent.click(screen.getByRole("button", { name: "Enter Sondra" }))

    expect(await screen.findByText("Name is required")).toBeTruthy()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("rejects a password shorter than 8 characters", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<RegistrationAccountStep onSubmit={onSubmit} onBack={vi.fn()} />)

    fill("Your name", "Ada")
    fill("Email address", "ada@example.com")
    fill("Choose a password", "short")
    fireEvent.click(screen.getByRole("button", { name: "Enter Sondra" }))

    expect(
      await screen.findByText("Password must be at least 8 characters"),
    ).toBeTruthy()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("calls onBack when the back button is pressed", () => {
    const onBack = vi.fn()
    render(<RegistrationAccountStep onSubmit={vi.fn()} onBack={onBack} />)
    fireEvent.click(screen.getByRole("button", { name: "Back" }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
