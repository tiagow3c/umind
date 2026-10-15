<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Meeting state transitions that need atomicity (start_recording, finalize_recording, delete_meeting) live in SQL functions; the browser calls them via RPC so rules hold for any future client (mobile).
- All private tables carry workspace_id and are gated by RLS through is_workspace_member/meeting_visible; meetings in deleting/deleted are invisible everywhere.
- Audio chunks are persisted in IndexedDB (src/lib/local-store.ts) before upload; uploads are idempotent per (recording_id, sequence).
- Background work (transcription/analysis) is signalled through public.outbox_events, written in the same transaction as the state change; heavy media work belongs to an external worker, not server functions.
- Pure business rules live in src/lib/meeting-rules.ts with vitest tests next to them.
- Processing pipeline (src/lib/processing.server.ts) runs one stage per call (transcribe → diarize → align → analyze → embed), driven by the meeting page polling AND the managed cron schedule hitting /api/public/process-queue every minute (bounded batch of 3, single-flight lease + circuit breaker in public.job_state; 402/403 pause the processor, user retry resumes it). Runs are idempotent per (recording, stage, input_version, config_version) with lease + optimistic claim. Analyze's and embed's input_version is the current canonical transcript id so corrections trigger a fresh analysis and re-embedding.
- Long recordings are split into ~24 MB chunks (src/lib/chunking-rules.ts) over the confirmed recording_parts for the OpenAI transcription; chunk texts are concatenated into one raw transcript.
- Semantic search uses google/gemini-embedding-2 (3072 dims, stored as halfvec) on transcript_segments and analysis_items; queries go through the search_segments/search_items SQL functions which re-check workspace membership.
- Canonical transcript timing/speakers come from pyannoteAI (src/lib/pyannote.server.ts; Deepgram only as fallback when no PYANNOTE_API_KEY). The diarize stage is resumable: the external job id is stored on the run and polled (code "pending" doesn't spend attempts). Turns without text get speakers by time overlap over the OpenAI sentences.
- Transcript corrections never edit rows in place: they create a new canonical version and mark analyses stale. Accepted tasks are never replaced by reprocessing.
- People registry: public.people is the workspace-wide directory; participants.person_id links a meeting participant to it (person_confirmed=false means AI suggestion). The analyze stage links AI-heard names via matchPerson (src/lib/people-rules.ts, never guesses on ambiguity) or creates the person; cross-meeting voice matching: naming a speaker enrolls a pyannote voiceprint (clip cut in the browser, public.person_voiceprints); diarize uses /identify with the workspace voiceprints and align links matches (confidence >= VOICE_MATCH_MIN) as mapping_source='voice', unconfirmed.
- While recording, a parallel MediaRecorder produces standalone ~30 s windows transcribed immediately into public.live_transcript_chunks; the transcribe stage reuses them only when contiguous and covering the full duration, otherwise it re-transcribes the uploaded parts (diarize/analyze always run on the full audio after stop).
