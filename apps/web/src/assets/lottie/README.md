# Lottie animations

Drop the JSON files in this folder. The `<Anim name="...">` component
finds them automatically via Vite's eager glob import — no code change
needed when you add or replace a file.

## Files expected (9)

Filename must match **exactly** (lowercase, hyphens, `.json`). If a
file is missing, `<Anim>` falls back to a tinted circle with a glyph
so the page still works — but check the dev-console for warnings.

| Filename                | Where it shows up                                                                 | Recommended style                                |
| ----------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------ |
| `success.json`          | Save / submit / mark-as-paid toasts. One-shot, plays once.                       | Animated tick / checkmark. 1–2 seconds.          |
| `error.json`            | Failed save, API errors, validation. One-shot.                                    | Red cross or warning shake. 1 second.            |
| `empty.json`            | Empty lists ("0 students", "no periods configured", "no search results").        | Friendly illustration — empty box, clipboard, etc. Loops gently. |
| `loading.json`          | Generic page-level loader (replaces "Loading…" text on slow queries). Loops.      | Small spinner with personality. Stays small (~60–80px). |
| `processing.json`       | Long-running ops: Smart Allot, CSV import, export, bulk operations. Loops.       | Gears / sparkles / progress arc. Larger (~150–200px). |
| `payment-success.json`  | Parent-facing `/pay/success` page after HDFC checkout. One-shot, celebratory.    | ₹ symbol + tick, or confetti. 2–3 seconds.       |
| `payment-failed.json`   | Parent-facing `/pay/failure` page. One-shot.                                      | ₹ symbol + cross, or sad coin. 1–2 seconds.      |
| `whatsapp-sent.json`    | WhatsApp dispatch confirmations + log row "delivered" state. One-shot.           | Paper plane → green check. 1–1.5 seconds.        |
| `delete.json`           | Delete confirmations + "deleted" toasts. One-shot.                                | Red bin / trash lid opening. 1 second.           |

## Format notes

- Plain Lottie **JSON** (not `.lottie` zip format). lottie-react reads
  JSON natively.
- Try to keep each file under ~50 KB. Strip unused layers in LottieFiles
  editor before exporting if needed.
- Colour palette suggestions (Crestly brand):
  - Success / WhatsApp: green `#16a34a` or `#25D366`
  - Error / Delete: red `#b91c1c`
  - Loading / Empty / Processing: orange `#f97316` accents on cream/ink
- Transparent background.

## Usage in code (already wired)

```tsx
import { Anim } from "@/components/Anim";

<Anim name="success" size={120} />                  // one-shot
<Anim name="loading" size={64} />                   // auto-loops
<Anim name="success" onComplete={() => close()} />  // fire after end
```

Once you drop the files, the existing pages that already use `<Anim>`
pick them up on next hot-reload — no further changes needed.
