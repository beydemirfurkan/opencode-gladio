---
name: rust-media-desktop
description: Build and debug Rust desktop or media apps that use Tokio, Tauri, Slint, async pipelines, and workspace-based crate organization common in this workspace.
---

## Purpose
Use this skill for Rust desktop, torrent, playback, or media-pipeline work across the workspace.

## Use When
- The repo uses Rust workspaces, Tokio, Tauri, Slint, async streaming, or media-processing crates.
- The task involves desktop UX, async orchestration, file IO, playback state, or cross-crate boundaries.
- You need to keep consistency with repos like `turp`, `rqbit`, or `ffmpeg-VideoPlayer-Rust_Slint`.

## Working Method
1. Inspect crate boundaries, feature flags, async runtime assumptions, and UI integration points first.
2. Preserve existing ownership, error propagation, and tracing patterns.
3. Keep UI state transitions explicit and resistant to background task races.
4. Prefer small, composable changes across crates instead of collapsing responsibilities into one module.
5. Verify platform-specific or media-specific behavior carefully when touching IO, playback, or concurrency.

## Repo Conventions To Prefer
- Reuse `anyhow`, `thiserror`, `tracing`, and current async primitives when already present.
- Keep background work cancelable and surface progress or failure states to the UI cleanly.
- Preserve workspace organization and crate responsibilities.
- Match existing command, event, and state-management patterns in desktop apps.

## Guardrails
- Do not replace runtime, UI toolkit, or media pipeline choices without explicit instruction.
- Do not hide concurrency risks behind broad locks or ad hoc global state.
- Do not trade correctness for terse code in playback, streaming, or filesystem flows.
