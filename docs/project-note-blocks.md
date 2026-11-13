# Embedded Bram project details

Add an empty `bram-project` fenced code block to a registered project note to render its current Bram and repository details in place:

```bram-project
```

The plugin matches the note to the project registered with that note path. The block displays active Bram Worklist items and their statuses, the current branch, recent commits, and staged, unstaged, and untracked file counts. If the note is not registered or either data source cannot be read, the block shows an inline explanation.

The block is read-only. It does not modify the Markdown note, the Bram Worklist, or the repository. The snapshot refreshes when Obsidian renders the note again.
