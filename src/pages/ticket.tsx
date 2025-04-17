
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { MainLayout } from "../components/layout/main-layout"
import { Button } from "../components/ui/button"
import { Textarea } from "../components/ui/textarea"
import { StatusBadge } from "../components/status-badge"
import { supabase, type Ticket, type Message, type Profile } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { format } from "date-fns"
import { Avatar, AvatarFallback } from "../components/ui/avatar"
import { ArrowLeft, Send } from "lucide-react"
import { Skeleton } from "../components/ui/skeleton"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert"

export default function TicketPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<(Message & { sender: Profile })[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    if (!id || !user) return

    const fetchTicket = async () => {
      setIsLoading(true)
      try {
        const { data: ticketData, error: ticketError } = await supabase
          .from('tickets')
          .select('*')
          .eq('id', id)
          .eq('created_by', user.id)
          .single()

        if (ticketError) {
          throw ticketError
        }

        setTicket(ticketData)

        const { data: messagesData, error: messagesError } = await supabase
          .from('messages')
          .select(`
            *,
            sender:sender_id(*)
          `)
          .eq('ticket_id', id)
          .order('created_at', { ascending: true })

        if (messagesError) {
          throw messagesError
        }

        setMessages(messagesData)
      } catch (error) {
        console.error('Error fetching ticket:', error)
        toast.error('Failed to load ticket')
        navigate('/dashboard')
      } finally {
        setIsLoading(false)
      }
    }

    fetchTicket()

    // Set up real-time subscription
    const subscription = supabase
      .channel(`ticket-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tickets',
          filter: `id=eq.${id}`
        },
        (payload: any) => {
          setTicket(payload.new)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `ticket_id=eq.${id}`
        },
        async (payload: any) => {
          // Fetch the complete message with sender info
          const { data } = await supabase
            .from('messages')
            .select(`
              *,
              sender:sender_id(*)
            `)
            .eq('id', payload.new.id)
            .single()

          if (data) {
            setMessages(prev => [...prev, data])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [id, user, navigate])

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user || !ticket) return

    setIsSending(true)
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          ticket_id: id!,
          sender_id: user.id,
          content: newMessage.trim(),
        })

      if (error) {
        throw error
      }

      setNewMessage("")
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Failed to send message')
    } finally {
      setIsSending(false)
    }
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

  const isTicketClosed = ticket?.status === 'closed'

  return (
    <MainLayout>
      <div className="container flex flex-col px-4 py-6 md:px-6 md:py-8">
        <Button
          variant="ghost"
          className="mb-4 w-fit"
          onClick={() => navigate('/dashboard')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to tickets
        </Button>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/4" />
            <div className="mt-8 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-20 w-full rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : ticket ? (
          <>
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">{ticket.subject}</h1>
                <StatusBadge status={ticket.status} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Created on {format(new Date(ticket.created_at), 'PPP')}
              </p>
            </div>

            {isTicketClosed && (
              <Alert className="mb-6">
                <AlertTitle>This ticket is closed</AlertTitle>
                <AlertDescription>
                  This support ticket has been resolved and marked as closed. If you need further assistance, please create a new ticket.
                </AlertDescription>
              </Alert>
            )}

            <div className="mb-6 flex-1 space-y-6">
              {messages.length === 0 ? (
                <div className="rounded-lg border bg-muted/30 p-6 text-center">
                  <p className="text-muted-foreground">No messages yet. Start the conversation by sending a message below.</p>
                </div>
              ) : (
                messages.map((message) => {
                  const isCurrentUser = message.sender_id === user?.id
                  return (
                    <div
                      key={message.id}
                      className={`flex gap-4 ${isCurrentUser ? 'justify-end' : ''}`}
                    >
                      {!isCurrentUser && (
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>
                            {getInitials(message.sender.full_name)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className={`max-w-[80%] space-y-1 ${isCurrentUser ? 'text-right' : ''}`}>
                        <div className="flex items-center gap-2">
                          {isCurrentUser ? (
                            <>
                              <span className="text-sm font-medium">You</span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(message.created_at), 'PPp')}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="text-sm font-medium">
                                {message.sender.full_name || 'Support Agent'}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(message.created_at), 'PPp')}
                              </span>
                            </>
                          )}
                        </div>
                        <div
                          className={`rounded-lg p-3 ${
                            isCurrentUser
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        </div>
                      </div>
                      {isCurrentUser && (
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>
                            {getInitials(message.sender.full_name)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            <div className="mt-auto">
              <div className="flex gap-2">
                <Textarea
                  placeholder={isTicketClosed ? "This ticket is closed" : "Type your message here..."}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  disabled={isSending || isTicketClosed}
                  className="min-h-[100px] flex-1 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || isSending || isTicketClosed}
                  className="self-end"
                >
                  {isSending ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span className="ml-2 hidden md:inline">Send</span>
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Press Ctrl+Enter to send
              </p>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <h2 className="text-xl font-semibold">Ticket not found</h2>
            <p className="mt-2 text-muted-foreground">
              The ticket you're looking for doesn't exist or you don't have permission to view it.
            </p>
            <Button
              className="mt-4"
              onClick={() => navigate('/dashboard')}
            >
              Return to dashboard
            </Button>
          </div>
        )}
      </div>
    </MainLayout>
  )
}