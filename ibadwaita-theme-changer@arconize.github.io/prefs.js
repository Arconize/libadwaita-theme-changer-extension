import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Gtk from "gi://Gtk";

import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/prefs.js";

// Import the applyTheme function from extension.js
import { applyTheme } from "./extension.js";

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
      null,
    );
    let info;
    while ((info = enumerator.next_file(null)) !== null) {
      if (info.get_file_type() === Gio.FileType.DIRECTORY) {
        const name = info.get_name();
        const gtk4Dir = Gio.File.new_for_path(
          `${themesDirPath}/${name}/gtk-4.0`,
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
    const settings = this.getSettings();

    const page = new Adw.PreferencesPage();
    const group = new Adw.PreferencesGroup({
      title: "Select Libadwaita Theme",
      description: "Applied instantly. Restart apps to see changes.",
    });

    const themes = listThemes();
    const currentTheme = settings.get_string("active-theme");

    // Keep track of radio buttons so only one can be active
    let lastCheckButton = null;

    for (const theme of themes) {
      const row = new Adw.ActionRow({ title: theme });

      const check = new Gtk.CheckButton({
        active: theme === currentTheme,
        valign: Gtk.Align.CENTER,
      });

      // Group radio buttons together
      if (lastCheckButton) {
        check.group = lastCheckButton;
      }
      lastCheckButton = check;

      // When the user clicks a theme
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
      // Remove symlinks
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

      // Refresh the window
      window.close();
    });

    resetRow.add_suffix(resetButton);
    group.add(resetRow);

    page.add(group);
    window.add(page);
  }
}
