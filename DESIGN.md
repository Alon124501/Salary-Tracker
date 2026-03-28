# Design System Documentation

## 1. Overview & Creative North Star: "The Luminous Curator"
This design system is engineered to move beyond functional utility into the realm of digital editorial. It is inspired by the precision of high-end Swiss typography and the airy, light-filled galleries of modern architecture. 

**The Creative North Star** is "The Luminous Curator." This concept dictates that every element on the screen is treated as a featured artifact. We reject the "boxed-in" nature of traditional web grids in favor of intentional asymmetry, massive typographic contrast, and a "Pristine White" environment that allows products and content to breathe. The system feels premium not because of what is added, but because of what is fastidiously removed.

---

## 2. Colors: Tonal Architecture
The palette is rooted in a monochromatic foundation to maintain an authoritative, high-end feel, punctuated by a singular, vibrant "Action Blue."

*   **Pristine Backgrounds:** The base of the experience is `surface` (`#f9f9fb`). It is designed to feel like a high-quality paper stock—bright but not clinical.
*   **The Action Blue:** Primary interactions utilize `#0066CC`. This is the only high-saturation element allowed in the UI, reserved for "Primary" actions to ensure a clear mental model for the user.
*   **The "No-Line" Rule:** This is a fundamental constraint. **Prohibit 1px solid borders for sectioning.** Boundaries must be defined solely through background color shifts. For instance, a `surface-container-low` section should sit adjacent to a `surface` background to create a "seam" rather than a "line."
*   **Glass & Gradient Rule:** To elevate the interface, use Glassmorphism for floating navigation and top-level modals. Use `surface_container_lowest` at 80% opacity with a `backdrop-filter: blur(20px)`. Main CTAs may use a subtle linear gradient from `primary_fixed` to `primary_fixed_dim` to add a sense of "soul" and depth.

---

## 3. Typography: Editorial Authority
Typography is the primary driver of the brand's voice. We pair the geometric authority of **Manrope** for headers with the functional clarity of **Inter** for body copy.

*   **Display & Headlines (Manrope):** Use high-contrast sizing. A `display-lg` (3.5rem) should feel monumental, often centered with generous leading to act as a visual anchor.
*   **Body & Labels (Inter):** Inter provides a technical, clean counterpoint. It should be typeset with slightly increased letter spacing (track: +1% or +2%) for `label` styles to maintain a premium feel.
*   **Hierarchy as Identity:** The jump from `headline-lg` to `body-md` should be dramatic. This scale creates an "editorial" rhythm, leading the user's eye through the narrative rather than just presenting a list of features.

---

## 4. Elevation & Depth: Tonal Layering
Depth in this design system is not about "lifting" objects off a page, but about "stacking" layers of light.

*   **The Layering Principle:** Achieve depth by nesting surface tiers. Place a `surface_container_lowest` card (Pure White) on a `surface_container_low` background to create a natural, soft lift.
*   **Ambient Shadows:** When a floating effect is required (e.g., for a "Buy" sheet or a navigation bar), use extra-diffused shadows.
    *   *Value:* `0px 20px 40px rgba(26, 28, 29, 0.04)`
    *   The shadow must be a tinted version of `on_surface` to mimic natural light, never a harsh dark grey.
*   **The "Ghost Border" Fallback:** If a container requires definition against a matching background, use a "Ghost Border": the `outline_variant` token at 15% opacity. Never use 100% opaque borders.
*   **Corners:** All interactive containers must use a consistent 12px (`xl` scale) corner radius to soften the high-contrast typography and make the UI feel approachable.

---

## 5. Components: Precision Primitives

### Buttons
*   **Primary Action:** Pill-shaped (fully rounded) or 12px radius, utilizing `#0066CC` with white text.
*   **Secondary/Ghost:** `outline_variant` ghost border with Action Blue text.
*   **Tertiary:** No background or border. Action Blue text with a chevron icon.

### Cards & Containers
*   **Constraint:** Forbid the use of divider lines within cards.
*   **Separation:** Use vertical white space from the Spacing Scale (e.g., `8` or `10`) or a shift to `surface_container_highest` for internal headers.

### Input Fields
*   **State:** Default state uses `surface_container_low`. On focus, transition to `surface_container_lowest` with a "Ghost Border" of Action Blue.
*   **Labels:** Use `label-md` in `on_surface_variant` for a muted, sophisticated look.

### Navigation (The Floating Bar)
*   A "curated" navigation bar should be used, leveraging Glassmorphism. It should float at the top of the viewport with a `surface_container_lowest` tint and a 20px blur, creating a sense of continuity as the user scrolls.

---

## 6. Do's and Don'ts

### Do
*   **Do** use massive amounts of white space (Spacing `16`, `20`, `24`) to separate major conceptual blocks.
*   **Do** center-align "hero" typography to evoke a premium, cinematic feel.
*   **Do** use subtle tonal transitions (e.g., `#f9f9fb` to `#eeeef0`) to define content areas.
*   **Do** ensure all "Action Blue" elements are accessible (maintaining a 4.5:1 contrast ratio against the Pristine White background).

### Don't
*   **Don't** use 1px solid black or grey dividers to separate sections.
*   **Don't** use standard "drop shadows" with high opacity; they clutter the "Luminous" aesthetic.
*   **Don't** crowd the edges of the screen. Keep a minimum margin of Spacing `8` (2.75rem) for all main content.
*   **Don't** use multiple accent colors. This design system relies on the singular "Action Blue" to drive focus and brand recognition.