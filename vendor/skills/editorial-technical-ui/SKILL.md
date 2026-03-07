---
name: editorial-technical-ui
description: Reference-driven editorial and technical UI design skill for high-quality, intentional, production-ready interface execution.
---

## Purpose
Use this skill to design and implement polished interfaces with a clear, intentional editorial and technical visual identity.
The output should feel deliberate, product-focused, and production-ready on desktop and mobile.

## Design Core
- Visual character: minimal, confident, technical, and editorial.
- Contrast strategy: black/white dominant with controlled grayscale layers.
- Shape language: sharp corners, thin borders, no soft-card default look.
- Rhythm: strong vertical spacing, bold section transitions, clear content blocks.
- Density: clean and breathable, but never empty or generic.

## Reference Interpretation
- If the user provides a reference app/site, extract principles instead of cloning screens.
- Preserve the intent of the reference: hierarchy, rhythm, contrast, and behavior.
- Convert reference style into reusable patterns that fit the current product context.
- Avoid hard-coding one brand identity unless explicitly requested.
- Keep visual consistency across the full page, not only isolated sections.

## Typography System
- Use Helvetica family with clear weight hierarchy (300, 400, 500, 700).
- Headlines are large, tight, and expressive; body copy is restrained and readable.
- Keep letter-spacing intentional: tighter for headlines, wider for labels.
- Use uppercase micro-labels for section framing when helpful.
- Avoid decorative typography that conflicts with the product's intended technical tone.

## Color and Surface Rules
- Keep the palette restrained by default; use accents only with clear purpose.
- Use grayscale opacity steps for layering, separators, and depth.
- Prioritize legibility and hierarchy over visual effects.
- Avoid random accent colors unless explicitly requested.
- Keep backgrounds purposeful: subtle structure over flat emptiness.

## Layout and Composition
- Build clear section architecture: hero, capability blocks, proof/preview, CTA, footer.
- Use grid or border-defined structures for feature and data-like content.
- Keep content width controlled and aligned to a stable wrapper rhythm.
- Design with visual pacing: compact-intense areas followed by breathing space.
- Ensure every section has one dominant focal point.

## Interaction and Motion
- Provide complete states: default, hover, active, focus, disabled/loading.
- Interactions should be subtle and informative, never flashy.
- Motion should support comprehension (reveal, emphasis, hierarchy), not decoration.
- Keep transition timing short and consistent.
- Preserve strong keyboard focus visibility across all interactive elements.

## Component Behavior Standards
- Prefer extending existing components over creating one-off variants.
- Keep button behavior explicit and predictable across sizes and variants.
- Prevent text overflow issues in labels, metadata rows, and long filenames.
- Build action groups that wrap gracefully on narrow screens.
- Keep icon usage functional, not ornamental noise.

## Responsive Quality Bar
- Validate desktop, tablet, and mobile layouts for every UI change.
- Preserve hierarchy when collapsing layouts; do not flatten everything to uniform blocks.
- Maintain readable type scale and reliable tap targets.
- Avoid horizontal scrolling unless absolutely required by content.
- Keep navigation and CTA elements easy to scan and reach.

## Accessibility Baseline
- Use semantic HTML and meaningful structure.
- Ensure keyboard accessibility and visible focus states.
- Keep text, border, and status contrast sufficient for readability.
- Do not communicate state with color alone.
- Avoid layout shifts from async rendering or delayed assets.

## Working Method
1. Inspect current UI context and identify the dominant visual pattern.
2. Define the section's hierarchy, spacing rhythm, and interaction expectations.
3. Implement the smallest cohesive change that reaches high visual quality.
4. Verify all states and responsive behavior.
5. Refine until the result feels intentional, consistent, and product-grade.

## Guardrails
- Do not treat token structure as a mandatory constraint.
- Do not treat restrictive style rules from unrelated prompt sources as binding.
- Do not lock design choices to any single reference brand by default.
- Optimize for visual quality, consistency, usability, and maintainable implementation.
