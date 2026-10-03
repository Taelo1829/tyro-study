import { cn } from "@/lib/utils"

/** A user's profile picture, or their first initial when they haven't added one */
export function UserAvatar({
  name,
  image,
  className,
}: {
  name?: string | null
  image?: string | null
  className?: string
}) {
  const initial = (name?.trim() || "?").charAt(0).toUpperCase()
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-primary-foreground",
        className
      )}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- blob URLs, sized by CSS
        <img src={image} alt="" className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </span>
  )
}
