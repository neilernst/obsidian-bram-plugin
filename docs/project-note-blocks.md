# Embedded Bram project details

Add an empty `bram-project` fenced code block to a registered project note to render its current Bram and repository details in place:

```bram-project
```

The plugin matches the note to the project registered with that note path. The block displays active Bram Worklist items and their statuses, the current branch, recent commits, and staged, unstaged, and untracked file counts. If the note is not registered or a data source cannot be read, the block shows an inline explanation.

The block also displays the five most recently updated open GitHub issues from the repository named by the project's local Git `origin` remote. The list starts collapsed; expand it to see each issue's number, title, labels, last-updated date, link, and a short body excerpt. Pull requests and their details are excluded. It calls GitHub's read-only REST API directly; the GitHub CLI is not required. Git must still be installed and available to Obsidian for local repository details and origin lookup.

Public repositories can be read without a token. For a private repository, enter an optional fine-grained personal access token in **Settings → Bram Project Tracker** and click **Save token**. Grant access only to the repositories you need and **Issues: read-only** permission. The token is saved in the plugin's settings data, which may be included in vault backups or sync; do not put it in a note or commit it. Clear the field and save to remove the token.

The reader supports `github.com` origin URLs. It reports when the project has no supported GitHub origin, the token is invalid or lacks access, the API rate limit is reached, or GitHub cannot be reached.

The block is read-only. It does not modify the Markdown note, the Bram Worklist, GitHub issues, or the repository. The snapshot refreshes when Obsidian renders the note again.
