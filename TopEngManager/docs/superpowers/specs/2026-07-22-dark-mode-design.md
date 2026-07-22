# Spec Design: Dark/Light Mode Switch

## Context & Objectives
Add dynamic Dark Mode support to TopEng Manager web system, toggled via a Sun/Moon button inside the profile dropdown header directly underneath the "Change Password" button.

## Proposed Design Details

### 1. Color Custom Properties in CSS
Introduce a `[data-theme="dark"]` override in `src/app/globals.css` that maps custom properties to dark mode counterparts:
- `--neutral-bg-main`: `#0f172a` (slate-900)
- `--neutral-bg-card`: `#1e293b` (slate-800)
- `--neutral-bg-hover`: `#334155` (slate-700)
- `--neutral-dark`: `#f8fafc` (slate-50)
- `--neutral-border`: `#334155` (slate-700)
- `--neutral-muted`: `#94a3b8` (slate-400)
- `--primary-color`: `#3b82f6` (blue-500)
- `--primary-hover`: `#60a5fa`
- `--primary-light`: `#1e3a8a`

To prevent background contrasts and hardcoded light colors from looking misplaced, we will clean up some elements in globals.css (such as ensuring inputs, sidebars, and popups use these variables).

### 2. Hydration Screen Flash Prevention
Add an inline execution script block in `src/app/layout.js` inside the `<head>` tag. This runs synchronously prior to page rendering, fetching the client's `theme` preference from local storage:
```html
<script dangerouslySetInnerHTML={{ __html: `
  (function() {
    try {
      var theme = localStorage.getItem('theme');
      if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    } catch (e) {}
  })();
` }} />
```

### 3. Switch Button Component
Integrate a secondary button with custom icon and translations underneath the "Change Password" button in `src/components/Header.js`:
- If `isDarkMode` is true, display Sun icon (`fa-sun`) and `Light Mode` text.
- If `isDarkMode` is false, display Moon icon (`fa-moon`) and `Dark Mode` text.
- Change `isDarkMode` state, apply/remove the `data-theme` attribute on `document.documentElement`, and write the value to local storage.

## Verification Plan
1. Check that the script executes cleanly on hard reload without screen flicker.
2. Confirm variables toggle instantly upon clicking the button.
3. Validate state is persistent across browser restarts and multiple tabs.
