# OpenAdeia — Release Strategy

## Versioning

We follow [Semantic Versioning](https://semver.org/):

```
MAJOR.MINOR.PATCH
```

- **MAJOR**: Breaking changes, major features, architecture changes
- **MINOR**: New features, backward-compatible
- **PATCH**: Bug fixes, security patches

## Release Cadence

| Type | Frequency | Branch |
|------|-----------|--------|
| **Major** | As needed (major milestones) | `main` → tag |
| **Minor** | Monthly or feature-complete | `main` → tag |
| **Patch** | As needed (critical fixes) | `main` → tag |

## Release Process

### 1. Pre-release Checklist
- [ ] All tests pass (`npm test` in backend and frontend)
- [ ] E2E tests pass
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json files
- [ ] No pending critical issues

### 2. Create Release

```bash
# Update version in package.json files
cd backend && npm version <major|minor|patch>
cd ../frontend && npm version <major|minor|patch>

# Update CHANGELOG.md with release notes

# Commit version bump
git add .
git commit -m "chore: release vX.Y.Z"

# Tag the release
git tag -a vX.Y.Z -m "Release vX.Y.Z"

# Push with tags
git push origin main --tags

# Create GitHub release
gh release create vX.Y.Z --generate-notes
```

### 3. Post-release
- [ ] Verify Docker images published to ghcr.io
- [ ] Verify production deployment
- [ ] Announce release (if public)

## Changelog Format

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- New features

### Changed
- Changes to existing features

### Fixed
- Bug fixes

### Security
- Security patches

### Deprecated
- Features to be removed

### Removed
- Removed features
```

## Branch Strategy

```
main ──────●────●────●────●──── (production)
           │    │    │    │
           v1.0 v1.1 v1.2 v2.0  (tags)
```

- **main**: Production-ready code
- **Tags**: Immutable release points
- **No long-lived feature branches**: Use short-lived branches if needed, merge to main quickly

## Docker Image Tags

| Tag | Description |
|-----|-------------|
| `latest` | Latest main branch build |
| `vX.Y.Z` | Specific release version |
| `vX.Y` | Latest patch of minor version |
| `vX` | Latest minor of major version |

## Hotfix Process

For critical production issues:

1. Fix on main branch
2. Run full test suite
3. Bump patch version
4. Tag and release
5. Deploy immediately

## Release History

| Version | Date | Highlights |
|---------|------|------------|
| v2.0.0 | 2026-03-29 | SaaS transformation, multi-tenancy, billing, admin panel |
| v1.2.2 | 2026-03-27 | Fee calculator ΠΔ 696/74, error monitoring |
| v1.2.1 | 2026-03-26 | Client portal improvements |
| v1.2.0 | 2026-03-25 | Client portal, PDF generation |
| v1.1.0 | 2026-03-24 | TEE integration improvements |
| v1.0.0 | 2026-03-20 | Initial release |
