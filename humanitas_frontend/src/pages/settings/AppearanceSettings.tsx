import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/design-system/PageHeader";
import { Sun, Moon, Laptop, Check } from "lucide-react";
import { useTheme } from "next-themes";

interface ColorPreset {
  name: string;
  label: string;
  oklchLight: string;
  oklchDark: string;
  previewClass: string;
}

const COLOR_PRESETS: ColorPreset[] = [
  {
    name: "gold",
    label: "Shiny Gold (Default)",
    oklchLight: "oklch(0.74 0.16 85)",
    oklchDark: "oklch(0.78 0.16 85)",
    previewClass: "gold-gradient",
  },
  {
    name: "emerald",
    label: "Deep Emerald",
    oklchLight: "oklch(0.55 0.18 155)",
    oklchDark: "oklch(0.65 0.17 155)",
    previewClass: "bg-emerald-600",
  },
  {
    name: "indigo",
    label: "Royal Indigo",
    oklchLight: "oklch(0.52 0.22 280)",
    oklchDark: "oklch(0.62 0.2 280)",
    previewClass: "bg-indigo-600",
  },
  {
    name: "amber",
    label: "Warm Amber",
    oklchLight: "oklch(0.65 0.18 75)",
    oklchDark: "oklch(0.72 0.16 75)",
    previewClass: "bg-amber-500",
  },
  {
    name: "teal",
    label: "Nordic Teal",
    oklchLight: "oklch(0.55 0.16 195)",
    oklchDark: "oklch(0.65 0.15 195)",
    previewClass: "bg-teal-600",
  },
  {
    name: "blue",
    label: "Corporate Blue",
    oklchLight: "oklch(0.55 0.2 260)",
    oklchDark: "oklch(0.62 0.19 260)",
    previewClass: "bg-blue-600",
  },
];

export const AppearanceSettings: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const [selectedColor, setSelectedColor] = useState<string>("gold");
  const [density, setDensity] = useState<"compact" | "comfortable" | "spacious">("comfortable");

  // Load saved preferences
  useEffect(() => {
    const savedColor = localStorage.getItem("humanitas_brand_color") || "gold";
    const savedDensity = (localStorage.getItem("humanitas_density") as any) || "comfortable";
    setSelectedColor(savedColor);
    setDensity(savedDensity);
    applyColorPreset(savedColor);
    applyDensity(savedDensity);
  }, []);

  const applyColorPreset = (colorName: string) => {
    const preset = COLOR_PRESETS.find((p) => p.name === colorName) || COLOR_PRESETS[0];
    const isDark = document.documentElement.classList.contains("dark");
    const chosenOklch = isDark ? preset.oklchDark : preset.oklchLight;

    document.documentElement.style.setProperty("--primary", chosenOklch);
    document.documentElement.style.setProperty("--ring", chosenOklch);
    localStorage.setItem("humanitas_brand_color", colorName);
    setSelectedColor(colorName);
  };

  const applyDensity = (densityPreset: "compact" | "comfortable" | "spacious") => {
    document.body.classList.remove("density-compact", "density-comfortable", "density-spacious");
    document.body.classList.add(`density-${densityPreset}`);
    localStorage.setItem("humanitas_density", densityPreset);
    setDensity(densityPreset);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8 animate-fadeIn">
      <PageHeader
        title="Appearance & Theme"
        description="Customize the visual theme, primary brand colors, and display density for your Humanitas ERP workspace."
        breadcrumbs={[
          { label: "Settings", href: "/settings/general" },
          { label: "Appearance" },
        ]}
      />

      {/* Theme Mode Selector */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Theme Mode</h2>
          <p className="text-xs text-muted-foreground">
            Select your preferred interface color mode or synchronize with your device system settings.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div
            onClick={() => setTheme("light")}
            className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center gap-3.5 ${
              theme === "light"
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : "border-border hover:bg-surface-1"
            }`}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <Sun className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Light</p>
              <p className="text-xs text-muted-foreground">Crisp clean contrast</p>
            </div>
            {theme === "light" && <Check className="h-4 w-4 text-primary" />}
          </div>

          <div
            onClick={() => setTheme("dark")}
            className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center gap-3.5 ${
              theme === "dark"
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : "border-border hover:bg-surface-1"
            }`}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
              <Moon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Dark</p>
              <p className="text-xs text-muted-foreground">Deep slate enterprise mode</p>
            </div>
            {theme === "dark" && <Check className="h-4 w-4 text-primary" />}
          </div>

          <div
            onClick={() => setTheme("system")}
            className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center gap-3.5 ${
              theme === "system"
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : "border-border hover:bg-surface-1"
            }`}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-500/10 text-slate-500">
              <Laptop className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">System Auto</p>
              <p className="text-xs text-muted-foreground">Follows OS setting</p>
            </div>
            {theme === "system" && <Check className="h-4 w-4 text-primary" />}
          </div>
        </div>
      </div>

      {/* Brand Accent Color */}
      <div className="space-y-4 pt-6 border-t border-border">
        <div>
          <h2 className="text-base font-semibold text-foreground">Primary Brand Accent</h2>
          <p className="text-xs text-muted-foreground">
            Choose your organization's primary accent color across buttons, active tabs, and highlighted elements.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {COLOR_PRESETS.map((preset) => {
            const isSelected = selectedColor === preset.name;
            return (
              <div
                key={preset.name}
                onClick={() => applyColorPreset(preset.name)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30 shadow-xs"
                    : "border-border hover:bg-surface-1"
                }`}
              >
                <div className={`h-6 w-6 rounded-full shrink-0 ${preset.previewClass} shadow-xs`} />
                <span className="text-xs font-semibold text-foreground flex-1 truncate">
                  {preset.label}
                </span>
                {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Display Density */}
      <div className="space-y-4 pt-6 border-t border-border">
        <div>
          <h2 className="text-base font-semibold text-foreground">Interface Density</h2>
          <p className="text-xs text-muted-foreground">
            Control the spacing, padding, and row heights across all enterprise data tables and forms.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div
            onClick={() => applyDensity("compact")}
            className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center gap-3.5 ${
              density === "compact"
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : "border-border hover:bg-surface-1"
            }`}
          >
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Compact</p>
              <p className="text-xs text-muted-foreground">Maximum data on screen</p>
            </div>
            {density === "compact" && <Check className="h-4 w-4 text-primary" />}
          </div>

          <div
            onClick={() => applyDensity("comfortable")}
            className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center gap-3.5 ${
              density === "comfortable"
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : "border-border hover:bg-surface-1"
            }`}
          >
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Comfortable</p>
              <p className="text-xs text-muted-foreground">Balanced spacing (Default)</p>
            </div>
            {density === "comfortable" && <Check className="h-4 w-4 text-primary" />}
          </div>

          <div
            onClick={() => applyDensity("spacious")}
            className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center gap-3.5 ${
              density === "spacious"
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : "border-border hover:bg-surface-1"
            }`}
          >
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Spacious</p>
              <p className="text-xs text-muted-foreground">Touch-friendly relaxed spacing</p>
            </div>
            {density === "spacious" && <Check className="h-4 w-4 text-primary" />}
          </div>
        </div>
      </div>
    </div>
  );
};
