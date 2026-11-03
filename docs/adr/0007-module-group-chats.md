# 0007 Module group chats replace one-to-one chat

- **Status:** Accepted (to build in milestone M4)
- **Date:** 2026-10-29

## Context
One-to-one chat needs friend requests first, exposes an all-users directory (including high school learners to adults), and uses a global Pusher presence channel capped at 100 members.

## Decision
Each module gets one group chat; membership **is** module enrolment. Messages in `group_messages` (soft delete for moderation), per-member read state and notification setting in `group_member_state`, reports, blocks and timed mutes for moderation. Real time on one private Pusher channel per group, authorised by enrolment; "online" counts come from `users.lastSeen`, not presence channels. Ship moderation in the same release. Retire friend requests and one-to-one chat afterwards.

Details: `business/02-requirements.md` (FR-63 to FR-6B) and `business/04-technical-architecture.md` §4.4.

## Consequences
Students find help without knowing anyone; high school and university users stay apart because subjects are per level. More messages flow through Pusher (check plan limits), and admins take on moderation.
