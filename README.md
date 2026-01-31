# eInk picture frame / canvas optimizer

Rudimentary nodeJS service for optimizing photos for Spectra 6 E-Ink displays. 

## 📖 Inhaltsverzeichnis

- [eInk picture frame / canvas optimizer](#eink-picture-frame--canvas-optimizer)
  - [📖 Inhaltsverzeichnis](#-inhaltsverzeichnis)
  - [✨ Features](#-features)
  - [📖 Background](#-background)
  - [📖 Example picture](#-example-picture)
  - [🧩 Requirements](#-requirements)
  - [📦 Installation](#-installation)
    - [Debian: Install system dependencies for node-canvas](#debian-install-system-dependencies-for-node-canvas)
    - [Install Node.js \& npm](#install-nodejs--npm)
    - [Obtain repository](#obtain-repository)
      - [Option A: Clone using Git](#option-a-clone-using-git)
      - [Option B: Download as ZIP](#option-b-download-as-zip)
    - [Install dependencies](#install-dependencies)
    - [Run as a systemd service](#run-as-a-systemd-service)
  - [Usage](#usage)
  - [🚫 Limitations](#-limitations)
  - [🛠️ Development \& status](#️-development--status)
  - [🐞 Report a bug](#-report-a-bug)
  - [🙏 Note](#-note)


## ✨ Features

- nodeJS service
- Provides two REST API endpoints: /health and /optimize
- Returns an image optimized for Spectra 6 E-Ink display
- Offers several settings options for customization to suit your preferences

## 📖 Background

I purchased a [**BLOOMIN8 e-ink picture frame**](https://www.bloomin8.com/) with a Spectra 6 E-Ink display to display photos. To do this, I use my [Home Assistant Custom Component](https://github.com/fwmone/bloomin8_pull), which allows the picture frame to retrieve new photos. The photo quality was dark, colorless, and dull. In addition, the photos had to be scaled correctly. 

I also bought a [**paperlesspaper OpenPaper 7**](https://paperlesspaper.de/), which runs on Spectra 6, too, but has different hardware. For this frame, there is [**EPD Optimize**](https://github.com/Utzel-Butzel/epdoptimize), but it does not work well with the BLOOMIN8 picture frame. 

Therefore, I implemented this nodeJS service to optimize photos for both types of picture frames. After much trial and error, I found this setup and these settings to be optimal for me. However, they can be adjusted to suit your taste.

## 📖 Example picture

- The first picture is the not optimized original. 
- The frame pictures show my BLOOMIN8 13,3" frame in a custom wooden frame with UV70 museum glass (frame is delivered with aluminum frame without glass) in daylight after optimization with the following parameters: ```outW = 1200, outH = 1600, fit = cover, format = jpeg, gamma = 0.85, saturation = 1.15, lift = 13, liftThreshold = 90, epd_optimize = 0, color_optimize = 1```. 
- As you can see, colors are not perfectly accurate and are a bit dull, but look quite well and photo-like in real life. UV70 museum glass makes a huge difference.

![original](./README/original.jpg)
![frame-1](./README/frame-1.jpg)
![frame-2](./README/frame-2.jpg)

## 🧩 Requirements

- Node.js (recommended: current LTS version)
- npm (comes with Node.js; automatically installed with LTS)
- node-canvas
- Cairo and Pango (Linux Debian)
- Optional (recommended): git to clone the repository

Note: If you are unsure which Node version you have, run node -v and npm -v in the terminal.

## 📦 Installation

### Debian: Install system dependencies for node-canvas

```bash
sudo apt update
sudo apt install -y \
  build-essential \
  libcairo2-dev \
  libpango1.0-dev \
  libjpeg-dev \
  libgif-dev \
  librsvg2-dev \
  libpng-dev
```

This allows ```npm install canvas``` to build the native bindings.

### Install Node.js & npm
**Recommended: Node.js LTS**
Install the LTS (Long Term Support) version of Node.js. This will usually give you the most stress-free experience.
- Windows / macOS: Use the installer from the official Node.js website.
- Linux: Depending on your distribution, use either the package manager or (often the cleanest option) NodeSource / nvm.

Check after installation:

```bash
node -v
npm -v
```

If both commands output version numbers, everything is fine.

### Obtain repository
#### Option A: Clone using Git

```bash
git clone https://github.com/fwmone/eink-optimize.git
cd eink-optimize
```

#### Option B: Download as ZIP

- Download ZIP, unzip
- Switch terminal to the unzipped project folder

### Install dependencies
In the project folder (where package.json is located):

```bash
npm install
```

This installs all dependencies in the node_modules/ folder.

Start test

In the project folder (where package.json is located):

```bash
node server.js
```

Then:

```bash
curl -s http://localhost:3030/health
```

And a test optimize (with any image URL accessible from the Debian server):

```bash
curl -X POST http://localhost:3030/optimize \
  -H "Content-Type: application/json" \
  -d '{"image_url":"https://example.com/test.jpg","mode":"spectra6",‘width’:1200,"height":1600}' \
  --output out.png
```

### Run as a systemd service

File ```/etc/systemd/system/eink-optimize.service```:

```
[Unit]
Description=E-Ink EPD Optimize
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/<USER>/eink-optimize
ExecStart=/usr/bin/node /home/<USER>/eink-optimize/server.js
Restart=on-failure
RestartSec=2
Environment=PORT=3030

# optional hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=false

[Install]
WantedBy=multi-user.target
```

Replace ```/home/<USER>/eink-optimize``` with the directory where package.json is located. 

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now eink-optimize
sudo systemctl status eink-optimize
```

## Usage

The best way to call it is via cURL:

```bash
curl -X GET http://localhost:3030/health
```

It should return:

```json
{"ok":true}
```

For image optimization:

```bash
curl -X POST http://localhost:3030/optimize \
-H "Content-Type: application/json" \
-d '{"imageUrl":"<URL_TO_BE_OPTIMIZED_IMAGE>","outW":1200,"outH":1600,"format":"jpeg", "spectra6_optimize": 0, "eink_optimize": 1, "fit": "cover", "gamma": 0.88, "saturation": 1.1}' \
--output out.jpg
```

The optimized image should then appear in the **out.jpg** file.

Possible parameters in the JSON payload (curl -d) are:

|key|explanation|
|----------|---------|
|imageUrl|URL of the image to be optimized|
|outW|Width of the optimized image|
|outH|Height of the optimized image|
|fit|cover = fill completely, crop edges if necessary, or contain = reduce size, with background color|
|format|jpeg or png. BLOOMIN8 can only handle jpeg|
|gamma|Gamma correction, e.g. 0.9|
|saturation|Color saturation, e.g. 1.1|
|lift|Elevation of deep colors, values between 0-15 work well|
|liftThreshold|Which color values are considered low? The higher the value, the brighter the tones are lifted; values between 90 and 120 are recommended|
|epd_optimize|Uses EPDOptimize for paperlesspaper picture frames. Does not work well with BLOOMIN8.|
|color_optimize|Color optimization, i.e., gamma, saturation, lift|

## 🚫 Limitations

The script is very rudimentary and was developed quickly and dirty—it serves its purpose. I welcome any optimizations or ideas.

## 🛠️ Development & status

This integration is currently under active development. 
Feedback, bug reports, and pull requests are welcome.

## 🐞 Report a bug

Please use the issue tracker on GitHub:

👉 https://github.com/fwmone/eink-optimize/issues

## 🙏 Note

This integration has no official connection to the manufacturer of BLOOMIN8 or paperlesspaper.