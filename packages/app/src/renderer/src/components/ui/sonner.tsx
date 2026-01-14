import {
  CheckCircle,
  Info,
  Loader2,
  XCircle,
  AlertTriangle,
} from "lucide-react"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      icons={{
        success: <CheckCircle className="h-4 w-4 text-green-500" />,
        info: <Info className="h-4 w-4 text-blue-500" />,
        warning: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
        error: <XCircle className="h-4 w-4 text-red-500" />,
        loading: <Loader2 className="h-4 w-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background/95 group-[.toaster]:backdrop-blur-sm group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-xs",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "group-[.toaster]:bg-green-500/10 group-[.toaster]:border-green-500/20",
          error: "group-[.toaster]:bg-red-500/10 group-[.toaster]:border-red-500/20",
          warning: "group-[.toaster]:bg-yellow-500/10 group-[.toaster]:border-yellow-500/20",
          info: "group-[.toaster]:bg-blue-500/10 group-[.toaster]:border-blue-500/20",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
