
import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

export type Ticket = {
  id: string;
  subject: string;
  status: 'open' | 'closed' | 'pending';
  created_by: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  ticket_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
};

export type TicketWithProfile = Ticket & {
  profiles: Profile;
  assigned_profile: Profile | null;
  message_count: number;
  latest_message?: Message;
};