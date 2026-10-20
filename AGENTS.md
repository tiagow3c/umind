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
- Meeting state transitions that need atomicity (start_recording, finalize_recording, delete_meeting) live in SQL functions; the browser calls them via RPC so rules hold for any future client (mobile).
- All private tables carry workspace_id and are gated by RLS through is_workspace_member/meeting_visible; meetings in deleting/deleted are invisible everywhere.
- Audio chunks are persisted in IndexedDB (src/lib/local-store.ts) before upload; uploads are idempotent per (recording_id, sequence).
- Background work (transcription/analysis) is signalled through public.outbox_events, written in the same transaction as the state change; heavy media work belongs to an external worker, not server functions.
- Pure business rules live in src/lib/meeting-rules.ts with vitest tests next to them.
- Transcript corrections never edit rows in place: they create a new canonical version and mark analyses stale. Accepted tasks are never replaced by reprocessing.
- Analysis runs automatically right after transcription; naming people afterwards never re-runs it silently: the meeting page asks, and re-analysis (bump_people_version) includes summaries of earlier meetings with the same confirmed people.
- Subdirectories have their own AGENTS.md (src/lib: pipeline, voices, search, agenda; src/routes/_authenticated: layout, recorder, pull-to-refresh); read it before changing files there.
- Google Meet capture is a Chrome MV3 extension in extension/ (packaged to public/ata-meet.zip): it records in the Meet tab and uploads 30 s parts to /api/public/extension, authenticated by per-user codes stored only as SHA-256 hashes, because the web app cannot capture another site's audio.
- The global assistant lives in the authenticated shell outside recorder routes; its server function reads user-visible data through authenticated RLS and isolates conversation history by removable meeting context, so switching context never silently reuses the prior meeting's conversation.
- On desktop the rounded hairline frame (.app-frame-edge) wraps only the content right of the menu — the menu stands outside it, full height and flush to the window's left edge — so the frame never crosses the menu; it stays disabled below md so phones keep the full-bleed app look.
