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
- Home-screen installation uses manifest-only PWA metadata and static icons, without app-shell caching or service workers, so preview updates remain safe.
- The authenticated layout owns desktop navigation and a safe-area-aware mobile header/bottom navigation; both share AccountMenu to keep account actions consistent.
- Meeting state transitions that need atomicity (start_recording, finalize_recording, delete_meeting) live in SQL functions; the browser calls them via RPC so rules hold for any future client (mobile).
- All private tables carry workspace_id and are gated by RLS through is_workspace_member/meeting_visible; meetings in deleting/deleted are invisible everywhere.
- Audio chunks are persisted in IndexedDB (src/lib/local-store.ts) before upload; uploads are idempotent per (recording_id, sequence).
- Background work (transcription/analysis) is signalled through public.outbox_events, written in the same transaction as the state change; heavy media work belongs to an external worker, not server functions.
- Pure business rules live in src/lib/meeting-rules.ts with vitest tests next to them.
- The new-meeting route creates a draft once per mount and opens the recorder with auto-start; all recording entry points use it to avoid separate preparation flows.
- Processing pipeline (src/lib/processing.server.ts) runs one stage per call (transcribe → diarize → align → analyze → embed), driven by the meeting page polling AND the managed cron schedule hitting /api/public/process-queue every minute (bounded batch of 3, single-flight lease + circuit breaker in public.job_state; 402/403 pause the processor, user retry resumes it). Runs are idempotent per (recording, stage, input_version, config_version) with lease + optimistic claim. Analyze's and embed's input_version is the current canonical transcript id so corrections trigger a fresh analysis and re-embedding.
- Long recordings are split into ~24 MB chunks (src/lib/chunking-rules.ts) over the confirmed recording_parts for the OpenAI transcription; chunk texts are concatenated into one raw transcript.
- Semantic search uses google/gemini-embedding-2 (3072 dims, stored as halfvec) on transcript_segments and analysis_items; queries go through the search_segments/search_items SQL functions which re-check workspace membership.
- Canonical transcript text/timing/speakers come from pyannoteAI /diarize (precision-3, exclusive turns, transcription enabled): exclusive turns decide who speaks when and words are redistributed into them, because precision-2 turn-level output flipped speakers mid-sentence. Per-speaker voice samples (≤10 s, never crossing another speaker) are computed server-side (pickCleanSamples) and stored on speakers. /identify is a separate precision-2 job (voiceprints are precision-2) mapped by temporal overlap. Job ids/results are persisted for resumable polling; Deepgram remains fallback only without PYANNOTE_API_KEY.
- Transcript corrections never edit rows in place: they create a new canonical version and mark analyses stale. Accepted tasks are never replaced by reprocessing.
- People registry: public.people is the workspace-wide directory; participants.person_id links a meeting participant to it (person_confirmed=false means AI suggestion). The analyze stage links AI-heard names via matchPerson (src/lib/people-rules.ts, never guesses on ambiguity) or creates the person; cross-meeting voice matching: naming a speaker enrolls a pyannote voiceprint (clip cut in the browser, public.person_voiceprints); diarize uses /identify with the workspace voiceprints and align links matches (confidence >= VOICE_MATCH_MIN) as mapping_source='voice', unconfirmed.
- While recording, a parallel MediaRecorder produces standalone ~30 s windows transcribed immediately into public.live_transcript_chunks; the transcribe stage reuses them only when contiguous and covering the full duration, otherwise it re-transcribes the uploaded parts (diarize/analyze always run on the full audio after stop).
- Analyze/embed stages are gated by meetings.analysis_requested_at: transcription runs right after stop, analysis starts only once all speakers are named or the user taps "Analisar agora", so insights use the confirmed names.
- Mobile pull-to-refresh keeps touch handling in src/components/PullToRefresh.tsx and the distance/threshold math in src/lib/pull-to-refresh-rules.ts with tests; the layout only reads the --pull-offset CSS variable (html[data-pulling]) so the header and content follow the finger, and the gesture is disabled on recorder routes.
- Speaker identification cascade lives in the align stage (right after transcription): voiceprints → inferSpeakersFromConversation (src/lib/people-rules.ts, addressing+reply and self-intro votes, tested) → a small AI naming call; the owner (people.is_self) recognised by voice is auto-confirmed, AI-named voices auto-enroll a voiceprint from the browser, and analysis auto-starts when every voice is identified.
