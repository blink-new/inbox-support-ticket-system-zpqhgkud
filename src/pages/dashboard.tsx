
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { MainLayout } from "../components/layout/main-layout"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { StatusBadge } from "../components/status-badge"
import { supabase, type TicketWithProfile } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { formatDistanceToNow } from "date-fns"
import { 
  AlertCircle, 
  Clock, 
  Filter, 
  Inbox, 
  Plus, 
  Search, 
  SortAsc, 
  SortDesc 
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu"
import { Skeleton } from "../components/ui/skeleton"
import { toast } from "sonner"

export default function DashboardPage() {
  const { user } = useAuth()
  const [tickets, setTickets] = useState<TicketWithProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")

  useEffect(() => {
    if (!user) return

    const fetchTickets = async () => {
      setIsLoading(true)
      try {
        let query = supabase
          .from('tickets')
          .select(`
            *,
            profiles:created_by(*),
            assigned_profile:assigned_to(*)
          `)
          .eq('created_by', user.id)
          .order('created_at', { ascending: sortDirection === "asc" })

        if (statusFilter) {
          query = query.eq('status', statusFilter)
        }

        const { data, error } = await query

        if (error) {
          throw error
        }

        // Get message counts for each ticket
        const ticketsWithCounts = await Promise.all(
          data.map(async (ticket) => {
            const { count } = await supabase
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .eq('ticket_id', ticket.id)

            // Get latest message
            const { data: latestMessage } = await supabase
              .from('messages')
              .select('*')
              .eq('ticket_id', ticket.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single()

            return {
              ...ticket,
              message_count: count || 0,
              latest_message: latestMessage || undefined
            }
          })
        )

        setTickets(ticketsWithCounts)
      } catch (error) {
        console.error('Error fetching tickets:', error)
        toast.error('Failed to load tickets')
      } finally {
        setIsLoading(false)
      }
    }

    fetchTickets()

    // Set up real-time subscription
    const subscription = supabase
      .channel('tickets-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: `created_by=eq.${user.id}`
        },
        () => {
          fetchTickets()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=neq.${user.id}`
        },
        () => {
          fetchTickets()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [user, statusFilter, sortDirection])

  const filteredTickets = tickets.filter(ticket => 
    ticket.subject.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getStatusCount = (status: string) => {
    return tickets.filter(ticket => ticket.status === status).length
  }

  const toggleSortDirection = () => {
    setSortDirection(prev => prev === "asc" ? "desc" : "asc")
  }

  return (
    <MainLayout showNewTicket>
      <div className="container px-4 py-6 md:px-6 md:py-8">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-bold">My Support Tickets</h1>
            <p className="text-muted-foreground">
              View and manage your support requests
            </p>
          </div>
          <Button asChild>
            <Link to="/tickets/new">
              <Plus className="mr-2 h-4 w-4" />
              New Ticket
            </Link>
          </Button>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Open</p>
                <p className="text-2xl font-bold">{getStatusCount('open')}</p>
              </div>
              <div className="rounded-full bg-blue-100 p-2 text-blue-600 dark:bg-blue-900 dark:text-blue-400">
                <Inbox className="h-5 w-5" />
              </div>
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{getStatusCount('pending')}</p>
              </div>
              <div className="rounded-full bg-amber-100 p-2 text-amber-600 dark:bg-amber-900 dark:text-amber-400">
                <Clock className="h-5 w-5" />
              </div>
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Closed</p>
                <p className="text-2xl font-bold">{getStatusCount('closed')}</p>
              </div>
              <div className="rounded-full bg-green-100 p-2 text-green-600 dark:bg-green-900 dark:text-green-400">
                <AlertCircle className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tickets..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="mr-2 h-4 w-4" />
                  Filter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => setStatusFilter(null)}>
                    All
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter('open')}>
                    Open
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter('pending')}>
                    Pending
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter('closed')}>
                    Closed
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSortDirection}
            >
              {sortDirection === "desc" ? (
                <SortDesc className="mr-2 h-4 w-4" />
              ) : (
                <SortAsc className="mr-2 h-4 w-4" />
              )}
              Sort
            </Button>
          </div>
        </div>

        <div className="rounded-lg border bg-card shadow">
          {isLoading ? (
            <div className="divide-y">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-6 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <Inbox className="h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">No tickets found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {tickets.length === 0
                  ? "You haven't created any support tickets yet."
                  : "No tickets match your current filters."}
              </p>
              {tickets.length === 0 && (
                <Button asChild className="mt-4">
                  <Link to="/tickets/new">Create your first ticket</Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {filteredTickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  to={`/tickets/${ticket.id}`}
                  className="block transition-colors hover:bg-muted/50"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h3 className="font-medium">{ticket.subject}</h3>
                        <p className="text-sm text-muted-foreground">
                          {ticket.message_count} {ticket.message_count === 1 ? 'message' : 'messages'} · 
                          Updated {formatDistanceToNow(new Date(ticket.updated_at), { addSuffix: true })}
                        </p>
                      </div>
                      <StatusBadge status={ticket.status} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  )
}