---
name: The PRGI Gazette
colors:
  surface: '#fbf9f8'
  surface-dim: '#dbd9d9'
  surface-bright: '#fbf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3f3'
  surface-container: '#efeded'
  surface-container-high: '#eae8e7'
  surface-container-highest: '#e4e2e2'
  on-surface: '#1b1c1c'
  on-surface-variant: '#444748'
  inverse-surface: '#303030'
  inverse-on-surface: '#f2f0f0'
  outline: '#747878'
  outline-variant: '#c4c7c7'
  surface-tint: '#5f5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1c1b1b'
  on-primary-container: '#858383'
  inverse-primary: '#c8c6c5'
  secondary: '#b02d21'
  on-secondary: '#ffffff'
  secondary-container: '#fc6451'
  on-secondary-container: '#650001'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1c1b1a'
  on-tertiary-container: '#868382'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e5e2e1'
  primary-fixed-dim: '#c8c6c5'
  on-primary-fixed: '#1c1b1b'
  on-primary-fixed-variant: '#474746'
  secondary-fixed: '#ffdad5'
  secondary-fixed-dim: '#ffb4a9'
  on-secondary-fixed: '#410000'
  on-secondary-fixed-variant: '#8e130c'
  tertiary-fixed: '#e6e2df'
  tertiary-fixed-dim: '#cac6c4'
  on-tertiary-fixed: '#1c1b1a'
  on-tertiary-fixed-variant: '#484645'
  background: '#fbf9f8'
  on-background: '#1b1c1c'
  surface-variant: '#e4e2e2'
typography:
  masthead:
    fontFamily: Domine
    fontSize: 84px
    fontWeight: '900'
    lineHeight: 90px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Domine
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 52px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Domine
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 36px
  headline-md:
    fontFamily: Domine
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 38px
  headline-sm:
    fontFamily: Domine
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 24px
  body-lg:
    fontFamily: Source Serif 4
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Source Serif 4
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Source Serif 4
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Archivo Narrow
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
spacing:
  margin-desktop: 48px
  margin-mobile: 16px
  gutter: 24px
  column-width: calc((100% - (11 * 24px)) / 12)
  rule-thin: 1px
  rule-thick: 4px
---

## Brand & Style

This design system is a digital translation of classic broadsheet journalism. It targets readers and users who value information density, editorial authority, and a tangible sense of "physical" media. The emotional response is one of intellectual rigor, tradition, and urgency.

The aesthetic utilizes **Editorial Brutalism**: a rigid, column-based structure that celebrates the constraints of print. Key characteristics include:
- **Broadsheet Density:** High information density with minimal "decorative" whitespace; every millimeter is utilized for content.
- **Physicality:** Use of subtle paper grain textures and slightly irregular "rough-cut" edges on container elements to mimic manual guillotine trimming.
- **Rules & Borders:** Heavy horizontal rules (2pt to 4pt) serve as the primary navigational anchors, creating clear hierarchical breaks between stories and sections.

## Colors

The palette is strictly limited to mimic the cost-effective printing of vintage newspapers.

- **Paper (#f4f1ea):** The primary background color. It is an off-white, warm eggshell that reduces digital eye strain and provides a vintage tactile feel.
- **Ink Black (#1a1a1a):** Used for all body text, headlines, and primary rules. It is a high-contrast, slightly softened black to avoid the clinical feel of pure #000000.
- **Gazette Red (#c0392b):** A vibrant, slightly desaturated red used sparingly for "Breaking News" banners, category labels, and call-to-action highlights.
- **Ink Grey (#4a4a4a):** Used for secondary information, metadata (author/date), and thinner decorative rules.

## Typography

The typography system relies on a high-contrast serif pairing to establish authority and readability.

- **Headlines (Domine):** Chosen for its heavy weights and classic "newspaper" slab-serif characteristics. At large scales, it feels authoritative and impactful.
- **Body (Source Serif 4):** A highly legible serif optimized for digital screens while maintaining a classic literary feel. It is used for all long-form content.
- **Labels (Archivo Narrow):** A condensed sans-serif used for metadata, tags, and small utility text. This mimics the "set in small type" aesthetic of classifieds and sports scores.

Text should generally be justified for body paragraphs to create the rigid vertical edges characteristic of column-based layouts.

## Layout & Spacing

This design system uses a **Rigid 12-Column Grid** that mimics the vertical stacking of a broadsheet.

- **Grid Logic:** Content is organized into distinct vertical "lanes." On desktop, a primary story may span 8 columns, while sidebars span 4.
- **Rules as Dividers:** Horizontal rules are the primary tool for spatial separation. A 4px "Thick Rule" separates major sections (e.g., Header from Content), while 1px "Thin Rules" separate individual articles or list items.
- **Tight Spacing:** Padding inside containers is intentionally compact to maximize information density. Vertical rhythm is strictly enforced to ensure lines of text across adjacent columns align.
- **Breakpoints:** On mobile, the 12-column grid collapses into a single column, but horizontal rules are retained to ensure clear separation between news items.

## Elevation & Depth

This system is fundamentally flat, rejecting shadows and blurs in favor of structural layering.

- **Tonal Layers:** Depth is created through color blocks. High-priority "Callouts" or "Alerts" use the Gazette Red background with white text, creating a visual "pop" without using shadows.
- **Rough Edges:** Containers do not use shadows but instead use a "rough-cut" SVG mask on their borders to mimic the texture of torn or cut paper.
- **Inverted Blocks:** Use Ink Black backgrounds with Paper (#f4f1ea) text for "Special Features" or "Opinion" sections to create a high-contrast visual depth.

## Shapes

The shape language is **Sharp (0px)**. Roundness is avoided to maintain the rigid, industrial feel of a printing press.

- **Corners:** All buttons, input fields, and image containers must have 90-degree sharp corners.
- **Rules:** Lines should have square caps, not rounded ones.
- **Masking:** If images are used, they should be strictly rectangular or use the "Rough-Cut" edge mask for a more artisanal, hand-composed appearance.

## Components

- **Buttons:** Styled as "Box Labels." Solid Ink Black background with Paper-colored text. No rounded corners. On hover, they shift to Gazette Red.
- **Banners / Chips:** These appear as "Ear Tabs" or "Sluglines." They use a solid red background with white uppercase Archivo Narrow text.
- **Input Fields:** 1px solid Ink Black border. No shadow. The background matches the paper color. Focus state is indicated by a 2px offset border.
- **Horizontal Rules:** The most critical component. They should be used to top and bottom-cap every major content section.
- **Cards:** Content cards do not have borders or shadows. Instead, they are defined by the space between them and the horizontal rules that separate them from the content above and below.
- **Drop Caps:** For lead articles, the first character of the body text should be a large, 4-line height "Drop Cap" using the headline font (Domine) in Gazette Red.