import { useEffect, useState, type ComponentProps } from "react"
import { Input } from "@/components/ui/input"

function parse(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

interface CommaSeparatedInputProps
  extends Omit<ComponentProps<typeof Input>, "value" | "onChange"> {
  value: string[]
  onChange: (value: string[]) => void
}

/**
 * Text input that edits a list of values typed comma-separated. Unlike binding
 * the input straight to `value.join(", ")`, it keeps the raw typed text in local
 * state, so a separator comma (or a trailing space) survives keystrokes instead
 * of being stripped the moment the parsed array round-trips back to the value.
 * `onChange` always receives the parsed, trimmed, non-empty entries.
 */
export function CommaSeparatedInput({
  value,
  onChange,
  ...props
}: CommaSeparatedInputProps) {
  const [text, setText] = useState(() => value.join(", "))

  // Re-seed the visible text only when `value` changes from the outside (e.g. a
  // form reset). When the change came from our own onChange, the parsed text
  // already equals `value`, so we leave the raw text untouched.
  useEffect(() => {
    setText((current) => {
      const parsed = parse(current)
      const matches =
        parsed.length === value.length &&
        parsed.every((entry, i) => entry === value[i])
      return matches ? current : value.join(", ")
    })
  }, [value])

  return (
    <Input
      {...props}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        onChange(parse(e.target.value))
      }}
    />
  )
}
