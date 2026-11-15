# Security remediation checklist

This checklist turns the findings in the [security and vault-scope audit](security-audit.md) into steps that can be handled and approved independently. Work through the items in order. Check an item after its change is committed and its acceptance criteria are met; propose each code change as its own Worklist item.

## 1. Prevent configured Git command execution

- [ ] Override external `core.fsmonitor` for the plugin's `git status` call. Keep the status result and refresh behavior intact.

**Why:** opening or refreshing the overview runs Git in every registered repository. A local `core.fsmonitor` command can execute with the Obsidian user's permissions.

**Accept when:** a fixture repository configured with an external fsmonitor command still returns status without invoking that command, and ordinary status output remains correct.

## 2. Keep Worklist reads inside the registered repository

- [ ] Reject symlinked `.bram` or `resources` state directories and symlinked `worklist.json` files, or resolve and verify the final path stays inside the registered repository. Add a reasonable input-size limit.

**Why:** the current filesystem reads follow symlinks and load the entire JSON file, so a project can cause the plugin to read a file outside its configured root or consume excessive memory.

**Accept when:** regular in-root Worklist files still load; a state directory or file pointing outside the root is rejected with a clear error; an oversized file is rejected without hiding other project data.

## 3. Avoid optional Git index writes

- [ ] Run `git status` with Git's `--no-optional-locks` behavior so refreshing project data does not write optional index cache updates.

**Why:** Git may refresh cached stat information in `.git/index` during status, even though the plugin does not stage or commit files.

**Accept when:** status output remains correct and repeated overview refreshes do not change the fixture's index metadata when no repository state changed.

## 4. Serialize project settings saves

- [ ] Queue registry writes so project edits, additions/removals, and GitHub token saves build from and persist the latest settings snapshot.

**Why:** each operation currently saves a full settings object, so overlapping saves can overwrite a concurrent change.

**Accept when:** overlapping project and token updates both persist after reload, and a failed save leaves the in-memory registry consistent with the last successful data.

## 5. Restrict GitHub issue links

- [ ] Accept only HTTPS issue URLs on `github.com`, or construct issue links from the validated repository identity and issue number.

**Why:** the issue parser currently accepts any HTTP or HTTPS host for `html_url`.

**Accept when:** valid GitHub issue links still open correctly; HTTP URLs and non-GitHub hosts are rejected or replaced with constructed GitHub URLs; issue titles and bodies remain rendered as text.

## 6. Decide how to store GitHub credentials

- [ ] Evaluate whether the plugin should keep the token in Obsidian plugin data or use a supported OS credential store. Record the decision and update the settings guidance; if changing storage, include migration and token-removal behavior.

**Why:** plugin data may be copied by vault syncs and backups, and the token is not encrypted by this plugin.

**Accept when:** the chosen storage and its sync/backup implications are documented, token permissions remain read-only and narrowly scoped, and users have clear steps to remove or revoke an exposed token.
