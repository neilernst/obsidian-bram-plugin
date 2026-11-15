# Security and vault-scope audit

**Review date:** 2026-11-15

**Scope:** Static review of `main.ts`, `src/`, `styles.css`, `manifest.json`, and `package.json` for note/vault writes, local file access, Git subprocesses, GitHub requests, settings storage, and rendered data. No plugin behavior was changed in this audit.

## Summary

The plugin has no direct code path that edits, creates, renames, or deletes Markdown notes. The `bram-project` processor builds temporary DOM inside its own rendered code block, and the overview opens a configured note through Obsidian's workspace API. Project settings and the optional GitHub token are persisted through Obsidian's plugin `saveData()` API; the readers use filesystem reads, Git commands, and GitHub `GET` requests.

**Vault-corruption risk from the plugin's direct note-handling code is low.** There is a conditional indirect risk: opening or refreshing the overview runs `git status` in each registered repository. Git can invoke a repository-configured `core.fsmonitor` command, which runs with Obsidian's user permissions and could write any file that user can write, including vault notes. Treat registered repositories and their local Git configuration as trusted until that command is disabled or otherwise constrained. Git status can also refresh `.git/index` metadata; that is not a Markdown-note write, but it means repository reads are not strictly zero-write.

This is a static source review, not a runtime test, dependency advisory scan, or review of the host operating system's permissions.

## Findings

### Medium, conditional: Git status can execute a configured command

[`GitReader`](../src/readers/git-reader.ts) invokes `git status` automatically when the overview loads or refreshes. It uses `execFile` with `shell: false`, which prevents shell interpolation, but Git itself honors repository configuration. In particular, Git documents `core.fsmonitor` as either its built-in monitor or a configured hook command used by operations such as `git status` ([Git configuration](https://git-scm.com/docs/git-config)). A registered repository whose local Git config points `core.fsmonitor` at an executable can therefore cause that executable to run under the Obsidian user's account.

If the registered repository's local configuration is untrusted or has been tampered with, the configured command could read or change files outside the repository, including notes in the vault. The trigger is local Git configuration; ordinary committed source files do not set `core.fsmonitor` by themselves. This is not a direct note-write path in the plugin. `shell: false` does not prevent Git from launching its configured monitor.

**Recommended mitigation:** explicitly disable external `core.fsmonitor` for the plugin's status command, and consider a user-visible trust boundary for registered repositories. Do not treat `--no-optional-locks` alone as a mitigation for configured command execution.

### Medium, configuration-dependent: GitHub token is stored in plugin data

[`ProjectRegistry`](../src/project-registry.ts) stores the token together with the project registry through `saveData()`. The settings input is masked, but masking only hides the value on screen; the plugin does not encrypt it or use an OS credential store. The settings description warns that plugin data may be included in vault syncs or backups ([`project-settings.ts`](../src/project-settings.ts)). Anyone who can read that plugin data or a backup may be able to use the token within its GitHub permissions.

The reader sends the token as a bearer header only to the fixed `https://api.github.com` endpoint and uses `GET` requests ([`gh-issue-reader.ts`](../src/readers/gh-issue-reader.ts)). The UI recommends a fine-grained token with Issues read-only access, which limits impact but does not protect the stored secret.

**Recommended mitigation:** continue recommending narrowly scoped, read-only tokens; consider OS credential storage before encouraging use in a synced vault; document how to revoke a token if a vault backup is exposed.

### Low: Worklist reads can follow symlinks outside the registered repository

[`BramWorklistReader`](../src/readers/bram-reader.ts) joins the configured repository root with `.bram/worklist.json` (or the legacy `resources/worklist.json`) and uses `stat` followed by `readFile`. Both operations follow symlinks, and the reader does not check the resolved file path against the registered root. A repository can therefore point this read at a file elsewhere on the machine.

The reader parses the file as JSON and only displays selected worklist fields; it does not send the file contents to GitHub or write them. This is a local data-disclosure and resource-use concern, not a note-corruption path.

**Recommended mitigation:** if registered repositories may be untrusted, reject symlinked state directories/files or resolve the final path and require it to remain under the configured repository root. A size limit on `worklist.json` would also bound memory use.

### Low: concurrent settings saves can overwrite a newer snapshot

Project mutations in [`ProjectRegistry`](../src/project-registry.ts) and token changes each serialize the full settings object with `saveData()`. There is no write queue or mutex. If a project edit and token save overlap, their snapshots can be written in either order, potentially losing one of the two changes in plugin settings. This does not write or corrupt Markdown notes.

**Recommended mitigation:** serialize registry writes and build each saved object from the latest in-memory state inside that queue.

### Low: Git status may write Git's index cache

The reader's `git status` call is observational with respect to tracked source files and the worktree, but Git documents that `status` refreshes cached stat information in the index and writes the updated index by default ([Git status documentation](https://git-scm.com/docs/git-status)). This can update `.git/index` metadata. It does not modify a note or commit source changes, but it makes the acceptance document's broad “Git state unchanged” wording stricter than the implementation guarantees.

**Recommended mitigation:** use Git's `--no-optional-locks` option for status if zero optional index writes are a requirement, and describe read-only behavior as “does not change worktree files or notes” unless index metadata is also checked.

### Low hardening: issue links accept any HTTP(S) host

The issue parser accepts any `http://` or `https://` value for `html_url`, then uses it as the issue link. The issue data comes from the fixed GitHub API, and the link is created with a text node, so this is not an HTML injection path. A malformed or unexpected API response could nevertheless present a link to a non-GitHub site or an insecure HTTP page.

**Recommended mitigation:** require HTTPS and `github.com`, or construct the issue URL from the validated repository and issue number.

## Other reviewed boundaries

- Project roots must be absolute or home-relative and are normalized with `resolve()` in [`types.ts`](../src/types.ts). They are intentionally outside the vault for local repositories; they are not sandboxed to a fixed directory.
- Git invocations pass argument arrays to `execFile` with `shell: false`; the Git readers have timeouts, and the main Git reader has a 10 MB output cap. The configured remote name is rejected if empty or prefixed with `-` before it is passed as a Git argument.
- GitHub repository owner and name are URL-encoded, and the API host is fixed. The API reader requests issue data only; it does not create, edit, or close issues.
- GitHub issue titles, labels, bodies, worklist text, commit subjects, and project names are inserted as DOM text. They are not rendered as HTML or Markdown. The CSS selectors are scoped to `.bram-project-overview` and `.bram-project-note-block` classes.
- `openLinkText()` navigates to the configured project note. The plugin does not call Obsidian note mutation APIs such as `Vault.modify()`, `Vault.create()`, `Vault.delete()`, or rename operations.

## Conclusion

For normal trusted project registrations, the code contains no direct mechanism for corrupting other Obsidian notes. The principal conditional risk to vault files is command execution through Git's configured `core.fsmonitor` when the overview runs `git status`; the principal direct file writes are to plugin settings. The symlinked Worklist read can expose selected local JSON fields in the UI, but it does not write notes or transmit those fields. If the plugin is intended to read repositories the user does not fully trust, disabling configured Git commands and constraining symlink reads should precede wider distribution.
