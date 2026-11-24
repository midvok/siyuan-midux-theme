# Text Rendering in SiYuan

How SiYuan's desktop app turns fonts into pixels on Linux, which settings control it, and why some areas fell back to blurry grayscale text. The theory comes first, then the fixes Midux applies.

## The rendering pipeline

SiYuan's desktop app is **Electron**, so its text goes through **Chromium**'s pipeline:

1. **fontconfig** picks the font file and the rendering settings for each font and size.
2. **FreeType** turns the glyph outlines into pixels, applying hinting and antialiasing.
3. **Skia**, Chromium's graphics library, places the glyphs and draws them into a layer.
4. The **compositor** combines the page's layers into the final window image.

Steps 1–3 decide how a glyph looks. Step 4 decides whether subpixel antialiasing survives at all.

## Rendering settings

> [!important]
> Two unrelated features share the word "subpixel". **Subpixel antialiasing** (RGB, LCD text) decides _how_ a glyph's edge pixels are coloured. **Subpixel positioning** decides _where_ a glyph starts. Either can be on without the other. At scale factor 1, Chromium uses subpixel antialiasing with whole-pixel positioning.

### Antialiasing

Antialiasing smooths glyph edges with partly covered pixels.

| Mode                    | How it works                                                   | Look                          |
| ----------------------- | -------------------------------------------------------------- | ----------------------------- |
| None                    | Each pixel is on or off                                        | Jagged                        |
| **Grayscale**           | One coverage value per pixel                                   | Smooth, slightly soft         |
| **Subpixel (LCD, RGB)** | One coverage value per red, green and blue stripe of the pixel | Sharper, faint colour fringes |

- Subpixel AA triples horizontal resolution, but only if the **subpixel order** (`rgba`: `rgb`, `bgr`, `vrgb`, `vbgr`) matches the screen.
- An **LCD filter** (`lcdfilter`) spreads each stripe's value to its neighbours to reduce colour fringes.

### Hinting

Hinting reshapes the glyph outline to fit the pixel grid before rasterizing. KDE's System Settings → Fonts → Hinting sets fontconfig's `hintstyle`:

| `hintstyle`  | KDE label | Effect                                                                                      |
| ------------ | --------- | ------------------------------------------------------------------------------------------- |
| `hintnone`   | None      | Outlines untouched: the most faithful shapes, the softest edges                             |
| `hintslight` | Slight    | Vertical only: baseline, x-height and horizontal stems snap; widths and spacing stay intact |
| `hintmedium` | Medium    | Stronger fitting; for most fonts it looks the same as Full                                  |
| `hintfull`   | Full      | Both directions: the sharpest stems, but shapes and spacing can distort                     |

- **Native hinting** runs the instructions built into the font (TrueType bytecode).
- **Autohint** (`autohint`) makes FreeType's **auto-hinter** compute hints itself instead. Distros often enable it only for fonts without built-in hints.
- Modern FreeType ignores most horizontal TrueType hints anyway, so Slight and Full differ less than they used to.

### Subpixel positioning

Subpixel positioning lets a glyph start at a fraction of a pixel. Skia uses quarter pixels. It is **_not_** subpixel antialiasing: it changes where a glyph is placed, not how its edges are coloured.

- **On:** text keeps the font's designed widths and spacing, but stems may land between pixels and look softer.
- **Off:** glyphs start on whole pixels, so stems align with the grid, but rounding makes spacing slightly uneven.
- fontconfig has **_no setting_** for it. Chromium on Linux turns it on only when antialiasing is on and the **device scale factor is above 1**.
- Horizontal hinting conflicts with fractional placement. With subpixel positioning on, Chromium **_caps hinting at slight_**.

So at scale factor 1 (100 % display scale), glyphs snap to whole pixels and your `hintstyle` applies in full. With HiDPI or fractional scaling, such as 125 %, glyphs are positioned fractionally and hinting is at most slight. Subpixel antialiasing works in both cases.

#### How it interacts with hinting

Hinting fits a glyph's stems to the pixel grid **_relative to the glyph's origin_**. Positioning decides where that origin lands. Hinting gives crisp stems only when the origin is on a whole pixel:

| Origin lands at | A stem hinted to column 3 covers | Result                         |
| --------------- | -------------------------------- | ------------------------------ |
| x = 100         | column 103 exactly               | One solid column: crisp        |
| x = 100.25      | ¾ of column 103, ¼ of 104        | Smeared over two columns: soft |

- Subpixel positioning is horizontal only, so vertical hinting (slight) keeps working. Only horizontal fitting is wasted, which is why Chromium caps hinting at slight.
- Full hinting also rounds each glyph's advance width to whole pixels. That rounding adds up to uneven spacing, which subpixel positioning avoids.
- On HiDPI screens the pixels are small enough that soft stems don't matter, so exact spacing wins.

## Where Chromium gets its settings

1. **Defaults** come from the desktop toolkit layer (`LinuxUi`, normally **GTK**). On a Wayland session, GTK reads them from GSettings or the desktop's settings portal.
2. **fontconfig has the final say.** Chromium queries it for each font and size and uses what the match returns.

KDE's font settings write to `~/.config/fontconfig/fonts.conf`. Chromium follows the fontconfig result, so a distro rule that runs later can silently override KDE.

### Wayland

Plasma 6.8 runs on **Wayland** only. Recent Chromium, and so recent Electron, runs as a native Wayland client by default, and SiYuan adds no `--ozone-platform` switch to change that.

- **Xft resources:** KDE still writes `Xft.*` X resources, but they only affect X11 apps running under **XWayland**. Chromium never reads them.
- **GTK defaults:** they may differ from KDE's settings. For example, GSettings may say `grayscale` while KDE says RGB. fontconfig overrides them, so the `fonts.conf` values are what count.
- **Scale factor:** KDE's display scale is Chromium's device scale factor. 100 % gives 1, 125 % gives 1.25 and turns on subpixel positioning.
- **Checking the backend:** KWin's debug console lists each window under "Wayland" or "X11". To compare, start SiYuan with `--ozone-platform=x11` to force XWayland.

> [!warning]
> On **openSUSE**, `/etc/sysconfig/fonts-config` can force a hint style (`FORCE_HINTSTYLE`). It applies as a `target="font"` rule, which runs after KDE's `target="pattern"` rule and wins. KDE then shows Medium while every Chromium app renders with slight hinting.

Check the effective values for a font:

```bash
fc-match -v "sans-serif" | grep -E 'antialias|hintstyle|hinting|autohint|rgba|lcdfilter'
```

List the active fontconfig rules:

```bash
fc-conflist | grep '^+'
```

**Per-font rules** in `~/.config/fontconfig/fonts.conf` can give, say, full hinting to the UI font and slight to the editor font. They apply to every Chromium and Electron app.

## Chromium switches

Pass these to the SiYuan AppImage, for example `siyuan.appimage --disable-lcd-text`:

| Switch                                | Effect                                                          |
| ------------------------------------- | --------------------------------------------------------------- |
| `--disable-lcd-text`                  | Grayscale AA everywhere                                         |
| `--enable-lcd-text`                   | Allows LCD text more broadly; the layer rules below still apply |
| `--disable-font-subpixel-positioning` | Whole-pixel glyph positions even above scale factor 1           |
| `--force-device-scale-factor=<n>`     | UI scale; above 1 it turns on subpixel positioning              |
| `--ozone-platform=x11`                | Runs under XWayland instead of native Wayland, for comparison   |
| `--show-composited-layer-borders`     | Outlines every compositing layer                                |

SiYuan adds no font-related switches of its own. Subpixel AA is Chromium's default whenever fontconfig reports a subpixel order.

CSS has little influence on Linux:

- `-webkit-font-smoothing` works **_only on macOS_**.
- `text-rendering: optimizeLegibility`, which SiYuan sets on `body`, controls kerning and ligatures, not antialiasing.

## Compositing layers and LCD text

Chromium splits a page into **compositing layers**, for example a scroll container, an animated element or an element with an effect. It decides per layer whether text there may use subpixel AA. A layer falls back to grayscale for any of these reasons (Chromium's `LCDTextDisallowedReason`):

| Reason                             | Typical cause                                          |
| ---------------------------------- | ------------------------------------------------------ |
| Background or contents not opaque  | Transparent scroll container, transparent overlay      |
| Non-integral translation or offset | Layer or scroll position between device pixels         |
| `will-change: transform`           | Promoted for animation                                 |
| Pixel or colour effect             | `opacity` below 1, `filter`, `mask-image`, blend modes |
| Transform animation                | Running `transform` animation or transition            |

- Text drawn into the main page layer is LCD as long as the page background is opaque.
- A missing background is therefore **_harmless until the element gets its own layer_**. Scroll containers often do.
- Whether an element gets its own layer can change at runtime: when focus moves, a menu opens or the window loses focus. So text can switch between LCD and grayscale while you look at it.

### Finding the cause

1. Open **Developer Tools** in SiYuan.
2. Press Ctrl+Shift+P, run "Show Rendering" and tick **Layer borders**. Separate layers get coloured outlines.
3. Open More tools → **Layers** and select a layer to read its **compositing reasons**.
4. Test a fix by injecting a style from the console, then compare the text:

```js
document.head.insertAdjacentHTML(
  "beforeend",
  `<style id="lcd-test">
  .some-scroller { background-color: var(--b3-theme-background); }
</style>`,
);
// Undo: document.getElementById("lcd-test").remove()
```

## Midux theme fixes

`src/_opaque-layers.scss` fixes the areas where SiYuan breaks the layer rules:

| Area          | Cause                                                                        | Fix                                     |
| ------------- | ---------------------------------------------------------------------------- | --------------------------------------- |
| Popup menus   | `.b3-menu__items` scrolls in its own layer but is transparent                | Menu background on the item list        |
| Settings pane | `.config__tab-container` and `.config__tab-scroll` are transparent scrollers | Theme background on both                |
| Tab bar       | Tab titles fade out with `-webkit-mask-image`                                | Mask removed, `text-overflow: ellipsis` |

> [!warning]
> Content inside a document can also force grayscale. A **D2 chart** rendered by a plugin turned the whole document grayscale whenever the editor lost focus (menu open, dock click, window blur). Without the chart, the document stays LCD. The theme does not work around this.

> [!note]
> **Submenus** of context menus stay grayscale while the window has focus and turn LCD as soon as it loses focus. The cause is unknown. None of these helped: an opaque background, square corners, no shadow or border, `overflow: visible`, rounded `left`/`top`, or re-showing the submenu. The theme leaves it as is.

## Mobile

- **Android** renders with the Android System WebView (Chromium) and **iOS** with WebKit. Both use **_grayscale AA only_**. On high-density screens the difference is hardly visible, so the layer fixes don't matter there.
- A font set in Settings → Appearance applies only if it is installed on the device. Otherwise the system font is used (Roboto on Android, San Francisco on iOS).
- To use the same font everywhere, ship it with the theme as `.woff2` and load it with `@font-face`. The theme folder syncs to mobile.

## References

- [Chromium: lcd_text_disallowed_reason.h](https://chromium.googlesource.com/chromium/src/+/main/cc/raster/lcd_text_disallowed_reason.h): reasons a layer loses LCD text.
- [Chromium: font_render_params_linux.cc](https://chromium.googlesource.com/chromium/src/+/main/ui/gfx/font_render_params_linux.cc): how Linux font settings are resolved.
- [Chromium: ui/gfx/switches.cc](https://chromium.googlesource.com/chromium/src/+/main/ui/gfx/switches.cc): font-related switches.
- [fontconfig user documentation](https://www.freedesktop.org/software/fontconfig/fontconfig-user.html): properties and rule syntax.
- [VS Code issue #75615](https://github.com/microsoft/vscode/issues/75615): the same menu problem in another Electron app.
