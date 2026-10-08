# Contributing to OpenChamber Task Board

Thank you for your interest in improving the OpenChamber Task Board. We welcome contributions that improve usability, performance, accessibility, and reliability.

---

## Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Workflows-Accelerator/openchamber-github-task-board.git
   cd openchamber-github-task-board
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Verify the test suite and type check:**
   ```bash
   npm run typecheck
   npm test
   ```

4. **Build the client bundle:**
   ```bash
   npm run build
   ```

---

## Contribution Workflow

We follow a standard Fork & Pull Request workflow:

1. **Fork the Repository:** Create your own fork on GitHub.
2. **Create a Feature Branch:**
   ```bash
   git checkout -b feat/your-feature-name
   # or for defect fixes:
   git checkout -b fix/issue-description
   ```
3. **Develop with Micro-Checkpoints:**
   - Keep changes tightly scoped to the specific problem.
   - Run tests frequently to ensure existing functionality remains green.
4. **Build & Verify:**
   - Always run `npm run build` after modifying TypeScript files in `panel/`.
   - Run `npm run typecheck && npm test` to confirm all assertions and parity checks pass.
5. **Commit Using Conventional Commits:**
   ```bash
   git commit -m "feat(drawer): add smooth resize transition"
   ```
6. **Push and Open a Pull Request:**
   - Push your branch to your fork.
   - Open a PR against the `main` branch of `Workflows-Accelerator/openchamber-github-task-board`.

---

## Commit Message Conventions

We adhere strictly to [Conventional Commits](https://www.conventionalcommits.org/):

- `feat(...)`: A new feature or user-facing capability
- `fix(...)`: A bug fix or defect correction
- `refactor(...)`: Code restructuring without behavioral changes
- `test(...)`: Adding or updating automated tests
- `docs(...)`: Documentation, README, or guideline updates
- `perf(...)`: Performance and resource optimizations
- `chore(...)`: Dependency updates, tooling, or build configuration

**Examples:**
```
feat(views): add 3-way segmented layout switcher
fix(graph): prevent circular dependency crashes
refactor(panel): extract git remote parsing helpers into git.ts
test(layout): add regression tests for drawer push behavior
```

---

## Engineering Standards

### 1. Zero-Emoji Policy
All AI prompt templates, system instructions, and agent communication briefs must contain **zero emojis**. Emojis degrade instruction clarity and consume unnecessary token budget. Automated tests enforce this constraint.

### 2. Shipped Code Parity
The core algorithms reside in `panel/core.ts` (tested by unit tests) and are bundled into `panel/main.js` (loaded by the iframe webview). Whenever modifying core parsers or graph generators:
- Update `panel/core.ts`.
- Rebuild via `npm run build`.
- Run `npm test` to ensure `test/shipped-parity.test.js` passes.

### 3. Responsive UI & Accessibility
- Components must gracefully adapt to both wide full-screen layouts ($\ge 768\text{px}$) and narrow sidebar viewports ($< 768\text{px}$).
- All interactive buttons must have explicit `title` and `aria-label` attributes.
- Keyboard navigation (e.g. `Escape` to close drawers/modals, `Tab` focusability) is required for all modal and drawer interfaces.

### 4. Doubt-Driven Verification
- Never claim a fix works without running the verification command and checking the exit code.
- Write a regression test for any bug fix or layout enhancement to ensure it cannot regress silently.

---

## Releasing & Version Bumping

OpenChamber enables users to update installed extensions directly inside the application whenever a new version is published. In-app update detection is driven by the `version` field in `package.json`.

When preparing a release:
1. **Bump `version` in `package.json`** following [Semantic Versioning](https://semver.org/):
   - **Patch (`1.0.1`)**: Backwards-compatible bug fixes and small tweaks.
   - **Minor (`1.1.0`)**: New features, substantial performance optimizations, or UI additions.
   - **Major (`2.0.0`)**: Breaking contract changes or architectural shifts.
2. **Rebuild & test**: Run `npm run build && npm run typecheck && npm test`.
3. **Commit & push**: Commit the version bump (e.g. `chore(release): bump version to 1.1.0`) and push to the repository.
4. OpenChamber will automatically surface the update in the extensions manager for all users.

---

## Pull Request Checklist

Before submitting your PR, confirm the following:

- [ ] `npm run typecheck` passes with zero TypeScript diagnostic errors.
- [ ] `npm test` passes all tests (including parity and regression suites).
- [ ] `npm run build` was executed, and `panel/main.js` reflects the latest `panel/*.ts` changes.
- [ ] Commit messages follow the Conventional Commits specification.
- [ ] `package.json` version is bumped if this change should trigger an in-app extension update.
- [ ] No extraneous files, commented-out debug code, or secrets are included in the diff.

Thank you for helping build an exceptional developer experience for OpenChamber!
