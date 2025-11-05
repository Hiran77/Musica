-- Create detection_history table
CREATE TABLE IF NOT EXISTS public.detection_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  song_title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  cover_url TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confidence NUMERIC(5,2),
  metadata JSONB
);

-- Enable RLS on detection_history
ALTER TABLE public.detection_history ENABLE ROW LEVEL SECURITY;

-- Detection history policies
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'detection_history' 
    AND policyname = 'Users can view own detection history'
  ) THEN
    CREATE POLICY "Users can view own detection history"
      ON public.detection_history FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'detection_history' 
    AND policyname = 'Users can insert own detection history'
  ) THEN
    CREATE POLICY "Users can insert own detection history"
      ON public.detection_history FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'detection_history' 
    AND policyname = 'Users can delete own detection history'
  ) THEN
    CREATE POLICY "Users can delete own detection history"
      ON public.detection_history FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Create user_stats table for aggregated statistics
CREATE TABLE IF NOT EXISTS public.user_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_detections INTEGER DEFAULT 0,
  unique_songs INTEGER DEFAULT 0,
  unique_artists INTEGER DEFAULT 0,
  favorite_artist TEXT,
  favorite_genre TEXT,
  last_detection_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on user_stats
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

-- User stats policies
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_stats' 
    AND policyname = 'Users can view own stats'
  ) THEN
    CREATE POLICY "Users can view own stats"
      ON public.user_stats FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_stats' 
    AND policyname = 'Users can update own stats'
  ) THEN
    CREATE POLICY "Users can update own stats"
      ON public.user_stats FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_stats' 
    AND policyname = 'Users can insert own stats'
  ) THEN
    CREATE POLICY "Users can insert own stats"
      ON public.user_stats FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;