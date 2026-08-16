---
repo: architecture
path: docs/architecture/aw-app-tasks.md
source: generated
edited: false
checksum: sha256:b8d3beeac16f56d941834c3e042b7a7361dd9b012e983667bbe1f17b8d43f219
---
# Tasks (app)

- **repo**: aw-app-tasks
- **layer**: app
- **technologies**: python
- **health** (derived): planned

Owns the task tables and the cron tick; provider for contributes.tasks.

## Connections
- `db` → **postgres** — app-owned tables in the workspace schema
- `http` → **aw-workspace** — routes mounted at /api/apps/tasks

## MCP tools
_none exposed_

## Requirements
_none documented_
