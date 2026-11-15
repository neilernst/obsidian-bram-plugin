# Distribution readiness and publishing requirements

**Reviewed:** 2026-11-15

This report records Obsidian's current documented path for publishing Bram Project Tracker and the repository work still needed. It does not change repository visibility, create a release, or submit a directory entry.

## Recommended route

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

## Release requirements

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
| License | No root `LICENSE` or `COPYING` file is present. | Choose a license and add its canonical text. This is an owner decision. |
| README | Updated to describe the current plugin and link to this report. | Review the listing excerpt and usage instructions before submission. |
| Manifest | ID `bram-project-tracker` does not contain `obsidian`; version is `0.1.0`; `isDesktopOnly` is `true`. | Confirm the ID is available, choose the first release version, and verify `minAppVersion` against the plugin's actual API requirements. |
| Build | `npm run build` runs TypeScript checking and a production esbuild bundle. | Confirm this build is suitable for the directory scanner and attach its `main.js` to a release. |
| Release process | No `.github` workflow or local Git tags are present in this checkout. | Decide whether to publish releases manually or automate them; ensure each release has a matching tag and assets. |
| Security review | A static review is recorded in [security-audit.md](security-audit.md). | Review the conditional Git `core.fsmonitor` execution finding before distributing builds to users who may register untrusted repositories. |

The repository visibility was checked through GitHub on the review date. The Community directory search returned no result for this plugin name; confirm listing status in the Community profile before submission.

## Owner decisions and next steps

- Choose the plugin's license. Do not publish the source without an explicit license decision.
- Choose whether to make this source repository public or create a public releases repository and connect the private source with the official GitHub App.
- Confirm the plugin ID, minimum supported Obsidian version, and initial release version.
- Decide whether to use manual releases or add release automation.
- After those decisions, prepare a production release and submit the initial Community directory entry.

## Official sources

- [Submit your plugin](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin)
- [Set up and claim](https://docs.obsidian.md/community-directory/set-up-and-claim)
- [Manage your plugin or theme](https://docs.obsidian.md/community-directory/manage-entry)
- [Frequently asked questions](https://docs.obsidian.md/community-directory/faq)
- [Submission requirements for plugins](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins)
- [Developer policies](https://docs.obsidian.md/community-directory/developer-policies)
