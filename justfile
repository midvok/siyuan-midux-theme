#==============================================================================
# justfile - Build and install runner for the Midux SiYuan theme
#==============================================================================
# Description:
# - Compiles src/theme.scss to theme/theme.css with Dart Sass.
# - Links or copies the theme/ package into a SiYuan workspace.
# - The workspace comes from SIYUAN_WORKSPACE (shell or .env file),
#   defaulting to ~/SiYuan. Copy .env.example to .env to set your own.
#
# Usage:
#   just --list          # Show available recipes
#   just build           # Compile once
#   just watch           # Recompile on every save (SiYuan live-reloads)
#   just link            # Build, then symlink theme/ into the workspace (dev)
#   just install         # Build, then copy theme/ into the workspace (synced)
#   just remove          # Remove the installed theme
#   just status          # Show how the theme is installed
#
#   # Use another workspace once
#   just ws="$HOME/SiYuan/New Vault" link
#==============================================================================
set dotenv-load

name := "Midux"
ws := env("SIYUAN_WORKSPACE", env("HOME") / "SiYuan")
target := ws / "data/themes" / name
sass := "sass --no-source-map"

# Compile SCSS to theme/theme.css
build:
    {{sass}} src/theme.scss theme/theme.css

# Recompile on every save
watch:
    {{sass}} --watch src/theme.scss theme/theme.css

# Build, then symlink theme/ into the workspace (development)
link: build
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ -e "{{target}}" && ! -L "{{target}}" ]]; then
        echo "Error: {{target}} is a real folder; run 'just remove' first" >&2
        exit 1
    fi
    mkdir -p "{{ws}}/data/themes"
    ln -sfn "{{justfile_directory()}}/theme" "{{target}}"
    echo "Linked {{target}} -> theme/"

# Build, then copy theme/ into the workspace (synced install)
install: build
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ -L "{{target}}" ]]; then
        rm "{{target}}"
    fi
    mkdir -p "{{target}}"
    cp theme/* "{{target}}/"
    echo "Copied theme/ to {{target}}"

# Remove the installed theme (link or copy)
remove:
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ -L "{{target}}" ]]; then
        rm "{{target}}"
    elif [[ -d "{{target}}" ]]; then
        rm -r "{{target}}"
    else
        echo "Not installed: {{target}}"
        exit 0
    fi
    echo "Removed {{target}}"

# Show how the theme is installed
status:
    #!/usr/bin/env bash
    if [[ -L "{{target}}" ]]; then
        echo "linked: {{target}} -> $(readlink -f "{{target}}")"
    elif [[ -d "{{target}}" ]]; then
        echo "copied: {{target}}"
    else
        echo "not installed: {{target}}"
    fi
