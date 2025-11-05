-- Fix search_path for the update_updated_at_column function
DROP FUNCTION IF EXISTS public.update_updated_at_column CASCADE;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER update_audio_splits_updated_at
BEFORE UPDATE ON public.audio_splits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();