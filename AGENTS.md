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
- Transcript corrections never edit rows in place: they create a new canonical version and mark analyses stale. Accepted tasks are never replaced by reprocessing.
- While recording, a parallel MediaRecorder produces standalone ~30 s windows transcribed immediately into public.live_transcript_chunks; the transcribe stage reuses them only when contiguous and covering the full duration, otherwise it re-transcribes the uploaded parts (diarize/analyze always run on the full audio after stop).
- Analyze/embed stages are gated by meetings.analysis_requested_at: transcription runs right after stop, analysis starts only once all speakers are named or the user taps "Analisar agora", so insights use the confirmed names.
- Mobile pull-to-refresh keeps touch handling in src/components/PullToRefresh.tsx and the distance/threshold math in src/lib/pull-to-refresh-rules.ts with tests; the layout only reads the --pull-offset CSS variable (html[data-pulling]) so the header and content follow the finger, and the gesture is disabled on recorder routes.

- Subdirectories have their own AGENTS.md (src/lib/AGENTS.md: pipeline, voices, search, agenda); read it before changing files there.
