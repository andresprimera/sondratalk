import { useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { CommaSeparatedInput } from "@/components/comma-separated-input"

function getInput(): HTMLInputElement {
  return screen.getByRole<HTMLInputElement>("textbox")
}

describe("CommaSeparatedInput", () => {
  it("renders the values joined by commas", () => {
    render(<CommaSeparatedInput value={["GSD", "Alsatian"]} onChange={() => {}} />)
    expect(getInput().value).toBe("GSD, Alsatian")
  })

  it("keeps a typed separator comma instead of stripping it", () => {
    const onChange = vi.fn()
    render(<CommaSeparatedInput value={[]} onChange={onChange} />)
    const input = getInput()
    fireEvent.change(input, { target: { value: "GSD," } })
    expect(input.value).toBe("GSD,")
    expect(onChange).toHaveBeenLastCalledWith(["GSD"])
  })

  it("preserves a trailing space after the separator while typing the next entry", () => {
    const onChange = vi.fn()
    render(<CommaSeparatedInput value={[]} onChange={onChange} />)
    const input = getInput()
    fireEvent.change(input, { target: { value: "GSD, " } })
    expect(input.value).toBe("GSD, ")
    expect(onChange).toHaveBeenLastCalledWith(["GSD"])
  })

  it("emits the trimmed, non-empty parsed entries", () => {
    const onChange = vi.fn()
    render(<CommaSeparatedInput value={[]} onChange={onChange} />)
    fireEvent.change(getInput(), { target: { value: " GSD ,  Alsatian , " } })
    expect(onChange).toHaveBeenLastCalledWith(["GSD", "Alsatian"])
  })

  it("re-seeds the visible text when the value changes from outside", () => {
    function Harness() {
      const [value, setValue] = useState<string[]>(["GSD"])
      return (
        <>
          <CommaSeparatedInput value={value} onChange={setValue} />
          <button type="button" onClick={() => setValue(["Goldie"])}>
            reset
          </button>
        </>
      )
    }
    render(<Harness />)
    expect(getInput().value).toBe("GSD")
    fireEvent.click(screen.getByText("reset"))
    expect(getInput().value).toBe("Goldie")
  })
})
