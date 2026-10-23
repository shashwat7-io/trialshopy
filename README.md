# TRIALSHOPY — AI Virtual Try-On Studio

<p align="center">
  <img src="public/logo.png" alt="TRIALSHOPY Logo" width="80" />
</p>

<p align="center">
  <strong>Try clothes on yourself in real-time using your camera and AI.</strong>
</p>

---

## ✨ Features

- **Live Camera Mirror** — See yourself in a mirrored webcam feed with body tracking via MediaPipe Pose
- **Instant Preview** — Select any garment and see a live colour-blend overlay on your body at 60fps
- **AI Virtual Try-On** — Click "AI Try-On" to generate a photorealistic image of you wearing the garment using the IDM-VTON AI model (via HuggingFace Spaces)
- **12 Sample Garments** — T-shirts, shirts, jackets, hoodies, and trousers with colours, sizes, and pricing
- **Search & Filter** — Find garments by name, brand, or category
- **Save & Download** — Save your favourite looks to localStorage or download as JPEG
- **No Backend Required** — Everything runs in the browser (AI calls go directly to HuggingFace)

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| **React 18** + **TypeScript** | UI framework |
| **Vite** | Build tool & dev server |
| **Tailwind CSS** | Styling |
| **MediaPipe Pose** | Real-time body landmark detection |
| **@gradio/client** | HuggingFace Spaces API client |
| **IDM-VTON** | AI virtual try-on model |
| **Lucide React** | Icon library |

## 📁 Project Structure

```
src/
├── components/
│   ├── Navbar.tsx            # Top navigation bar
│   ├── ClothingSidebar.tsx   # Left garment library panel
│   ├── ClothingCard.tsx      # Individual garment card
│   ├── VirtualMirror.tsx     # Live camera + AI result display
│   ├── OutfitControls.tsx    # Right panel: garment details + AI Try-On
│   ├── SavedLooksGallery.tsx # Saved looks grid
│   └── TryOnResult.tsx       # Try-on result modal (drag-to-compare)
├── hooks/
│   ├── useCamera.ts          # Camera access, device switching, photo capture
│   └── usePoseDetection.ts   # MediaPipe Pose landmark detection
├── services/
│   └── tryOnService.ts       # HuggingFace Spaces AI try-on API
├── data/
│   └── garments.ts           # Sample garment catalog (12 items)
├── types/
│   └── index.ts              # TypeScript type definitions
├── App.tsx                   # Root app component
├── main.tsx                  # Entry point
└── index.css                 # Global styles + design system
```

## 🎯 How It Works

1. **Start Camera** → Webcam activates with mirrored feed
2. **Select a Garment** → Instant colour-blend preview overlays on your body
3. **Click "AI Try-On"** → Captures your frame → sends to IDM-VTON via HuggingFace → returns photorealistic result
4. **Save / Download** → Keep your favourite looks

## 📝 License

MIT

## Deploy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/shashwat7-io/trialshopy)

Deploys as a free Render **Static Site** using `render.yaml` (HTTPS is required for camera access).
