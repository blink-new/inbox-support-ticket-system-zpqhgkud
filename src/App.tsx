
import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { ThemeProvider } from './components/theme-provider'
import LoginPage from './pages/login'
import RegisterPage from './pages/register'
import DashboardPage from './pages/dashboard'
import TicketPage from './pages/ticket'
import NewTicketPage from './pages/new-ticket'
import AdminDashboardPage from './pages/admin/dashboard'
import AdminTicketPage from './pages/admin/ticket'
import NotFoundPage from './pages/not-found'
import { supabase } from './lib/supabase'
import { toast } from 'sonner'

function App() {
  const { user, profile, isLoading } = useAuth()

  useEffect(() => {
    // Set up real-time subscriptions for notifications
    if (user) {
      // Subscribe to new messages for user's tickets
      const ticketSubscription = supabase
        .channel('ticket-updates')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: profile?.is_admin 
              ? undefined 
              : `sender_id.neq.${user.id}`,
          },
          (payload) => {
            // Show notification for new messages
            toast.info('New message received', {
              description: 'You have received a new message on one of your tickets.',
            })
          }
        )
        .subscribe()

      // Subscribe to ticket status changes
      const statusSubscription = supabase
        .channel('status-updates')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'tickets',
            filter: profile?.is_admin 
              ? undefined 
              : `created_by.eq.${user.id}`,
          },
          (payload: any) => {
            const newStatus = payload.new.status
            
            if (payload.old.status !== newStatus) {
              toast.info(`Ticket status updated`, {
                description: `A ticket has been marked as ${newStatus}.`,
              })
            }
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(ticketSubscription)
        supabase.removeChannel(statusSubscription)
      }
    }
  }, [user, profile])

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-primary"></div>
      </div>
    )
  }

  return (
    <ThemeProvider defaultTheme="light" storageKey="support-ticket-theme">
      <Routes>
        <Route 
          path="/" 
          element={
            user 
              ? (profile?.is_admin 
                  ? <Navigate to="/admin" replace /> 
                  : <Navigate to="/dashboard" replace />)
              : <Navigate to="/login" replace />
          } 
        />
        <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/" replace />} />
        <Route path="/register" element={!user ? <RegisterPage /> : <Navigate to="/" replace />} />
        
        {/* Customer routes */}
        <Route 
          path="/dashboard" 
          element={
            user && !profile?.is_admin 
              ? <DashboardPage /> 
              : <Navigate to="/" replace />
          } 
        />
        <Route 
          path="/tickets/new" 
          element={
            user && !profile?.is_admin 
              ? <NewTicketPage /> 
              : <Navigate to="/" replace />
          } 
        />
        <Route 
          path="/tickets/:id" 
          element={
            user && !profile?.is_admin 
              ? <TicketPage /> 
              : <Navigate to="/" replace />
          } 
        />
        
        {/* Admin routes */}
        <Route 
          path="/admin" 
          element={
            user && profile?.is_admin 
              ? <AdminDashboardPage /> 
              : <Navigate to="/" replace />
          } 
        />
        <Route 
          path="/admin/tickets/:id" 
          element={
            user && profile?.is_admin 
              ? <AdminTicketPage /> 
              : <Navigate to="/" replace />
          } 
        />
        
        {/* 404 route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ThemeProvider>
  )
}

export default App