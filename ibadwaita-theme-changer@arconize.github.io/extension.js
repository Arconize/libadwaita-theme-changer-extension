import GObject from "gi://GObject";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import St from "gi://St";

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";

// ── File paths used by the extension ──────────────────────────────
function getPaths() {
  const home = GLib.get_home_dir();
  return {
    themesDir: `${home}/.themes`,
    configDir: `${home}/.config`,
    gtk4Dir: `${home}/.config/gtk-4.0`,
    symlinks: [
      // [target_inside_theme,  link_path]
      ["gtk-4.0/gtk.css", `${home}/.config/gtk-4.0/gtk.css`],
      ["gtk-4.0/gtk-dark.css", `${home}/.config/gtk-4.0/gtk-dark.css`],
      ["gtk-4.0/assets", `${home}/.config/gtk-4.0/assets`],
      ["assets", `${home}/.config/assets`],
    ],
  };
}

// ── Recursively delete a file or directory (like rm -rf) ─────────
function deleteRecursive(file) {
  const info = file.query_info(
    "standard::type,standard::is-symlink",
    Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
    null,
  );

  // If it's a real directory (not a symlink), delete children first
  if (
    info.get_file_type() === Gio.FileType.DIRECTORY &&
    !info.get_is_symlink()
  ) {
    const enumerator = file.enumerate_children(
      "standard::name,standard::type,standard::is-symlink",
      Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
      null,
    );
    let childInfo;
    while ((childInfo = enumerator.next_file(null)) !== null) {
      deleteRecursive(file.get_child(childInfo.get_name()));
    }
    enumerator.close(null);
  }

  file.delete(null);
}

// ── Try to delete a file; silently ignore if it doesn't exist ─────
function tryDelete(path) {
  const file = Gio.File.new_for_path(path);
  try {
    deleteRecursive(file);
  } catch (e) {
    // Doesn't exist — that's fine
  }
}

// ── Remove existing symlinks / files ─────────────────────────────
function removeExisting() {
  const paths = getPaths();
  for (const [, linkPath] of paths.symlinks) {
    tryDelete(linkPath);
  }
}

// ── Detect which theme is currently active ───────────────────────
function detectCurrentTheme() {
  const paths = getPaths();
  // Read the gtk.css symlink target to figure out the active theme
  const cssFile = Gio.File.new_for_path(paths.symlinks[0][1]);

  try {
    const info = cssFile.query_info(
      "standard::symlink-target",
      Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
      null,
    );
    const target = info.get_symlink_target(); // e.g. /home/user/.themes/Nordzy/gtk-4.0/gtk.css
    if (target) {
      // Extract theme name:  .themes/<NAME>/gtk-4.0/...
      const match = target.match(/\/\.themes\/([^/]+)\//);
      if (match) return match[1];
    }
  } catch (e) {
    // Not a symlink or doesn't exist
  }
  return null;
}

// ── List available themes (those with a gtk-4.0 subdirectory) ────
function listThemes() {
  const paths = getPaths();
  const themesDir = Gio.File.new_for_path(paths.themesDir);
  const themes = [];

  try {
    const enumerator = themesDir.enumerate_children(
      "standard::name,standard::type",
      Gio.FileQueryInfoFlags.NONE,
      null,
    );
    let info;
    while ((info = enumerator.next_file(null)) !== null) {
      if (info.get_file_type() === Gio.FileType.DIRECTORY) {
        const name = info.get_name();
        const gtk4Dir = Gio.File.new_for_path(
          `${paths.themesDir}/${name}/gtk-4.0`,
        );
        if (gtk4Dir.query_exists(null)) {
          themes.push(name);
        }
      }
    }
    enumerator.close(null);
  } catch (e) {
    // .themes directory doesn't exist yet
  }

  themes.sort((a, b) => a.localeCompare(b));
  return themes;
}

// ── Apply a theme by removing old files and creating new symlinks ─
function applyTheme(themeName) {
  const paths = getPaths();
  removeExisting();

  // Ensure gtk-4.0 config directory exists
  const gtk4Dir = Gio.File.new_for_path(paths.gtk4Dir);
  try {
    gtk4Dir.make_directory_with_parents(null);
  } catch (e) {
    // Already exists
  }

  for (const [relTarget, linkPath] of paths.symlinks) {
    const targetPath = `${paths.themesDir}/${themeName}/${relTarget}`;
    const targetFile = Gio.File.new_for_path(targetPath);

    if (!targetFile.query_exists(null)) {
      log(`LibadwaitaThemeChanger: skipping missing ${targetPath}`);
      continue;
    }

    const linkFile = Gio.File.new_for_path(linkPath);
    try {
      linkFile.make_symbolic_link(targetPath, null);
    } catch (e) {
      log(
        `LibadwaitaThemeChanger: failed to create symlink ${linkPath}: ${e.message}`,
      );
    }
  }
}

// ── Panel Menu Button ────────────────────────────────────────────
const LibadwaitaThemeMenu = GObject.registerClass(
  class LibadwaitaThemeMenu extends PanelMenu.Button {
    _init() {
      super._init(0.5, "Libadwaita Theme Changer");

      const icon = new St.Icon({
        icon_name: "preferences-desktop-theme-symbolic",
        style_class: "system-status-icon",
      });
      this.add_child(icon);

      this._refresh();
    }

    _refresh() {
      this.menu.removeAll();

      const currentTheme = detectCurrentTheme();
      const themes = listThemes();

      // ── Active theme indicator ────────────────────────────
      if (currentTheme) {
        const activeItem = new PopupMenu.PopupMenuItem(
          `✓ Active: ${currentTheme}`,
        );
        activeItem.setSensitive(false);
        activeItem.style_class = "popup-menu-item popup-inactive-menu-item";
        this.menu.addMenuItem(activeItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      }

      // ── Theme list ────────────────────────────────────────
      if (themes.length === 0) {
        const emptyItem = new PopupMenu.PopupMenuItem(
          "No themes found in ~/.themes",
        );
        emptyItem.setSensitive(false);
        this.menu.addMenuItem(emptyItem);
      } else {
        for (const theme of themes) {
          const item = new PopupMenu.PopupMenuItem(theme);
          if (theme === currentTheme) {
            // Mark the current theme with a dot
            item.add_child(
              new St.Icon({
                icon_name: "emblem-ok-symbolic",
                style_class: "popup-menu-icon",
              }),
            );
          }
          item.connect("activate", () => {
            applyTheme(theme);
            this._refresh();

            Main.notify(
              "Libadwaita Theme Changer",
              `Theme "${theme}" applied. Restart apps to see changes.`,
            );
          });
          this.menu.addMenuItem(item);
        }
      }

      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      // ── Reset button ──────────────────────────────────────
      const resetItem = new PopupMenu.PopupMenuItem("Reset to Default");
      resetItem.connect("activate", () => {
        removeExisting();
        this._refresh();
        Main.notify(
          "Libadwaita Theme Changer",
          "Theme reset to default. Restart apps to see changes.",
        );
      });
      this.menu.addMenuItem(resetItem);

      // ── Refresh button ────────────────────────────────────
      const refreshItem = new PopupMenu.PopupMenuItem("Refresh Theme List");
      refreshItem.connect("activate", () => this._refresh());
      this.menu.addMenuItem(refreshItem);
    }

    destroy() {
      super.destroy();
    }
  },
);

// ── Extension entry points ───────────────────────────────────────
export default class LibadwaitaThemeChangerExtension extends Extension {
  enable() {
    this._indicator = new LibadwaitaThemeMenu();
    Main.panel.addToStatusArea("libadwaita-theme-changer", this._indicator);
  }

  disable() {
    if (this._indicator) {
      this._indicator.destroy();
      this._indicator = null;
    }
  }
}
