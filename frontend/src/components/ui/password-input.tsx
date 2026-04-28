import * as React from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<typeof Input>, "type">
>(({ className, ...props }, ref) => {
  const [visible, setVisible] = React.useState(false)

  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        className={cn("pr-9", className)}
        ref={ref}
        {...props}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute top-0 right-0 h-full w-8 px-0 hover:bg-transparent"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
      >
        {visible ? (
          <EyeOffIcon className="size-4 text-muted-foreground" />
        ) : (
          <EyeIcon className="size-4 text-muted-foreground" />
        )}
        <span className="sr-only">
          {visible ? "Hide password" : "Show password"}
        </span>
      </Button>
    </div>
  )
})

PasswordInput.displayName = "PasswordInput"

export { PasswordInput }
