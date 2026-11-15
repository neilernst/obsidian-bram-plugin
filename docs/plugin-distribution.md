# Distribution readiness and publishing requirements

**Reviewed:** 2026-11-15

This report records the current GitHub-only beta release plan and Obsidian's documented Community directory requirements for a possible later submission. The beta release will not be submitted to or listed in the Obsidian Community directory.

## Current beta release scope

The planned first release is a GitHub pre-release tagged `0.1.0`, matching `manifest.json`, with `main.js`, `manifest.json`, and `styles.css` attached as release assets. The release notes are in [0.1.0-beta.md](releases/0.1.0-beta.md). The repository remains private, so only repository collaborators can access the release. Publication will happen after the release files and notes are reviewed and committed.

Pull requests targeting `main` or `master` use the official [Obsidian Workflows GitHub Action](https://github.com/obsidianmd/obsidian-workflows) for validation, linting, and build checks. The first GitHub release remains a manual, reviewed publication; the CI workflow does not publish releases.

The plugin has a recorded static security audit. Its conditional `core.fsmonitor` finding is disclosed in the README and beta notes; testers should register only repositories whose local Git configuration they trust. Address this risk before broader distribution to users who may register repositories they do not control.

## Future Community directory route

For in-app discovery, submit the plugin to the [Obsidian Community directory](https://community.obsidian.md). Once the entry is reviewed and published, users can install it from Obsidian. A public GitHub release by itself provides downloadable assets, but does not add the plugin to the in-app Community directory.

The normal route is to publish the source repository on GitHub, prepare a matching GitHub release, then submit the initial listing through the Community directory. The directory reads the manifest from the repository's default branch and installs release assets whose tag matches the manifest version. The directory scans the manifest, release assets, and source, then verifies that the built release matches the source.

## Authentication and signing

The documented publisher authentication is:

1. Sign in to the Community directory with an Obsidian account.
2. Connect a GitHub account to the community profile. Obsidian documents this connection as read-only access to the GitHub public profile, used to verify repository ownership.
3. Submit or claim the plugin entry under the account or organization that will own and maintain the listing.

For private source code, the separate Obsidian Community Directory GitHub App is installed on the private source repository to grant read access for review and build verification. The documented process does not ask for a GitHub write token for the profile connection.

**Code signing:** I found no requirement in the current Obsidian publishing documentation to cryptographically sign the plugin binaries or Git tags. The documented checks are repository-ownership verification plus automated review and build verification. Recheck the official instructions before the eventual submission in case they change.

Sources: [Set up and claim](https://docs.obsidian.md/community-directory/set-up-and-claim), [Submit your plugin](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin), and [Manage your plugin or theme](https://docs.obsidian.md/community-directory/manage-entry).

## Community directory requirements

Before the first submission:

1. Put a descriptive `README.md`, a root `LICENSE`, and `manifest.json` in the repository. The license must make the permitted use of the source clear.
2. Commit an accurate `manifest.json` on the default branch. The plugin ID must be unique in the directory and must not contain `obsidian`.
3. Set `manifest.json`'s `version` to Semantic Versioning's three-part `x.y.z` format. The GitHub release tag must exactly match it.
4. Run the production build and upload these files as binary assets on the GitHub release: `main.js`, `manifest.json`, and `styles.css` if used.
5. Sign in to the Community directory, connect GitHub, add the plugin entry, and resolve blocking review errors. The review reports results for the manifest, release assets, source code, and build verification.

After the first listing is published, a new submission is not required for every update. Increment the version, publish a matching release with the required assets, and address any automated review errors. The directory's scanner looks for build scripts in this order: `build`, `build:plugin`, then `compile`; the selected script should be the production build.

Plugin-specific requirements also include an appropriate `minAppVersion`, a short description of at most 250 characters ending in a period, and `isDesktopOnly: true` when using Node.js or Electron APIs. See [submission requirements for plugins](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins), [developer policies](https://docs.obsidian.md/community-directory/developer-policies), and the [manifest reference](https://docs.obsidian.md/Reference/Manifest).

## Source repository options

### Public source repository

Use the same public GitHub repository for source review and release assets. Connect the GitHub account that owns the repository, create matching releases, and submit that repository URL in the directory. This is the simplest setup.

### Private source with public releases

Keep the source in a private repository and create a separate public GitHub repository for releases. Submit the public releases repository as the directory entry, then install the official [Obsidian Community directory GitHub App](https://github.com/apps/obsidian-community-directory) on the private source repository and connect it through the entry settings. The directory uses the app to read private source and verifies that the public release's build output matches it. This avoids making source public while keeping installable release assets public.

## Current repository readiness

| Area | Current state | Needed before publishing |
|---|---|---|
| Repository visibility | `neilernst/obsidian-bram-plugin` is private. | Choose a public source repository or the split private-source/public-release setup. |
| Repository visibility | `neilernst/obsidian-bram-plugin` is private. | A directory listing requires a public release repository or a separate public releases repository connected to the private source. |
| License | Root `LICENSE` uses BSD-3-Clause. | Keep the license and README disclosure accurate if distribution terms change. |
| README | Describes the GitHub-only beta, installation, network use, token storage, and security boundary. | Review the listing excerpt and instructions again before any directory submission. |
| Manifest | ID `bram-project-tracker` does not contain `obsidian`; version is `0.1.0`; `isDesktopOnly` is `true`. | Reconfirm the ID is available and `minAppVersion` remains accurate before a directory submission. |
| Build | The current `npm run build` succeeds and produces a 34.9 KB production `main.js`. | Attach the production bundle to the matching GitHub release; do not commit it to the source repository. |
| Release process | The initial beta is planned as a manual GitHub pre-release; no release workflow is configured. | Keep the release tag equal to the manifest version and attach the required assets. |
| CI | `.github/workflows/ci.yml` uses the official Obsidian Workflows action on pull requests with read-only repository permissions. | Confirm the action result for a pull request before merging changes. |
| Security review | Static findings are recorded in [security-audit.md](security-audit.md); the beta README and notes disclose the conditional `core.fsmonitor` risk. | Complete the applicable remediation work before distributing to users who may register untrusted repositories. |

The repository visibility was checked through GitHub on the review date. The Community directory search returned no result for this plugin name; confirm listing status in the Community profile before submission.

## Next steps after the beta

- Gather beta feedback and address any release-blocking defects.
- Complete relevant security remediation before broadening access to users who register repositories they do not control.
- If pursuing in-app Obsidian discovery later, decide whether to make the source public or create a public releases repository, then follow the official submission and authentication process described above.

## Official sources

- [Submit your plugin](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin)
- [Set up and claim](https://docs.obsidian.md/community-directory/set-up-and-claim)
- [Manage your plugin or theme](https://docs.obsidian.md/community-directory/manage-entry)
- [Frequently asked questions](https://docs.obsidian.md/community-directory/faq)
- [Submission requirements for plugins](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins)
- [Developer policies](https://docs.obsidian.md/community-directory/developer-policies)
