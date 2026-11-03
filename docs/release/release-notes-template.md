# Release notes template

Copy into `CHANGELOG.md` as `## [x.y.z] - YYYY-MM-DD`. Delete empty headings.

```markdown
## [x.y.z] - YYYY-MM-DD

### For students
<!-- Plain language, what they will notice. Max 5 lines. -->
- 

### Added
- 

### Changed
- 

### Fixed
- 

### Security
- 

### Database
<!-- Migrations in this release (the workflow lists them too) and whether any
     is a "contract" step that removes something. -->
- 

### Rollback notes
<!-- Anything that makes rolling back this release unusual, e.g. "safe: all
     migrations are additive" or "after rollback, re-run X". -->
- Safe to roll back with Vercel Instant Rollback; migrations are additive.
```

**Version numbers:** bump the **patch** (1.0.1) for fixes only, the **minor** (1.1.0) for new features, the **major** (2.0.0) for changes students must adapt to (for example removing one-to-one chat when module groups launch).
