import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

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
    null
  );
  if (
    info.get_file_type() === Gio.FileType.DIRECTORY &&
    !info.get_is_symlink()
  ) {
    const enumerator = file.enumerate_children(
      "standard::name,standard::type,standard::is-symlink",
      Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
      null
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
function applyTheme(themeName) {
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

// ── List themes ───────────────────────────────────────────────────
function listThemes() {
  const home = GLib.get_home_dir();
  const themesDirPath = `${home}/.themes`;
  const themesDir = Gio.File.new_for_path(themesDirPath);
  const themes = [];

  try {
    const enumerator = themesDir.enumerate_children(
      "standard::name,standard::type",
      Gio.FileQueryInfoFlags.NONE,
      null
    );
    let info;
    while ((info = enumerator.next_file(null)) !== null) {
      if (info.get_file_type() === Gio.FileType.DIRECTORY) {
        const name = info.get_name();
        const gtk4Dir = Gio.File.new_for_path(
          `${themesDirPath}/${name}/gtk-4.0`
        );
        if (gtk4Dir.query_exists(null)) {
          themes.push(name);
        }
      }
    }
    enumerator.close(null);
  } catch (e) {
    /* directory doesn't exist */
  }

  themes.sort((a, b) => a.localeCompare(b));
  return themes;
}

// ── Preferences Window ────────────────────────────────────────────
export default class LibadwaitaThemeChangerPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings('org.gnome.shell.extensions.libadwaita-theme-changer');

    const page = new Adw.PreferencesPage();
    const group = new Adw.PreferencesGroup({
      title: "Select Libadwaita Theme",
      description: "Applied instantly. Restart apps to see changes.",
    });

    const themes = listThemes();
    const currentTheme = settings.get_string("active-theme");

    let lastCheckButton = null;

    for (const theme of themes) {
      const row = new Adw.ActionRow({ title: theme });

      const check = new Gtk.CheckButton({
        active: theme === currentTheme,
        valign: Gtk.Align.CENTER,
      });

      if (lastCheckButton) {
        check.group = lastCheckButton;
      }
      lastCheckButton = check;

      check.connect("toggled", () => {
        if (check.active) {
          applyTheme(theme);
          settings.set_string("active-theme", theme);
        }
      });

      row.add_prefix(check);
      row.set_activatable_widget(check);
      group.add(row);
    }

    // ── Reset Button ──────────────────────────────────────
    const resetRow = new Adw.ActionRow({ title: "Reset to Default" });
    const resetButton = new Gtk.Button({
      label: "Reset",
      valign: Gtk.Align.CENTER,
      css_classes: ["destructive-action"],
    });

    resetButton.connect("clicked", () => {
      const home = GLib.get_home_dir();
      const symlinks = [
        `${home}/.config/gtk-4.0/gtk.css`,
        `${home}/.config/gtk-4.0/gtk-dark.css`,
        `${home}/.config/gtk-4.0/assets`,
        `${home}/.config/assets`,
      ];
      for (const path of symlinks) {
        const file = Gio.File.new_for_path(path);
        try {
          file.delete(null);
        } catch (e) {
          /* ignore */
        }
      }
      settings.set_string("active-theme", "");
      window.close();
    });

    resetRow.add_suffix(resetButton);
    group.add(resetRow);

    page.add(group);
    window.add(page);
  }
}
