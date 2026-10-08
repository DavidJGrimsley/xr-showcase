# XR Showcase Style

Use a coherent dark control shell across the three experiences. Qubit mirrors the inspected Unreal project: cyan translucent sphere and axis/ring geometry, magenta arrow and state point, warm pale labels, mint-bordered dark guess/reset controls, green win and red loss feedback, and a clear hardware status line with a pulsing state marker. Rebuild geometry with Viro primitives rather than importing Unreal .uasset files. Normalize the globe to about 0.25m diameter on a tabletop while preserving relative proportions and label offsets. Map Unreal Z-up coordinates to Viro Y-up and keep |0⟩ above |1⟩. Never animate or force the phone's AR camera.

Use responsive safe-area layouts and accessible touch targets instead of copying desktop canvas offsets. Keep view space clear for AR; group simulator and hardware guess controls in a compact bottom HUD with Reset and Home. Native home cards introduce the three experiences. Medical labels remain readable and calibrated to the model; Arena overlays expose health/winner/restart without competing with the scene.

Uniwind styles shared React Native screens and HUD surfaces. Expo UI native/universal controls use their supported APIs/modifiers, not Uniwind classes. Avoid duplicated style systems on the same component. Respect reduced motion in native UI while preserving necessary gate/collapse explanations.

## Typography and Accessibility
Use the system font for native controls and readable, high-contrast labels. Respect Dynamic Type, safe areas, reduced motion and minimum 44pt touch targets on iOS. Win/loss and loading states must have text as well as color.

## Theme Source
Editable native theme tokens remain in project/theme.json and src/theme/tokens.ts. The temporary Stylist tool is retained for development; its preview tokens do not override the confirmed cyan/magenta Qubit reference or the native-control styling boundary.

<!-- MDS_STYLIST_THEME_START -->
## Canonical Theme Tokens (Managed by Stylist)

The block below mirrors `project/theme.json` and is managed by `mds stylist sync`.

```json
{
  "version": 1,
  "colorSystem": {
    "mode": "bg",
    "previewScheme": "light",
    "familyMode": "one"
  },
  "families": {
    "light": {
      "primary": "blue",
      "secondary": "violet",
      "success": "emerald",
      "warning": "amber"
    },
    "dark": {
      "primary": "blue",
      "secondary": "violet",
      "success": "emerald",
      "warning": "amber"
    }
  },
  "palettes": {
    "bg": {
      "light": {
        "background": "#f8fafc",
        "surface": "#e2e8f0",
        "text": "#111827",
        "primary": "#2563eb",
        "secondary": "#7c3aed",
        "success": "#16a34a",
        "warning": "#f97316"
      },
      "dark": {
        "background": "#09090b",
        "surface": "#18181b",
        "text": "#f8fafc",
        "primary": "#60a5fa",
        "secondary": "#a78bfa",
        "success": "#4ade80",
        "warning": "#fb923c"
      }
    },
    "automatic": {
      "light": {
        "background": "#eff6ff",
        "surface": "#dbeafe",
        "text": "#1e3a8a",
        "primary": "#3b82f6",
        "secondary": "#8b5cf6",
        "success": "#10b981",
        "warning": "#f59e0b"
      },
      "dark": {
        "background": "#172554",
        "surface": "#1e3a8a",
        "text": "#eff6ff",
        "primary": "#60a5fa",
        "secondary": "#a78bfa",
        "success": "#34d399",
        "warning": "#fbbf24"
      }
    }
  },
  "colors": {
    "light": {
      "background": "#f8fafc",
      "surface": "#e2e8f0",
      "text": "#111827",
      "primary": "#2563eb",
      "secondary": "#7c3aed",
      "success": "#16a34a",
      "warning": "#f97316"
    },
    "dark": {
      "background": "#09090b",
      "surface": "#18181b",
      "text": "#f8fafc",
      "primary": "#60a5fa",
      "secondary": "#a78bfa",
      "success": "#4ade80",
      "warning": "#fb923c"
    }
  },
  "typography": {
    "fontFamily": "System",
    "fontDisplay": "System",
    "fontTitle": "System",
    "fontSubtitle": "System",
    "fontBody": "System",
    "fontCaption": "System",
    "fontMono": "monospace",
    "displaySize": 32,
    "headingSize": 20,
    "bodySize": 15,
    "captionSize": 12
  },
  "layout": {
    "radius": 12,
    "spacing": {
      "xs": 4,
      "sm": 8,
      "md": 16,
      "lg": 24,
      "xl": 32
    }
  }
}
```
<!-- MDS_STYLIST_THEME_END -->
