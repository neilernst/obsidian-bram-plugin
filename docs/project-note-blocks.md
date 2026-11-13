# Embedded Bram project details

Add an empty `bram-project` fenced code block to a registered project note to render its current Bram and repository details in place:

```bram-project
```

The plugin matches the note to the project registered with that note path. The block displays active Bram Worklist items and their statuses, the current branch, recent commits, and staged, unstaged, and untracked file counts. If the note is not registered or a data source cannot be read, the block shows an inline explanation.

The block also displays up to 20 open GitHub issues from the registered repository. It runs `gh issue list` from the repository root and shows each issue's number, title, labels, last-updated date, link, and a short body excerpt. Install the GitHub CLI and authenticate the account available to Obsidian with `gh auth login`; use `gh auth status` to inspect its account and authentication state. The block reports when `gh` is missing, the repository has no GitHub context, or the query fails.

The block is read-only. It does not modify the Markdown note, the Bram Worklist, GitHub issues, or the repository. The snapshot refreshes when Obsidian renders the note again.
