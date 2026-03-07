---
name: go-fiber-postgres
description: Build and update Go Fiber services with pgx/PostgreSQL, Redis, MinIO, JWT, validation, and dockerized local-dev patterns used across this workspace.
---

## Purpose
Use this skill for Go backend work in this workspace when the service follows the common Fiber + PostgreSQL stack.

## Use When
- The repo uses `gofiber/fiber`, `pgx`, Redis, MinIO, JWT, or `go-playground/validator`.
- The task touches handlers, middleware, service layers, repositories, config, or docker-compose local services.
- You need to match the house style used by `play-action-backend`, `project-zur`, `go-micro`, or related services.

## Working Method
1. Inspect module layout, env loading, and existing route or service registration before changing structure.
2. Follow the existing separation between transport, business logic, persistence, and middleware.
3. Reuse existing request validation, auth, error response, and config patterns instead of introducing new abstractions.
4. Keep SQL and pgx usage explicit, with predictable context handling and defensive error mapping.
5. Verify local-dev assumptions against Docker, migrations, and service dependencies before finalizing changes.

## Repo Conventions To Prefer
- Reuse existing env/config loaders and avoid adding new config systems.
- Keep handler code thin; move non-trivial logic into services or domain packages when the repo already does that.
- Preserve current auth and claims handling instead of inventing parallel JWT flows.
- Match existing database access style, transaction helpers, and migration tooling.
- Keep object storage and Redis integrations behind the current interfaces when present.

## Guardrails
- Do not replace Fiber or pgx stack choices unless the user explicitly asks.
- Do not introduce heavy ORMs when the repo already uses SQL or pgx directly.
- Do not change public API shapes, auth behavior, or migration history without repo evidence or explicit instruction.
