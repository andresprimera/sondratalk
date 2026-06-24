import { formatCallDuration } from "@/lib/format-duration"

describe("formatCallDuration", () => {
  it("formats sub-minute durations as mm:ss", () => {
    expect(formatCallDuration(0)).toBe("00:00")
    expect(formatCallDuration(5_000)).toBe("00:05")
    expect(formatCallDuration(59_000)).toBe("00:59")
  })

  it("formats minutes as mm:ss", () => {
    expect(formatCallDuration(65_000)).toBe("01:05")
    expect(formatCallDuration(600_000)).toBe("10:00")
  })

  it("widens to h:mm:ss past an hour", () => {
    expect(formatCallDuration(3_600_000)).toBe("1:00:00")
    expect(formatCallDuration(3_661_000)).toBe("1:01:01")
  })

  it("clamps negative input to zero", () => {
    expect(formatCallDuration(-5_000)).toBe("00:00")
  })

  it("floors partial seconds", () => {
    expect(formatCallDuration(1_900)).toBe("00:01")
  })
})
