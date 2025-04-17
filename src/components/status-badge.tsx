
import { Badge } from "./ui/badge"
import { cn } from "../lib/utils"

type TicketStatus = 'open' | 'closed' | 'pending'

interface StatusBadgeProps {
  status: TicketStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const getStatusStyles = () => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900'
      case 'closed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900'
      case 'pending':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900'
      default:
        return ''
    }
  }

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "capitalize font-medium border-0", 
        getStatusStyles(),
        className
      )}
    >
      {status}
    </Badge>
  )
}