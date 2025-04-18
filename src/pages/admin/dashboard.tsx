
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { MainLayout } from "../../components/layout/main-layout"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { StatusBadge } from "../../components/status-badge"
import { supabase, type TicketWithProfile } from "../../lib/supabase"
import { useAuth } from "../../lib/auth"
import { formatDistanceToNow } from "date-fns"
import { 
  AlertCircle, 
  Clock, 
  Filter, 
  Inbox, 
  Search, 
  SortAsc, 
  SortDesc, 
  User 
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu"
import { Skeleton } from "../../components/ui/skeleton"
import { toast } from "sonner"
import { Avatar, AvatarFallback } from "../../components/ui/avatar"

export default function AdminDashboardPage() {
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
      .channel('admin-tickets-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets'
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
          table: 'messages'
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
    ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (ticket.profiles?.email && ticket.profiles.email.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const getStatusCount = (status: string) => {
    return tickets.filter(ticket => ticket.status === status).length
  }

  const toggleSortDirection = () => {
    setSortDirection(prev => prev === "asc" ? "desc" : "asc")
  }

  const getInitials = (name: string | null) => {
    if (!name) return 'U'
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }

  const assignToMe = async (ticketId: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('tickets')
        .update({ assigned_to: user.id })
        .eq('id', ticketId)

      if (error) {
        throw error
      }

      toast.success('Ticket assigned to you')
    } catch (error) {
      console.error('Error assigning ticket:', error)
      toast.error('Failed to assign ticket')
    }
  }

  return (
    <MainLayout>
      <div className="container px-4 py-6 md:px-6 md:py-8">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-bold">Support Inbox</h1>
            <p className="text-muted-foreground">
              Manage and respond to customer support tickets
            </p>
          </div>
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
              placeholder="Search tickets by subject or email..."
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
                  ? "There are no support tickets in the system."
                  : "No tickets match your current filters."}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredTickets.map((ticket) => (
                <div key={ticket.id} className="p-4">
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {getInitials(ticket.profiles?.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{ticket.profiles?.full_name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{ticket.profiles?.email}</p>
                        </div>
                      </div>
                      <Link 
                        to={`/admin/tickets/${ticket.id}`}
                        className="block text-lg font-medium hover:text-primary hover:underline"
                      >
                        {ticket.subject}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {ticket.message_count} {ticket.message_count === 1 ? 'message' : 'messages'} · 
                        Updated {formatDistanceToNow(new Date(ticket.updated_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={ticket.status} />
                      {!ticket.assigned_to && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault()
                            assignToMe(ticket.id)
                          }}
                        >
                          <User className="mr-2 h-4 w-4" />
                          Assign to me
                        </Button>
                      )}
                      {ticket.assigned_to && (
                        <div className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs">
                          <span>Assigned to:</span>
                          <span className="font-medium">
                            {ticket.assigned_profile?.full_name || 'Unknown'}
                          </span>
                        </div>
                      )}
                      <Button 
                        size="sm"
                        asChild
                      >
                        <Link to={`/admin/tickets/${ticket.id}`}>
                          View
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  )
}