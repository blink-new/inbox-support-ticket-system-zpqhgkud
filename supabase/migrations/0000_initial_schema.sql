
-- Create profiles table for users (if not exists)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Create tickets table
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'pending')),
  created_by UUID REFERENCES profiles(id) NOT NULL,
  assigned_to UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Create messages table for ticket conversations
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES profiles(id) NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Create RLS policies (only if tables exist and don't have policies yet)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can view their own profile'
  ) THEN
    CREATE POLICY "Users can view their own profile" 
      ON profiles FOR SELECT 
      USING (auth.uid() = id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update their own profile'
  ) THEN
    CREATE POLICY "Users can update their own profile" 
      ON profiles FOR UPDATE 
      USING (auth.uid() = id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Admins can view all profiles'
  ) THEN
    CREATE POLICY "Admins can view all profiles" 
      ON profiles FOR SELECT 
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND is_admin = TRUE
        )
      );
  END IF;
END
$$;

-- Tickets policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tickets' AND policyname = 'Users can view their own tickets'
  ) THEN
    CREATE POLICY "Users can view their own tickets" 
      ON tickets FOR SELECT 
      USING (created_by = auth.uid());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tickets' AND policyname = 'Users can create tickets'
  ) THEN
    CREATE POLICY "Users can create tickets" 
      ON tickets FOR INSERT 
      WITH CHECK (created_by = auth.uid());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tickets' AND policyname = 'Users can update their own tickets'
  ) THEN
    CREATE POLICY "Users can update their own tickets" 
      ON tickets FOR UPDATE 
      USING (created_by = auth.uid());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tickets' AND policyname = 'Admins can view all tickets'
  ) THEN
    CREATE POLICY "Admins can view all tickets" 
      ON tickets FOR SELECT 
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND is_admin = TRUE
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tickets' AND policyname = 'Admins can update all tickets'
  ) THEN
    CREATE POLICY "Admins can update all tickets" 
      ON tickets FOR UPDATE 
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND is_admin = TRUE
        )
      );
  END IF;
END
$$;

-- Messages policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Users can view messages for their tickets'
  ) THEN
    CREATE POLICY "Users can view messages for their tickets" 
      ON messages FOR SELECT 
      USING (
        EXISTS (
          SELECT 1 FROM tickets
          WHERE tickets.id = messages.ticket_id AND tickets.created_by = auth.uid()
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Users can create messages for their tickets'
  ) THEN
    CREATE POLICY "Users can create messages for their tickets" 
      ON messages FOR INSERT 
      WITH CHECK (
        sender_id = auth.uid() AND
        EXISTS (
          SELECT 1 FROM tickets
          WHERE tickets.id = messages.ticket_id AND tickets.created_by = auth.uid()
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Admins can view all messages'
  ) THEN
    CREATE POLICY "Admins can view all messages" 
      ON messages FOR SELECT 
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND is_admin = TRUE
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Admins can create messages for any ticket'
  ) THEN
    CREATE POLICY "Admins can create messages for any ticket" 
      ON messages FOR INSERT 
      WITH CHECK (
        sender_id = auth.uid() AND
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND is_admin = TRUE
        )
      );
  END IF;
END
$$;

-- Create functions and triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_tickets_updated_at'
  ) THEN
    CREATE TRIGGER update_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
  END IF;
END
$$;

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, is_admin)
  VALUES (
    NEW.id, 
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    FALSE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION handle_new_user();
  END IF;
END
$$;

-- Create indexes for performance (if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tickets_created_by'
  ) THEN
    CREATE INDEX idx_tickets_created_by ON tickets(created_by);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tickets_assigned_to'
  ) THEN
    CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_messages_ticket_id'
  ) THEN
    CREATE INDEX idx_messages_ticket_id ON messages(ticket_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_messages_sender_id'
  ) THEN
    CREATE INDEX idx_messages_sender_id ON messages(sender_id);
  END IF;
END
$$;