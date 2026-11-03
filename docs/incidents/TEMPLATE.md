# Incident review: <short name>

*Copy to `docs/incidents/YYYY-MM-DD-short-name.md`. Blameless: describe what the system allowed, not who slipped. Keep personal data out; refer to students by count, not name.*

| | |
|---|---|
| Severity | SEV1 / SEV2 / SEV3 |
| Started | YYYY-MM-DD HH:MM SAST |
| Detected | HH:MM, by: uptime monitor / monitor issue #__ / daily email / student report |
| Mitigated | HH:MM (how: rollback / kill switch / provider recovered) |
| Resolved | HH:MM |
| Duration students were affected | __ min |
| Students affected | about __ (how estimated) |
| Release / commit involved | vX.Y.Z / `abc1234` / none |
| Incident issue | #__ |

## What students experienced

## Timeline (SAST)

| Time | What happened / what we did |
|---|---|
| | |

## Cause

What broke, and why the safeguards (tests, staging, release checks, monitoring) didn't stop it.

## What went well

## What made it worse or slower

## Actions

| Action | Type (prevent / detect / mitigate) | Backlog id | Due |
|---|---|---|---|
| | | | |

## Data and POPIA

Was personal information exposed, lost or changed? ☐ No ☐ Yes → regulator and student notification done on ____ (docs/runbooks/incident-response.md §6).
