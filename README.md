# Libadwaita Theme Changer - GNOME Shell Extension

A GNOME Shell extension to easily change Libadwaita/GTK4 themes directly from the system panel, using symbolic links.

![Alt text](screenshots/screenshot.png)

## 🙏 Credits & Inspiration

This extension is a GNOME Shell port of the original **Libadwaita Theme Changer** Python CLI tool created by **OdzioM**.

All the logic for how the themes are applied (by symlinking `gtk.css`, `gtk-dark.css`, and `assets` from `~/.themes` to `~/.config/gtk-4.0/`) comes directly from their work.

- **Original Python Script:** [https://github.com/odziom91/libadwaita-theme-changer](https://github.com/odziom91/libadwaita-theme-changer)
- **Original Author:** [odzioM91](https://github.com/odziom91)

## ✨ Features

- Change Libadwaita/GTK4 themes from a convenient panel menu.
- Automatically detects currently active theme.
- Only shows themes that actually contain a `gtk-4.0` directory.
- One-click "Reset to Default" to remove all theme overrides.
- No background processes — runs only when you click the menu.

## ⚠️ Requirements

- **GNOME Shell 45, 46, 47, or 48** (Uses the new ESM import system).
- Themes must be placed in `~/.themes/<ThemeName>/gtk-4.0/`.

## 📦 Manual Installation

1. Clone this repository:
    
    ```bash
    git clone https://github.com/Arconize/libadwaita-theme-changer-extension.git
    ```
    

2. Copy the extension to your local GNOME extensions directory:
    
    ```bash
    cp -r libadwaita-theme-changer-extension/libadwaita-theme-changer@arconize.github.io ~/.local/share/gnome-shell/extensions/
    ```
    
3. Restart GNOME Shell:
    - **On X11:** Press `Alt+F2`, type `r`, and press Enter.
    - **On Wayland:** Log out and log back in.
4. Enable the extension:
    
    ```bash
    gnome-extensions enable libadwaita-theme-changer@arconize.github.io
    ```

## 🛠️ How it works

Just like the original Python script, this extension changes your Libadwaita theme by:

1. Deleting existing files/symlinks in `~/.config/gtk-4.0/` and `~/.config/assets`.
2. Creating new symbolic links pointing to the selected theme's `gtk-4.0` folder contents.

**Note:** You must restart running applications to see the theme changes take effect.
