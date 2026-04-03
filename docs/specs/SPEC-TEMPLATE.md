# Spec Template

Use this template when writing implementation specs for `.opencode/specs/`.

## File naming
`NNNN-brief-title.md` — N is auto-incremented number, kebab-case.

## Required sections

### 1. Goal
One concise sentence describing what the spec achieves.

### 2. Context
- Files, dependencies, affected area of the codebase.
- Relevant existing patterns or to follow.

### 3. Acceptance Criteria
Bullet list of testable, outcomes that Each item must be verifiable.
Example:
- [ ] `npx tsc --noEmit` passes
- [ ] All existing tests suites still passes
- [ ] No regressions in unrelated functionality

### 4. Implementation Plan
Ordered phases with:
- Phase N: description + target worker + scope + files

Example:
```
#### Phase 1: Research
Target: abdulhey
Scope: Read src/auth/*, understand current flow
Files: src/auth/login.ts, src/auth/session.ts

#### Phase 2: Implementation
Target: memati
Scope: Add null check in src/auth/validate.ts:42
Accept: criteria: AC-1

#### Phase 3: Verification
Target: halit
Scope: Run typecheck + tests
Accept: criteria: AC-1, AC-3
```

### 5. Risks / Edge Cases
Known risks and mitigation strategy.

## Optional sections

- **Dependencies**: External packages or versions requirements
- **Breaking changes**: Backward compatibility notes
- **Open questions**: Unresolved decisions

## Status
- [ ] `draft` — being written, read back, updated
 `review` — being reviewed
 `approved` — work can proceed
 `completed` — all acceptance criteria met
 verified
