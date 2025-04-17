
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { MainLayout } from "../components/layout/main-layout"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Textarea } from "../components/ui/textarea"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../components/ui/form"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"

const formSchema = z.object({
  subject: z.string().min(5, { message: "Subject must be at least 5 characters" }).max(100, { message: "Subject must be less than 100 characters" }),
  message: z.string().min(10, { message: "Message must be at least 10 characters" }),
})

type FormValues = z.infer<typeof formSchema>

export default function NewTicketPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      subject: "",
      message: "",
    },
  })

  const onSubmit = async (values: FormValues) => {
    if (!user) return

    setIsSubmitting(true)
    try {
      // Create the ticket
      const { data: ticketData, error: ticketError } = await supabase
        .from('tickets')
        .insert({
          subject: values.subject,
          created_by: user.id,
        })
        .select()
        .single()

      if (ticketError) {
        throw ticketError
      }

      // Add the initial message
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          ticket_id: ticketData.id,
          sender_id: user.id,
          content: values.message,
        })

      if (messageError) {
        throw messageError
      }

      toast.success('Ticket created successfully')
      navigate(`/tickets/${ticketData.id}`)
    } catch (error) {
      console.error('Error creating ticket:', error)
      toast.error('Failed to create ticket')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <MainLayout>
      <div className="container px-4 py-6 md:px-6 md:py-8">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => navigate('/dashboard')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to tickets
        </Button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold">Create New Support Ticket</h1>
          <p className="text-muted-foreground">
            Describe your issue and we'll get back to you as soon as possible
          </p>
        </div>

        <div className="mx-auto max-w-2xl">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Brief description of your issue" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Provide details about your issue..." 
                        className="min-h-[200px]" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Ticket'}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </MainLayout>
  )
}