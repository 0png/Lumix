import {
  AlertCircle,
  CheckCircle,
  Info,
  Loader2,
  AlertTriangle,
} from "lucide-react"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group lumix-toaster"
      position="top-right"
      expand={false}
      gap={10}
      offset={16}
      icons={{
        success: <CheckCircle className="h-4 w-4 text-emerald-500" />,
        info: <Info className="h-4 w-4 text-sky-500" />,
        warning: <AlertTriangle className="h-4 w-4 text-amber-500" />,
        error: <AlertCircle className="h-4 w-4 text-red-500" />,
        loading: <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />,
      }}
      toastOptions={{
        duration: 3800,
        classNames: {
          toast:
            "group toast lumix-toast group-[.toaster]:border group-[.toaster]:text-foreground",
          title: "group-[.toast]:text-sm group-[.toast]:font-medium group-[.toast]:tracking-normal",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-xs group-[.toast]:leading-5",
          icon: "group-[.toast]:mt-0.5",
          actionButton:
            "group-[.toast]:rounded-md group-[.toast]:bg-primary group-[.toast]:px-2.5 group-[.toast]:text-xs group-[.toast]:font-medium group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:rounded-md group-[.toast]:bg-muted group-[.toast]:px-2.5 group-[.toast]:text-xs group-[.toast]:font-medium group-[.toast]:text-muted-foreground",
          success: "lumix-toast-success",
          error: "lumix-toast-error",
          warning: "lumix-toast-warning",
          info: "lumix-toast-info",
          loading: "lumix-toast-loading",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
