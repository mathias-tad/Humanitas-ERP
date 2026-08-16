
import { useEffect, useState } from "react";
import { usePMS } from "@/hooks/usePMS";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


// Convert OKLCH to Hex for input[type=color] if possible, or just use text input for OKLCH
// Since our system uses OKLCH, converting is hard without a library.
// For now, we will allow users to pick a color using a predefined palette or simple HEX and we convert (or just use Hex if Tailwind supports it).
// Tailwind v4 CSS vars support Hex.

export function AppearanceSettings({ disabled }: { disabled?: boolean }) {
    const { useThemeSettings, updateTheme } = usePMS();
    const { data: theme, isLoading } = useThemeSettings();

    const [primaryColor, setPrimaryColor] = useState("");
    const [radius, setRadius] = useState("0.5rem");
    const [fontFamily, setFontFamily] = useState("Inter");

    useEffect(() => {
        if (theme) {
            if (theme.primary_color) setPrimaryColor(theme.primary_color);
            if (theme.radius) setRadius(theme.radius);
            if (theme.font_family) setFontFamily(theme.font_family);
        }
    }, [theme]);

    const handleSave = async () => {
        try {
            await updateTheme.mutateAsync({
                primary_color: primaryColor,
                radius,
                font_family: fontFamily,
            });
        } catch (error) {
            console.error(error);
        }
    };

    const PRESETS = [
        { name: "Gold", value: "oklch(0.75 0.18 75)" },
        { name: "Zinc", value: "oklch(0.21 0.034 264.665)" },
        { name: "Red", value: "oklch(0.637 0.237 25.331)" },
        { name: "Blue", value: "oklch(0.546 0.245 262.881)" },
        { name: "Green", value: "oklch(0.627 0.194 149.214)" },
        { name: "Orange", value: "oklch(0.705 0.213 47.604)" },
    ];

    if (isLoading) return <div>Loading settings...</div>;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Appearance</CardTitle>
                    <CardDescription>
                        Customize the look and feel of your workspace.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">

                    <div className="space-y-4">
                        <Label>Primary Color</Label>
                        <div className="flex flex-wrap gap-3">
                            {PRESETS.map((preset) => (
                                <button
                                    key={preset.name}
                                    onClick={() => !disabled && setPrimaryColor(preset.value)}
                                    className={`w-10 h-10 rounded-full border-2 transition-all ${primaryColor === preset.value ? "border-primary ring-2 ring-primary ring-offset-2" : "border-transparent"
                                        }`}
                                    style={{ background: preset.value }}
                                    title={preset.name}
                                    disabled={disabled}
                                />
                            ))}
                        </div>
                        <div className="flex gap-2 items-center max-w-sm mt-2">
                            <Label className="text-xs text-muted-foreground w-20">Custom Value:</Label>
                            <Input
                                value={primaryColor}
                                onChange={(e) => setPrimaryColor(e.target.value)}
                                disabled={disabled}
                                placeholder="e.g. oklch(0.75 0.18 75) or #FFD700"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <Label>Border Radius</Label>
                        <div className="max-w-sm">
                            <Select value={radius} onValueChange={setRadius} disabled={disabled}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select radius" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0">None (0px)</SelectItem>
                                    <SelectItem value="0.3rem">Small (0.3rem)</SelectItem>
                                    <SelectItem value="0.5rem">Medium (0.5rem)</SelectItem>
                                    <SelectItem value="0.75rem">Large (0.75rem)</SelectItem>
                                    <SelectItem value="1rem">Extra Large (1rem)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* 
          <div className="space-y-4">
            <Label>Font Family</Label>
            <div className="max-w-sm">
                <Select value={fontFamily} onValueChange={setFontFamily} disabled={disabled}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select font" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Inter">Inter</SelectItem>
                    <SelectItem value="System">System UI</SelectItem>
                  </SelectContent>
                </Select>
            </div>
          </div> 
          */}

                    <div className="flex justify-end">
                        <Button onClick={handleSave} disabled={disabled || updateTheme.isPending}>
                            {updateTheme.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
