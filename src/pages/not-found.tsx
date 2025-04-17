
import { Link } from "react-router-dom"
import { Button } from "../components/ui/button"

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <h1 className="text-6xl font-bold">404</h1>
      <p className="mt-4 text-xl">Page not found</p>
      <p className="mt-2 text-muted-foreground">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Button asChild className="mt-6">
        <Link to="/">Go back home</Link>
      </Button>
    </div>
  )
}