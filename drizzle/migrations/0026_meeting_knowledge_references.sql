ALTER TABLE public.meetings ADD COLUMN knowledge_ref text DEFAULT ('ATA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)));
UPDATE public.meetings SET knowledge_ref = 'ATA-' || upper(substr(replace(id::text, '-', ''), 1, 12));
CREATE UNIQUE INDEX meetings_knowledge_ref_unique ON public.meetings (knowledge_ref);
ALTER TABLE public.meetings ADD CONSTRAINT meetings_knowledge_ref_format CHECK (knowledge_ref ~ '^ATA-[0-9A-F]{12}$');
CREATE FUNCTION public.protect_meeting_knowledge_ref() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.knowledge_ref := 'ATA-' || upper(substr(replace(NEW.id::text, '-', ''), 1, 12));
  ELSIF NEW.knowledge_ref IS DISTINCT FROM OLD.knowledge_ref THEN
    RAISE EXCEPTION 'meeting_reference_immutable';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_meeting_knowledge_ref() FROM PUBLIC;
CREATE TRIGGER protect_meeting_knowledge_ref BEFORE INSERT OR UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.protect_meeting_knowledge_ref();
COMMENT ON COLUMN public.meetings.knowledge_ref IS 'Stable private knowledge reference; never grants access and always requires meeting RLS.';