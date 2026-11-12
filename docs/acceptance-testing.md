# Acceptance testing

Run this walkthrough after implementation steps 2–4 in [the project plan](project-tracker-plan.md). It checks the MVP in Obsidian with a disposable vault and controlled repository fixtures.

## Set up a safe test environment

1. Create or use the disposable development vault described in the project plan. Do not use your main vault.
2. Build the plugin and link it into the vault at `.obsidian/plugins/bram-project-tracker`, following the setup in the repository README. Enable it in Obsidian's Community plugins settings.
3. Register the Bram and Solitaire projects using their configured repository paths and vault-resident project notes.
4. Keep both original repositories read-only. For repeatable cases, use a temporary copy or fixture. In particular, create controlled worklist and Git states in a separate fixture instead of adding demo entries to the original Solitaire checkout.
5. Record the Obsidian version, operating system, plugin revision, and the fixture paths used.

For a predictable test fixture, prepare these states in a temporary repository:

- An empty `items` array in `.bram/worklist.json`.
- A populated worklist with at least one `proposed` item and one `applied` item, including IDs and declared files.
- A Git branch with a known `HEAD` and a few recent commits.
- At least one staged change, one unstaged change, and one untracked file. Include a staged deletion to check that a large dirty tree is still shown as repository activity, not completed progress.
- Separate variants with a missing worklist, malformed JSON or invalid worklist shape, and a path that is not a Git repository.

The current Bram state folder is `.bram/`. If the implementation retains the planned legacy `resources/` fallback, use a separate fixture to check that it is used only when `.bram/` is absent.

## Walk through the plugin

### Project registration and notes

- Add the Bram and Solitaire entries with a display name, repository root, and project note path.
- Close and reopen Obsidian. Confirm the entries remain registered.
- Open each project note from the overview. Confirm Obsidian opens the configured Markdown note and its existing wikilinks or citation-plugin syntax remains ordinary note content.

**Pass when:** both project entries persist and each note link opens the intended vault note.

### Worklist data

- Open the overview with the empty-worklist fixture. Confirm it shows no active items and does not invent completed items or a completion percentage.
- Switch to the populated fixture. Confirm each active item's ID, title, status, and declared files are represented, and that `proposed` and `applied` remain distinct.
- Restore the empty fixture and refresh. Confirm the old active items disappear.

**Pass when:** the overview reflects the current active worklist and presents it as active work, not a fixed backlog.

### Git activity

- Compare the displayed branch, commit, and recent commit list with read-only Git output:

  ```sh
  git -C "/path/to/fixture" status --porcelain=v1 -b
  git -C "/path/to/fixture" log -5 --oneline
  ```

- Confirm staged, unstaged, and untracked counts match the fixture. Expand any file details and check that the staged deletion is visible as dirty repository state.
- Refresh after changing only the temporary fixture. Confirm its displayed snapshot updates.

**Pass when:** the branch, commit history, and three working-tree counts match Git, including staged deletions, without implying that repository activity is project completion.

### Refresh and error states

- Open the overview and confirm it refreshes on open. Use the manual refresh action and confirm the last-refreshed time updates.
- Point one fixture entry at a missing or unreadable path. Confirm it shows a readable error and the other registered project remains available.
- Test a non-Git directory or Git command failure. Confirm the repository error is visible rather than shown as an empty clean repository.
- Test a missing worklist, malformed JSON, and invalid worklist shape. Confirm each is reported as unavailable or invalid data, rather than as an empty worklist.
- If a project note path is missing, confirm the link failure is understandable and does not prevent the rest of the overview from rendering.

**Pass when:** each failed input has a readable state, the last successful refresh is clear when available, and one project's failure does not hide another project's data.

### Read-only behavior

Before refreshing a fixture, record its `git status --porcelain=v1 -b` output and the contents of its `worklist.json`. Refresh and navigate the overview, then compare both records again.

**Pass when:** the plugin does not edit the worklist, stage files, commit changes, or otherwise change repository state. Run this check on temporary fixtures so other work in the original repositories cannot obscure the result.

## Record the result

Mark each check **pass**, **fail**, or **blocked**, and include the fixture path and relevant error text for any failure. Acceptance passes when every applicable check passes, failures are shown as readable states, and the read-only check finds no repository or worklist changes. Clean up the temporary vault and fixtures after recording the result.
