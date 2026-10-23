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
- Transcription uses the typed Gateway SDK with a filename matching the real audio container; completed chunk text is checkpointed on the run to avoid replaying successful chunks.
- Voice enrollment is resumable in voice_enrollments and requires a currently confirmed speaker/person association; ambiguous external submissions are never silently replayed or used to train identity.
- Meeting action feedback uses linked todos for task addition and tasks.action.completed_actions for confirmed email/calendar operations; opening external Gmail drafts never records confirmed sending.
- PWA uses manifest/icons, no app-shell caching or service workers, for safe preview updates.
- Meeting state transitions that need atomicity (start_recording, finalize_recording, delete_meeting) live in SQL functions; the browser calls them via RPC so rules hold for any future client (mobile).
- All private tables carry workspace_id and are gated by RLS through is_workspace_member/meeting_visible; meetings in deleting/deleted are invisible everywhere.
- Audio chunks are persisted in IndexedDB (src/lib/local-store.ts) before upload; uploads are idempotent per (recording_id, sequence).
- Background work (transcription/analysis) is signalled through public.outbox_events, written in the same transaction as the state change; heavy media work belongs to an external worker, not server functions.
- Pure meeting rules live in src/lib/meeting-rules.ts with tests.
- MeetingNarrative shares overview/review; topics hold heading + narrative, evidence stays structured and tasks separate for compatibility.
- Transcript corrections never edit rows in place: they create a new canonical version and mark analyses stale. Accepted tasks are never replaced by reprocessing.
- Analysis runs automatically right after transcription; naming people afterwards never re-runs it silently: the meeting page asks, and re-analysis (bump_people_version) includes summaries of earlier meetings with the same confirmed people.
- Subdirectories have their own AGENTS.md (src/lib: pipeline, voices, search, agenda; src/routes/_authenticated: layout, recorder, pull-to-refresh); read it before changing files there.
- Google Meet capture is a Chrome MV3 extension in extension/ (packaged to public/ata-meet.zip): it records in the Meet tab and uploads 30 s parts to /api/public/extension, authenticated by per-user codes stored only as SHA-256 hashes, because the web app cannot capture another site's audio.
- Extension API origin and manifest host permissions must match the live app; only explicit authentication rejection may prompt code replacement, since network failures do not invalidate saved codes.
- Meet recording controls use an automatically opened in-tab window, not a toolbar popup, because automatic toolbar popup opening is browser-restricted; minimizing must not stop capture.
- Meet departure uses call-state rules (click/keyboard/ended screen; debounce only missing controls); capture-stop frees tracks/context before final audio/uploads and cancels setup. Background persists tab/meeting/recording IDs and queues interrupted finish on closure/navigation with late audio recovery, because page teardown is unreliable. Meeting lists poll active states to reflect server expiry.
- Capture liveness is stored on recordings and expired transactionally by the existing scheduled processor before its AI lease/credit gate; device visibility alone never ends capture. Local session metadata and extension upload queues survive interruptions so received audio is retained.
- Meet continuation is explicit and scoped by normalized room URL plus owner/workspace; each continuation creates an immutable recording with a cumulative audio offset, and SQL publishes aggregate transcript/analysis versions atomically to preserve corrections and accepted tasks.
- The global assistant lives in the authenticated shell outside recorder routes; its server function reads user-visible data through authenticated RLS and isolates conversation history by removable meeting context, so switching context never silently reuses the prior meeting's conversation.
- Desktop shell uses independent rounded content/assistant surfaces with shell-colored gutters and an unframed left menu; content scrolls inside its column to preserve corners. Below md and during recording, retain full-bleed layout.
- Theme choice (system/light/dark) is owned by src/lib/theme.ts: the same value is applied by an inline pre-paint script in the root shell (so nothing flashes) and by the client hook; `<html>` carries suppressHydrationWarning because that script, not React, sets the class, and the script string must keep mirroring readChoice/isDark/applyChoice. Dark values are token overrides in `.dark` in src/styles.css — components never hardcode colors, they use the tokens.
- Meetings are private to their owner by default; sharing with the workspace (meetings.visibility) is explicit and owner-only, and admins never see others' private meetings — enforced in meeting_visible/RLS and search RPCs. Membership changes go through SQL functions that keep at least one owner; the active workspace is chosen per device (src/lib/workspaces.ts).
- MCP lives in src/lib/mcp/, one defineTool per file registered in index.ts, mounted at /mcp by mcpPlugin(); read-only tools use supabaseForUser/RLS, never admin or widened anon policies. Consent uses src/routes/[.]lovable.oauth.consent.tsx; /auth preserves validated next through password, signup and Google. Knowledge uses immutable database references and canonical analysis; browser/MCP share caller-scoped loading with transcript pagination, never public sharing or duplicated documents.
- Native apps record through /api/public/mobile, authenticated by the user's own session token and run under RLS via supabaseForToken (never admin), mirroring the web recorder RPCs; reads go straight to the database with the same session.
- Meet participant capture runs best-effort at finish: tile names map to people via matchPerson; a photo is stored only if the person has none.
