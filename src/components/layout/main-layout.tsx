
import { Link, useNavigate } from "react-router-dom"
import { Button } from "../ui/button"
import { useAuth } from "../../lib/auth"
import { ModeToggle } from "../mode-toggle"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "../ui/dropdown-menu"
import { Avatar, AvatarFallback } from "../ui/avatar"
import { LogOut, Menu, Plus } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "../ui/sheet"
import { useState } from "react"

interface MainLayoutProps {
  children: React.ReactNode
  showNewTicket?: boolean
}

export function MainLayout({ children, showNewTicket = false }: MainLayoutProps) {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  
  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
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

  const isAdmin = profile?.is_admin

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[240px] sm:w-[300px]">
                <nav className="flex flex-col gap-4 py-4">
                  {isAdmin ? (
                    <Link 
                      to="/admin" 
                      className="text-lg font-medium transition-colors hover:text-primary"
                      onClick={() => setOpen(false)}
                    >
                      Dashboard
                    </Link>
                  ) : (
                    <>
                      <Link 
                        to="/dashboard" 
                        className="text-lg font-medium transition-colors hover:text-primary"
                        onClick={() => setOpen(false)}
                      >
                        Dashboard
                      </Link>
                      <Link 
                        to="/tickets/new" 
                        className="text-lg font-medium transition-colors hover:text-primary"
                        onClick={() => setOpen(false)}
                      >
                        New Ticket
                      </Link>
                    </>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
            <Link to="/" className="flex items-center gap-2">
              <span className="text-xl font-bold">Support Inbox</span>
            </Link>
            <nav className="hidden md:flex md:gap-4">
              {isAdmin ? (
                <Link 
                  to="/admin" 
                  className="text-sm font-medium transition-colors hover:text-primary"
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link 
                    to="/dashboard" 
                    className="text-sm font-medium transition-colors hover:text-primary"
                  >
                    Dashboard
                  </Link>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {showNewTicket && !isAdmin && (
              <Button asChild size="sm" className="hidden md:flex">
                <Link to="/tickets/new">
                  <Plus className="mr-2 h-4 w-4" />
                  New Ticket
                </Link>
              </Button>
            )}
            <ModeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{getInitials(profile?.full_name)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  {profile?.full_name || profile?.email}
                  <p className="text-xs text-muted-foreground">
                    {isAdmin ? 'Admin' : 'Customer'}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t py-4">
        <div className="container flex flex-col items-center justify-between gap-4 px-4 md:flex-row md:px-6">
          <p className="text-center text-sm text-muted-foreground md:text-left">
            &copy; {new Date().getFullYear()} Support Inbox. All rights reserved.
          </p>
          <p className="text-center text-sm text-muted-foreground md:text-right">
            Built with ❤️ by Blink
          </p>
        </div>
      </footer>
    </div>
  )
}