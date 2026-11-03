# 0001 Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-10-29

## Context
Tyro is built by one developer. Decisions made in chats, commits or memory get lost, and later changes undo them by accident.

## Decision
Write a short record in `docs/adr/` for every decision that is hard to reverse or that someone would reasonably question: technology choices, data model shape, security model, conventions that differ from the defaults. Use Context, Decision, Consequences. Link the ADR from the pull request that implements it.

## Consequences
A few minutes per decision. New contributors (or future you) can read why things are the way they are before changing them.
