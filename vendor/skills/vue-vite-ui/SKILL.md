---
name: vue-vite-ui
description: Implement Vue 3 + Vite interfaces with Pinia, Vue Router, i18n, UnoCSS or Tailwind, and admin-style UX patterns common in this workspace.
---

## Purpose
Use this skill for frontend work in the Vue projects across this workspace.

## Use When
- The repo uses Vue 3, Vite, Pinia, Vue Router, VueUse, Vuelidate, UnoCSS, or Tailwind.
- The task involves app screens, dashboard flows, forms, navigation, localization, or reusable UI patterns.
- You need to preserve the established architecture used by `dating-frontend`, `project-zur-panel-front`, or `turp-frontend`.

## Working Method
1. Inspect route structure, store layout, composables, and styling system before making UI changes.
2. Extend existing components and utilities before creating one-off patterns.
3. Preserve form behavior, validation, loading states, and localization hooks already present in the repo.
4. Keep responsive behavior intentional on desktop and mobile; avoid flattening hierarchy when layouts collapse.
5. Validate copy length, wrapping, and action-group behavior for multilingual interfaces.

## Repo Conventions To Prefer
- Reuse existing Pinia stores, route guards, and composables.
- Match the active utility styling system instead of mixing new CSS approaches.
- Prefer semantic page sections, strong spacing rhythm, and predictable interaction states.
- Respect existing icon, notification, modal, and table patterns when available.
- Keep async UI states explicit: idle, loading, success, error, empty.

## Guardrails
- Do not introduce a new design system when the repo already has one.
- Do not bypass localization for new user-facing strings.
- Do not add heavyweight dependencies for simple UI tasks when the current stack already covers them.
