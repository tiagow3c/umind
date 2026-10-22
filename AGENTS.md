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
- Meeting action feedback uses linked todos for task addition and tasks.action.completed_actions for confirmed email/calendar operations; opening external Gmail drafts never records confirmed sending.
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
- Meet recording controls use an automatically opened in-tab window, not a toolbar popup, because automatic toolbar popup opening is browser-restricted; minimizing must not stop capture.
- Meet departure detection uses shared extension call-state rules, Meet leave clicks and ended-screen observation, with a debounce for temporarily replaced controls; it operates independently of the Ata window.
- Capture liveness is stored on recordings and expired transactionally by the existing scheduled processor before its AI lease/credit gate; device visibility alone never ends capture. Local session metadata and extension upload queues survive interruptions so received audio is retained.
- Meet continuation is explicit and scoped by normalized room URL plus owner/workspace; each continuation creates an immutable recording with a cumulative audio offset, and SQL publishes aggregate transcript/analysis versions atomically to preserve corrections and accepted tasks.
- The global assistant lives in the authenticated shell outside recorder routes; its server function reads user-visible data through authenticated RLS and isolates conversation history by removable meeting context, so switching context never silently reuses the prior meeting's conversation.
- On desktop the rounded hairline frame (.app-frame-edge) wraps only the content right of the menu — the menu stands outside it, full height and flush to the window's left edge — so the frame never crosses the menu; it stays disabled below md so phones keep the full-bleed app look.
- Theme choice (system/light/dark) is owned by src/lib/theme.ts: the same value is applied by an inline pre-paint script in the root shell (so nothing flashes) and by the client hook; `<html>` carries suppressHydrationWarning because that script, not React, sets the class, and the script string must keep mirroring readChoice/isDark/applyChoice. Dark values are token overrides in `.dark` in src/styles.css — components never hardcode colors, they use the tokens.
- Meetings are private to their owner by default; sharing with the workspace (meetings.visibility) is explicit and owner-only, and admins never see others' private meetings — enforced in meeting_visible/RLS and search RPCs. Membership changes go through SQL functions that keep at least one owner; the active workspace is chosen per device (src/lib/workspaces.ts).
- The app-hosted MCP server lives in src/lib/mcp/ (one defineTool per file, registered in index.ts) and is mounted at /mcp by mcpPlugin() in vite.config.ts; tools are read-only and always query through supabaseForUser so the caller's OAuth token drives RLS — never admin clients or widened anon policies. The OAuth consent route is src/routes/[.]lovable.oauth.consent.tsx and /auth must preserve the validated `next` (oauthReturnPath) through password, signup emailRedirectTo and Google login.
