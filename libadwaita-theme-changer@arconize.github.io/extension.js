import Gio from "gi://Gio";
import GLib from "gi://GLib";

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

// ── File paths ────────────────────────────────────────────────────
function getPaths() {
  const home = GLib.get_home_dir();
  return {
    themesDir: `${home}/.themes`,
    gtk4Dir: `${home}/.config/gtk-4.0`,
    symlinks: [
      ["gtk-4.0/gtk.css", `${home}/.config/gtk-4.0/gtk.css`],
      ["gtk-4.0/gtk-dark.css", `${home}/.config/gtk-4.0/gtk-dark.css`],
      ["gtk-4.0/assets", `${home}/.config/gtk-4.0/assets`],
      ["assets", `${home}/.config/assets`],
    ],
  };
}

// ── Recursively delete a file or directory ─────────────────────────
function deleteRecursive(file) {
  const info = file.query_info(
    "standard::type,standard::is-symlink",
    Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
    null,
  );
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

function tryDelete(path) {
  const file = Gio.File.new_for_path(path);
  try {
    deleteRecursive(file);
  } catch (e) {
    /* ignore */
  }
}

// ── Apply a theme ─────────────────────────────────────────────────
export function applyTheme(themeName) {
  const paths = getPaths();

  // Remove existing
  for (const [, linkPath] of paths.symlinks) {
    tryDelete(linkPath);
  }

  // Ensure gtk-4.0 directory exists
  const gtk4Dir = Gio.File.new_for_path(paths.gtk4Dir);
  try {
    gtk4Dir.make_directory_with_parents(null);
  } catch (e) {
    /* exists */
  }

  // Create new symlinks
  for (const [relTarget, linkPath] of paths.symlinks) {
    const targetPath = `${paths.themesDir}/${themeName}/${relTarget}`;
    const targetFile = Gio.File.new_for_path(targetPath);

    if (!targetFile.query_exists(null)) continue;

    const linkFile = Gio.File.new_for_path(linkPath);
    try {
      linkFile.make_symbolic_link(targetPath, null);
    } catch (e) {
      log(`Failed to create symlink ${linkPath}: ${e.message}`);
    }
  }
}

// ── Extension entry points ────────────────────────────────────────
export default class LibadwaitaThemeChangerExtension extends Extension {
  enable() {
    // Pass the schema ID explicitly
    this._settings = this.getSettings(
      "org.gnome.shell.extensions.libadwaita-theme-changer",
    );

    // Apply the saved theme on login/startup
    const savedTheme = this._settings.get_string("active-theme");
    if (savedTheme && savedTheme !== "") {
      applyTheme(savedTheme);
    }
  }

  disable() {
    this._settings = null;
  }
}
