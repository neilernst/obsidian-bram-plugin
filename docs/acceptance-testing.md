# Acceptance testing

Use this walkthrough after implementation steps 2–4 in [the project plan](project-tracker-plan.md). It checks the overview, project settings, note block, Worklist and Git readers, and the read-only GitHub issue reader in Obsidian.

## Prepare an isolated environment

1. Use a disposable Obsidian vault, not your main vault. Keep the test vault and all repository fixtures separate from real project checkouts.
2. Build the plugin as described in the repository README, link it into the vault at `.obsidian/plugins/bram-project-tracker`, then enable **Bram Project Tracker** in **Settings → Community plugins**.
3. Record the Obsidian version, operating system, plugin revision, and `gh --version`. The plugin launches `gh` by name, so confirm `gh` is available to the Obsidian process, not only to an interactive shell.
4. Register two fixture projects with vault-resident notes. Add an empty `bram-project` fenced block to one note:

   ````markdown
   ```bram-project
   ```
   ````

5. Keep GitHub checks read-only. Use a repository where you are authorized to view issues. Do not create, edit, close, or comment on issues for this test.

For reproducible Worklist and Git cases, create a temporary local Git repository and give it a `.bram/worklist.json`. Do not add demonstration data to a real repository. Prepare these variants:

- An empty `items` array.
- At least one `proposed` and one `applied` item, each with an ID and declared file or files. Include titles when checking title display.
- A known branch and several commits, plus staged, unstaged, and untracked files. Include a staged deletion.
- A missing `.bram/worklist.json`, malformed JSON, an object without an `items` array, and a path that is not a Git repository.
- If checking legacy support, a separate repository with `resources/worklist.json` and no `.bram/` directory.

Use a GitHub repository with no open issues to check the empty state if one is available. For the error cases, use a local Git repository without a GitHub remote, an isolated `gh` configuration with no authenticated account, and an isolated Obsidian launch environment where `gh` is not on `PATH`. Do not remove or invalidate a real GitHub credential or change the machine-wide `PATH` to create these cases. If an isolated case cannot be created safely, mark it blocked.

## Project overview and settings

- Enable the plugin and open **Project overview**. Confirm it refreshes on open and shows both registered projects.
- Use manual refresh and confirm the refresh time updates.
- Add a fixture project in the plugin settings, close and reopen Obsidian, and confirm the registration persists. Remove that project and confirm the removal persists after another restart.
- Open each project note from the overview. Confirm the correct vault note opens and existing Markdown, wikilinks, and citation syntax remain intact.
- Point one entry at a missing path. Confirm that project shows a readable error while the other project remains visible.

**Pass when:** overview refresh, project registration, persistence, removal, and note navigation all match the settings and configured paths.

## Worklist and Git data

- Compare the overview and the `bram-project` note block with the fixture's `.bram/worklist.json`. For empty and populated cases, check item IDs, titles, statuses, and declared files. Confirm `proposed` and `applied` remain distinct and an empty list does not imply completed work or a completion percentage.
- Change only the temporary worklist fixture and refresh or render the note again. Confirm the old snapshot is replaced by the new one.
- Compare the displayed branch and recent commits with:

  ```sh
  git -C "/path/to/fixture" status --porcelain=v1 -b --untracked-files=all
  git -C "/path/to/fixture" log -5 --format='%h%x09%s'
  ```

- Compare staged, unstaged, and untracked counts. Confirm a staged deletion is still shown as repository activity, not completed work.
- Compare the overview and note block for the same project. Confirm the block resolves the intended project and reflects the same Worklist and Git snapshot.
- Try the missing, malformed, invalid-shape, and non-Git variants. Confirm each produces a readable error and does not hide other projects.

**Pass when:** the displayed values match the fixture sources, refresh replaces stale values, and failed inputs are reported rather than presented as empty or clean data.

## GitHub issues via `gh`

Run the same read-only query from the registered GitHub repository root:

```sh
gh issue list --state open --limit 20 --json number,title,state,labels,updatedAt,url,body
```

- Compare the rendered list with the command output: issue number and title, labels, update date, link, and the beginning of the body excerpt. The block shows up to 20 open issues; compare the same first 20 returned by the CLI.
- Use a repository with no open issues to check the empty state. Confirm it says there are no open GitHub issues.
- In isolated environments, check missing `gh`, missing authentication, and a repository with no GitHub context. Confirm each case shows a readable error and that the remaining project sections still render.
- If the CLI fails for a different reason, record the exact non-secret error text. Do not copy credentials, tokens, or issue bodies into the results file.

**Pass when:** issue content matches the CLI response, the empty state is clear, and each unavailable case is identified without disrupting Worklist or Git data.

## Read-only behavior

Before opening or refreshing the overview and note block, save the fixture's `git status --porcelain=v1 -b` output and `.bram/worklist.json` contents. Also verify the note text and GitHub issue state. Repeat those checks afterwards.

**Pass when:** rendering and refreshing do not change notes, Worklist data, repository files or Git state, or GitHub issues. Settings changes made for the test are confined to the disposable vault.

## Record results

Record each case as **pass**, **fail**, or **blocked** in [acceptance results](acceptance-results.md). Include versions, fixture identifiers, expected and actual values, and concise error text. A blocked environment check is not a pass. Acceptance passes only when every applicable case passes and the read-only checks find no changes. Remove the disposable vault and temporary fixtures after preserving the results.
