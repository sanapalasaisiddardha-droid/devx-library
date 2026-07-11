# DevX — Landing Page

A premium, cinematic landing page built with **React + Vite + Tailwind CSS + Framer Motion**.

## Features
- Smooth cinematic hero with scroll-driven exit (`useScroll` + `useTransform`)
- Dark futuristic background: animated gradient blobs + film-grain noise
- Mouse-parallax across the whole scene (spring-smoothed `MotionValue`s)
- Glassmorphism cards: backdrop blur, transparent layers, soft border glow, shadows
- Floating book-cover cards drifting in 3D space (Y-axis loop)
- Staggered fade + slide reveal animations (`whileInView`, variants)
- Category filter with animated enter/exit (`AnimatePresence`, layout)
- Fully responsive (desktop / tablet / mobile), transform-only for 60fps

## Structure
```
landing/
├─ index.html
├─ vite.config.js
├─ tailwind.config.js
├─ postcss.config.js
├─ gen-data.mjs            # regenerates src/data/books.js from ../data.js
├─ public/covers/         # book covers (copied from ../covers)
└─ src/
   ├─ main.jsx
   ├─ App.jsx             # holds shared mouse-parallax MotionValues
   ├─ index.css           # Tailwind + glass/gradient/noise utilities
   ├─ data/books.js       # AUTO-GENERATED book data
   └─ components/
      ├─ AnimatedBackground.jsx
      ├─ FloatingCard.jsx
      ├─ Hero.jsx
      ├─ Navbar.jsx
      ├─ Features.jsx
      ├─ LibraryGrid.jsx
      └─ Footer.jsx
```

## Run
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
npm run preview  # preview the production build
```

## Updating the book list
Edit `../data.js` (the source of truth), then:
```bash
node gen-data.mjs        # regenerate src/data/books.js
cp ../covers/*.jpg public/covers/   # refresh covers if changed
```
