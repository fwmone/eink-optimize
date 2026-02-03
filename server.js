import express from "express";
import multer from "multer";
import { createCanvas, loadImage } from "canvas";
import { ditherImage, getDefaultPalettes, getDeviceColors, replaceColors } from 'epdoptimize';

const app = express();
app.use(express.json({ limit: "25mb" })); // JSON bodies (imageUrl mode)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

// Healthcheck
app.get("/health", (_req, res) => res.json({ ok: true }));

// Helper: parse numbers safely (multipart fields come as strings)
const num = (v, fallback) => {
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

app.post("/optimize", upload.single("image"), async (req, res) => {
  // Help functions for image optimization
  function clamp255(v) { return v < 0 ? 0 : (v > 255 ? 255 : v); }

    // Lift only in dark areas, with a gentle ramp
  function liftShadowsSoft(imageData, lift = 10, threshold = 90) {
    const d = imageData.data;

    for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i+1], b = d[i+2];
        const y = 0.2126*r + 0.7152*g + 0.0722*b;

      if (y >= threshold) continue;

        // Ramp: the darker, the more lift
        const t = 1 - (y / threshold);          // 0..1
        const amt = lift * (t * t);             // softer (square)

        d[i]   = clamp255(Math.round(r + amt));
        d[i+1] = clamp255(Math.round(g + amt));
        d[i+2] = clamp255(Math.round(b + amt));
    }
  }

    // Gamma on luma (gamma < 1 => brighter)
  function applyGammaOnLuma(imageData, gamma = 0.85) {
    const d = imageData.data;
    const lut = new Uint8ClampedArray(256);

    for (let i = 0; i < 256; i++) {
      const x = i / 255;
      lut[i] = Math.round(Math.pow(x, gamma) * 255);
    }

    for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i+1], b = d[i+2];
        const y0 = Math.round(0.2126*r + 0.7152*g + 0.0722*b);
      const y1 = lut[y0];
      if (y0 === 0) continue;

      const s = y1 / y0;
        d[i]   = clamp255(Math.round(r * s));
        d[i+1] = clamp255(Math.round(g * s));
        d[i+2] = clamp255(Math.round(b * s));
    }
  }

  function applySaturation(imageData, factor = 1.3) {
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i+1], b = d[i+2];
        const gray = 0.2126*r + 0.7152*g + 0.0722*b;
        d[i]   = clamp255(Math.round(gray + (r - gray) * factor));
        d[i+1] = clamp255(Math.round(gray + (g - gray) * factor));
        d[i+2] = clamp255(Math.round(gray + (b - gray) * factor));
    }
  }

  try {
    // Works for both JSON and multipart:
    // - JSON: req.body is object
    // - multipart: req.body fields are strings
    const imageUrl = req.body?.imageUrl;

    const outW = num(req.body?.outW, 1200);
    const outH = num(req.body?.outH, 1600);
    const fit = (req.body?.fit ?? "contain"); // cover | contain
    const format = (req.body?.format ?? "jpeg"); // png | jpeg

    const gamma = num(req.body?.gamma, 0.9);
    const saturation = num(req.body?.saturation, 1.1);
    const lift = num(req.body?.lift, 10);
    const liftThreshold = num(req.body?.liftThreshold, 90);

    const epd_optimize = String(req.body?.epd_optimize ?? "false") === "true";
    const color_optimize = String(req.body?.color_optimize ?? "true") !== "false";

    // 1) Load image: either uploaded file or URL
    let img;
    if (req.file?.buffer) {
      img = await loadImage(req.file.buffer);
    } else if (imageUrl) {
      img = await loadImage(imageUrl);
    } else {
      return res.status(400).json({
        error: "Provide either imageUrl (JSON) or an uploaded file field named 'image' (multipart/form-data).",
      });
    }

    // 2) Input canvas
    const inputCanvas = createCanvas(outW, outH);
    const ictx = inputCanvas.getContext("2d");

    // optional: white background (otherwise black borders may appear with contain)
    ictx.fillStyle = "#FFFFFF";
    ictx.fillRect(0, 0, outW, outH);

    // Scale and draw image
    const scaleContain = Math.min(outW / img.width, outH / img.height);
    const scaleCover = Math.max(outW / img.width, outH / img.height);
    const scale = fit === "cover" ? scaleCover : scaleContain;

    const drawW = Math.round(img.width * scale);
    const drawH = Math.round(img.height * scale);
    const dx = Math.floor((outW - drawW) / 2);
    const dy = Math.floor((outH - drawH) / 2);

    ictx.imageSmoothingEnabled = true;
    ictx.imageSmoothingQuality = "high";
    ictx.drawImage(img, dx, dy, drawW, drawH);

    if (color_optimize) {
      let imageData = ictx.getImageData(0, 0, outW, outH);

      liftShadowsSoft(imageData, lift, liftThreshold); 
      applyGammaOnLuma(imageData, gamma);
      applySaturation(imageData, saturation);

      ictx.putImageData(imageData, 0, 0);
    }

    let buf;

    if (epd_optimize) {
      // 2) Output canvases
      const ditheredCanvas = createCanvas(outW, outH);
      const preparedCanvas = createCanvas(outW, outH);

      // Spectra6 Palette
      const paletteName = display;
      const deviceColorsName = display;
      const palette = getDefaultPalettes(paletteName);

      const myPalette = [
        "#2d233b", // black
        "#b0bfc6", // white
        "#a92d2d", // red
        "#518167", // green
        "#2967ba", // blue
      ];      

      const deviceColors = getDeviceColors(deviceColorsName);
      // const options = getDitherOptions();
      const options = {
          algorithm: 'floydSteinberg',
          palette: myPalette,
      };

      ditherImage(inputCanvas, ditheredCanvas, options);

      // Map device-native colors
      replaceColors(ditheredCanvas, preparedCanvas, {
        originalColors: palette,
        replaceColors: deviceColors
      });

      buf = preparedCanvas.toBuffer("image/" + format, { quality: 0.92 });
    } else {
      buf = inputCanvas.toBuffer("image/" + format, { quality: 0.98 });
    }

    res.setHeader("Content-Type", "image/" + format);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(buf);

  } catch (err) {
    return res.status(500).json({ error: String(err?.message ?? err) });
  }
});

const PORT = process.env.PORT || 3030;
app.listen(PORT, () => console.log(`eink-optimize listening on :${PORT}`));
