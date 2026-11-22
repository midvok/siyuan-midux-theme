# SiYuan Theme Development Notes

Findings about building a custom **SiYuan** theme. They come from the SiYuan source code, the official docs and two existing themes. All source links point to tag `v3.8.11`, the version these notes were checked against.

> [!note]
> For how Midux applies these findings (build, deployment, preset menu), see [Midux Implementation](implementation.md).

## Theme basics

- A theme is a folder with a **`theme.json`** manifest and a **`theme.css`** stylesheet.
- SiYuan **_always loads its built-in theme first_**: `daylight` in light mode, `midnight` in dark mode. Your `theme.css` loads on top of it.
- So a theme only needs overrides. It never has to restyle the whole app.
- The built-in [daylight/theme.css](https://github.com/siyuan-note/siyuan/blob/v3.8.11/app/appearance/themes/daylight/theme.css) is only about 270 lines of `--b3-*` **CSS variables**. [midnight/theme.css](https://github.com/siyuan-note/siyuan/blob/v3.8.11/app/appearance/themes/midnight/theme.css) is the dark counterpart.
- All layout CSS lives in `base.css` (about 600 KB). It is built from the SCSS sources in [app/src/assets/scss](https://github.com/siyuan-note/siyuan/tree/v3.8.11/app/src/assets/scss).

## Theme location

| Path                                  | Content                                             |
| ------------------------------------- | --------------------------------------------------- |
| `<workspace>/data/themes/<name>/`     | Third-party themes (SiYuan 3.8+)                    |
| `<app>/resources/appearance/themes/`  | Built-in `daylight` and `midnight`                  |
| `<workspace>/conf/appearance/themes/` | Old location, migrated to `data/themes/` at startup |

- Themes in `data/themes/` sync between devices like plugins and widgets.
- Each device keeps its own theme selection in `conf/conf.json`.
- **_Symbolic links are allowed_** for local development. They stay local and are excluded from sync.
- SiYuan serves a theme at `/appearance/themes/<name>/`, for example `/appearance/themes/Midux/theme.css`.

Sources: [APPEARANCE-SYNC.md](https://github.com/siyuan-note/siyuan/blob/v3.8.11/docs/APPEARANCE-SYNC.md), [WORKSPACE.md](https://github.com/siyuan-note/siyuan/blob/v3.8.11/docs/WORKSPACE.md).

## Theme files

| File                       | Required | Purpose                                                 |
| -------------------------- | -------- | ------------------------------------------------------- |
| `theme.json`               | Yes      | Manifest                                                |
| `theme.css`                | Yes      | Stylesheet                                              |
| `theme.js`                 | No       | Script, loaded only if the file exists                  |
| `icon.png` / `preview.png` | No       | Image shown in the theme list and marketplace           |
| `README.md`                | No       | Marketplace description                                 |
| `i18n/`                    | No       | Translations; a convention used by Savor, not by SiYuan |

> [!warning]
> SiYuan **_silently skips_** a theme with an invalid `theme.json` or a missing `theme.css`. It does not show an error.

### The theme.json manifest

| Field                                  | Notes                                                                                   |
| -------------------------------------- | --------------------------------------------------------------------------------------- |
| `name`                                 | **_Must equal the folder name._** No `<>&'":/\|?*`, no leading or trailing dot or space |
| `author`, `url`                        | Author name and repository URL                                                          |
| `version`                              | Theme version; must increase for marketplace updates                                    |
| `minAppVersion`                        | The theme is hidden in older SiYuan versions                                            |
| `frontends`                            | `all`, or a list such as `desktop` and `mobile`                                         |
| `modes`                                | `["light"]`, `["dark"]` or both; decides in which theme lists it appears                |
| `displayName`, `description`, `readme` | Localized strings, keyed by `default`, `zh_CN` and so on                                |
| `icon`, `preview`                      | File names of the images                                                                |
| `funding`, `keywords`                  | Marketplace metadata                                                                    |

Source: [kernel/bazaar/package.go](https://github.com/siyuan-note/siyuan/blob/v3.8.11/kernel/bazaar/package.go), [kernel/model/appearance.go](https://github.com/siyuan-note/siyuan/blob/v3.8.11/kernel/model/appearance.go).

## How SiYuan loads a theme

1. It sets attributes on `<html>`: `data-theme-mode`, `data-light-theme`, `data-dark-theme`, `lang` and `data-frontend`.
2. It loads the built-in theme as `<link id="themeDefaultStyle">`.
3. It loads the custom `theme.css` as `<link id="themeStyle">`.
4. It unloads the previous `theme.js` by calling `window.destroyTheme`.
5. It loads the new `theme.js` as `<script id="themeScript">`, if the file exists.

Source: [app/src/util/assets.ts](https://github.com/siyuan-note/siyuan/blob/v3.8.11/app/src/util/assets.ts).

### Startup order

- At startup, SiYuan loads the config, then local storage, then languages and menus, and only then the interface and theme.
- So `theme.js` can rely on `window.siyuan.config`, `window.siyuan.storage` and `window.siyuan.menus`.

Source: [app/src/index.ts](https://github.com/siyuan-note/siyuan/blob/v3.8.11/app/src/index.ts).

### Light and dark mode

- The current mode is in `<html data-theme-mode="light|dark">`.
- A theme that supports both modes scopes its dark styles with `:root[data-theme-mode="dark"]`.
- SiYuan selects one theme per mode. If the dark theme is a different theme, a mode switch swaps the whole theme, including `theme.js`.

### Live reload

- The kernel watches `data/themes/` and the **_top level_** of the current theme folder.
- **_Only writes to the root `theme.css` trigger a reload_**, debounced by 100 ms.
- Changes in subfolders, `theme.js` or `theme.json` do not reload. Restart SiYuan or reload the window.
- The watcher reacts to in-place writes only. An editor or tool that saves by renaming a temporary file does not trigger a reload.
- The watch follows a symlinked theme folder. Symlinked single files do not work: writes happen in the target folder, which is not watched.

> [!tip]
> Compile all sources into one root `theme.css`. Plain `@import` of subfiles works for loading, but editing a subfile does not reload.

Source: [kernel/model/themes_watcher.go](https://github.com/siyuan-note/siyuan/blob/v3.8.11/kernel/model/themes_watcher.go), [kernel/model/appearance.go](https://github.com/siyuan-note/siyuan/blob/v3.8.11/kernel/model/appearance.go).

## Styling reference

### Variables

The built-in themes define `--b3-*` variables on `:root`. The block shows the main groups with their `daylight` values.

```scss
// A custom theme overrides the built-in variables on :root.
// theme.css loads after the built-in theme, so equal specificity wins.
:root {
  // === Theme colors ===
  --b3-theme-primary: #3575f0; // accent
  --b3-theme-background: #fff; // editor and panels
  --b3-theme-surface: #f6f6f6; // sidebars, hover
  --b3-theme-on-background: #222; // main text
  --b3-theme-on-surface: #5f6368; // secondary text

  // === Fonts ===
  --b3-font-family: var(--b3-font-family-default); // UI
  --b3-font-family-protyle: var(--b3-font-family); // editor
  --b3-font-family-code: "JetBrainsMono-Regular", mononoki, Consolas, monospace; // shortened
  --b3-font-size: 14px;

  // === Layout ===
  --b3-body-background: #ebecf0; // gaps between panels
  --b3-border-color: var(--b3-theme-surface-lighter);
  --b3-border-radius: 6px;
  --b3-scroll-color: rgba(0, 0, 0, 0.2);

  // === Menus and tooltips ===
  --b3-menu-background: var(--b3-theme-background);
  --b3-tooltips-background: #312f35;

  // === Font colors (1 to 13) ===
  --b3-font-color1: var(--b3-card-error-color);
  --b3-font-background1: var(--b3-card-error-background);
  --b3-card-error-color: #790600;

  // === Editor inline ===
  --b3-protyle-inline-link-color: #4285f4;
  --b3-protyle-inline-mark-background: rgb(252, 212, 126);
  --b3-protyle-code-background: rgba(27, 31, 35, 0.05);

  // === Callouts and tables ===
  --b3-callout-note: var(--b3-theme-primary);
  --b3-callout-tip: var(--b3-theme-success);
  --b3-table-even-background: rgba(0, 0, 0, 0.04);
}

// A theme with both modes scopes its dark values to the mode attribute.
:root[data-theme-mode="dark"] {
  --b3-theme-background: #1e1f22;
}
```

See [daylight/theme.css](https://github.com/siyuan-note/siyuan/blob/v3.8.11/app/appearance/themes/daylight/theme.css) for the full list.

### Selectors

| Element                    | Selector                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| Editor content             | `.protyle-wysiwyg`                                                                                   |
| Preview and export content | `.b3-typography`                                                                                     |
| Headings                   | `.h1` … `.h6`, `[data-type="NodeHeading"]`                                                           |
| Paragraphs, list items     | `.p`, `.li`                                                                                          |
| Blockquotes, callouts      | `.bq`, `.callout`                                                                                    |
| Code blocks, tables        | `.code-block`, `.table`                                                                              |
| Inline elements            | `span[data-type~="strong"]`, `~="em"`, `~="code"`, `~="mark"`, `~="kbd"`, `~="tag"`, `~="block-ref"` |

### Base SCSS sources

- [base.scss](https://github.com/siyuan-note/siyuan/blob/v3.8.11/app/src/assets/scss/base.scss): entry point of `base.css`.
- [protyle/\_wysiwyg.scss](https://github.com/siyuan-note/siyuan/blob/v3.8.11/app/src/assets/scss/protyle/_wysiwyg.scss): editor blocks.
- [protyle/\_inline.scss](https://github.com/siyuan-note/siyuan/blob/v3.8.11/app/src/assets/scss/protyle/_inline.scss): inline elements.
- [component/\_typography.scss](https://github.com/siyuan-note/siyuan/blob/v3.8.11/app/src/assets/scss/component/_typography.scss): preview and export typography.
- [component/\_menu.scss](https://github.com/siyuan-note/siyuan/blob/v3.8.11/app/src/assets/scss/component/_menu.scss): menus.
- [export.scss](https://github.com/siyuan-note/siyuan/blob/v3.8.11/app/src/assets/scss/export.scss): export styles.

> [!note]
> On export, the kernel resolves CSS variables from the theme to inline styles. See [kernel/model/theme.go](https://github.com/siyuan-note/siyuan/blob/v3.8.11/kernel/model/theme.go).

## Theme options in the Appearance Mode menu

A theme can add its own items, such as color presets or feature toggles, to the **Appearance Mode** menu (the sun icon in the top bar). SiYuan has **_no theme API_** for this. `theme.js` has to extend the menu itself.

### How the menu works

- The sun icon is `#barMode`. A click builds the menu in the shared `#commonMenu` element.
- SiYuan sets `data-name="barmode"` on `#commonMenu` and adds the Light, Dark and OS items, all in one step.
- `#commonMenu` has two children: `.b3-menu__title` first, then `.b3-menu__items`.
- On close, `Menu.remove()` empties `.b3-menu__items`, removes `data-name` and hides the menu.
- Plugins get a `common-menu-open` event. **_Themes do not_**, because they have no event bus.

Sources: [app/src/layout/topBar.ts](https://github.com/siyuan-note/siyuan/blob/v3.8.11/app/src/layout/topBar.ts), [app/src/menus/Menu.ts](https://github.com/siyuan-note/siyuan/blob/v3.8.11/app/src/menus/Menu.ts), [app/src/constants.ts](https://github.com/siyuan-note/siyuan/blob/v3.8.11/app/src/constants.ts) (`MENU_BAR_MODE`).

### Menu item markup

| Element       | Markup                                                       |
| ------------- | ------------------------------------------------------------ |
| Item          | `<button class="b3-menu__item">`                             |
| Icon          | `<svg class="b3-menu__icon">` or any element with that class |
| Label         | `<span class="b3-menu__label">`                              |
| Selected item | add `b3-menu__item--selected`                                |
| Separator     | `<button class="b3-menu__separator">`                        |

### Adding items from theme.js

1. Watch the `data-name` attribute of `#commonMenu` with a **MutationObserver**.
2. When it becomes `barmode`, append a separator and your items to `:scope > .b3-menu__items`. Skip this if your items are already there.
3. On click, stop event propagation, apply the option, save it and call `window.siyuan.menus.menu.remove()`.
4. Do nothing on close. SiYuan empties the item list and removes your items with it.

> [!warning]
> Don't insert elements before `.b3-menu__title`. `Menu.remove()` treats the first child as the title, so a foreign first child can break the menu.

### Applying options

- Set an attribute on `<html>` and scope the CSS to it.
- **Presets** use a value attribute, for example `data-midux-preset="steel-grey"`.
- **Toggles** use a presence attribute, for example `data-midux-colored-headings`.
- Runtime switching needs **CSS custom properties**. SCSS variables exist only at compile time.

### Saving options

| Storage                        | Verdict     | Reason                                                                     |
| ------------------------------ | ----------- | -------------------------------------------------------------------------- |
| Browser `localStorage`         | Avoid       | Its origin includes the kernel port, which can change between launches     |
| Workspace storage API          | Recommended | Stored in `data/storage/local.json`, loaded before `theme.js` runs, synced |
| File API (`/api/file/putFile`) | Possible    | Used by Savor; reading back is async, so the default can flash at startup  |

The workspace storage API:

- **Read:** `window.siyuan.storage[key]`. SiYuan loads the whole `local.json` into it at startup.
- **Write:** `POST /api/storage/setLocalStorageVal` with `{ "app": "<id>", "key": "<key>", "val": <value> }`.

Sources: [kernel/api/storage.go](https://github.com/siyuan-note/siyuan/blob/v3.8.11/kernel/api/storage.go), [kernel/model/storage.go](https://github.com/siyuan-note/siyuan/blob/v3.8.11/kernel/model/storage.go), [app/src/protyle/util/compatibility.ts](https://github.com/siyuan-note/siyuan/blob/v3.8.11/app/src/protyle/util/compatibility.ts).

### Script lifecycle

- **_Define `window.destroyTheme`._** SiYuan calls it before switching away. Without it, SiYuan cannot unload the script.
- `destroyTheme` must undo everything: observers, `<html>` attributes, injected elements and styles.
- Wrap the script in an **IIFE**. SiYuan can load it again, and top-level `const` declarations would then throw.
- Mobile has no `#barMode`. Options there need another UI, or they fall back to defaults.
- `theme.js` runs after `theme.css`. Make the default option work without the script to avoid a flash.

## Existing themes

| Theme                                                          | Structure                                           | Options                                                                                        |
| -------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [Savor](https://github.com/royc01/notion-theme)                | esbuild and lightningcss build into one `theme.css` | Toolbar in `#commonMenu`, `savor-theme` attribute, config in `data/snippets/Savor.config.json` |
| [Tsundoku](https://github.com/Achuan-2/siyuan-themes-tsundoku) | `theme.css` imports CSS files from `style/`         | `theme.js` loads a dark palette file                                                           |

- Savor inserts its toolbar as the first child of `#commonMenu` and hides it with CSS unless `data-name="barmode"`.
- Savor's script is an 85 KB bundle with many other features.

## Publishing to the marketplace

- The marketplace is the [siyuan-note/bazaar](https://github.com/siyuan-note/bazaar) repository. You add a theme with a pull request.
- The theme repository needs a **_Latest Release with a `package.zip`_**.
- An automated PR check verifies the release, required files and metadata.
- For updates, publish a new release with a higher `version`. The index updates every one to three hours.
- The package license must permit redistribution.

## References

### Documentation

- [SiYuan docs folder](https://github.com/siyuan-note/siyuan/tree/v3.8.11/docs)
- [APPEARANCE-SYNC.md](https://github.com/siyuan-note/siyuan/blob/v3.8.11/docs/APPEARANCE-SYNC.md): theme storage and sync.
- [WORKSPACE.md](https://github.com/siyuan-note/siyuan/blob/v3.8.11/docs/WORKSPACE.md): workspace layout.
- [Bazaar README](https://github.com/siyuan-note/bazaar/blob/main/README.md): marketplace rules.

### Frontend source

- [app/appearance/themes](https://github.com/siyuan-note/siyuan/tree/v3.8.11/app/appearance/themes): built-in themes.
- [app/src/assets/scss](https://github.com/siyuan-note/siyuan/tree/v3.8.11/app/src/assets/scss): base styles.
- [app/src/util/assets.ts](https://github.com/siyuan-note/siyuan/blob/v3.8.11/app/src/util/assets.ts): theme loading and `destroyTheme`.
- [app/src/menus/Menu.ts](https://github.com/siyuan-note/siyuan/blob/v3.8.11/app/src/menus/Menu.ts): shared menu and menu items.
- [app/src/layout/topBar.ts](https://github.com/siyuan-note/siyuan/blob/v3.8.11/app/src/layout/topBar.ts): Appearance Mode menu.
- [app/src/index.ts](https://github.com/siyuan-note/siyuan/blob/v3.8.11/app/src/index.ts): startup order.

### Kernel source

- [kernel/model/appearance.go](https://github.com/siyuan-note/siyuan/blob/v3.8.11/kernel/model/appearance.go): theme discovery and reload broadcast.
- [kernel/model/themes_watcher.go](https://github.com/siyuan-note/siyuan/blob/v3.8.11/kernel/model/themes_watcher.go): file watcher.
- [kernel/bazaar/package.go](https://github.com/siyuan-note/siyuan/blob/v3.8.11/kernel/bazaar/package.go): manifest fields and validation.
- [kernel/model/storage.go](https://github.com/siyuan-note/siyuan/blob/v3.8.11/kernel/model/storage.go): workspace local storage.
