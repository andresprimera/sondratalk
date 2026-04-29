import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface CopyableInputProps {
  value: string
  copyValue?: string
}

export function CopyableInput({ value, copyValue }: CopyableInputProps) {
  const { t } = useTranslation()

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyValue ?? value)
      toast.success(t("Copied"))
    } catch {
      toast.error(t("Failed to copy"))
    }
  }

  return (
    <div className="flex gap-2">
      <Input readOnly value={value} />
      <Button variant="outline" size="sm" onClick={handleCopy}>
        {t("Copy")}
      </Button>
    </div>
  )
}
