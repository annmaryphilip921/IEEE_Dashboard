# IEEE Dashboard Refactor Roadmap

## Goals
- Reduce risk by refactoring in small, reversible steps.
- Separate backend concerns (auth, authors, submissions, chat, documents, email templates).
- Remove legacy browser-only state paths and standardize on server-backed data.
- Improve maintainability, testing confidence, and deployment readiness.

## Phase Plan

### Phase 1: Baseline and Safety Net
- Add a config module for environment validation and defaults.
- Add shared API response helpers and centralized error handling.
- Add smoke test script for core endpoints: /health, /login, /authors.
- Keep behavior unchanged.

### Phase 2: Backend Decomposition (No Behavior Change)
- Split integrated-server.js into route modules:
  - auth routes
  - author routes
  - submission routes
  - chat routes
  - document routes
  - email template routes
- Move business logic into service modules.
- Keep existing endpoints and payload contracts stable.

### Phase 3: Session and Auth Hardening
- Standardize session handling for admin and author users.
- Remove duplicate/legacy auth paths from frontend scripts.
- Add consistent auth checks for protected routes.

### Phase 4: Frontend Cleanup
- Break large dashboard scripts into feature modules.
- Introduce a shared API client and shared UI utilities.
- Remove duplicated localStorage cleanup and legacy compatibility paths.

### Phase 5: Data Model and Migration Cleanup
- Align DB schema usage with actual code paths.
- Remove dead columns/legacy assumptions after migration checks.
- Add migration verification scripts.

### Phase 6: Tests and Release Hardening
- Add endpoint integration tests for critical workflows.
- Add lint/format checks and CI scripts.
- Write production runbook and rollback notes.

## Execution Rules
- Each phase must be shippable.
- No endpoint contract changes unless documented.
- Validate before and after each phase.
- Commit per phase with clear scope.

## Current Start Point
- Start with Phase 1 by extracting configuration and shared middleware.
