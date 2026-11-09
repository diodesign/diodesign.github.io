# diodesign.org

This repository contains the source and Python static build script for **[diodesign.org](https://diodesign.org/)**, the single-page web portal for **the diodesign program**, hosted via GitHub Pages.

## Architecture

```text
.
├── build.py                 # Static site builder & local dev server
├── requirements.txt         # Python dependencies (Pillow for mask generation)
├── src/
│   ├── templates/
│   │   ├── base.html        # Root HTML shell with Schema.org JSON-LD & SEO metadata
│   │   └── index.html       # Single-page program portal (About, Projects, Updates, Contact)
│   └── static/
│       ├── CNAME                  # Custom domain configuration (diodesign.org)
│       ├── background.webp        # Photorealistic background reference map for code rain stream (auto-generates _site/mask.webp during build)
│       ├── splash.js              # Accordion UI controller, sideways code rain mountain generator & RISC-V explorer
│       ├── style.css              # Responsive single-page styles
│       ├── favicon.ico
│       ├── humans.txt
│       ├── keybase.txt
│       └── robots.txt
└── _site/                   # Generated build output (git-ignored)
```

- **[`src/templates/`](src/templates/)**: Contains [`base.html`](src/templates/base.html) and [`index.html`](src/templates/index.html), which define the central program panel and its single-open expandable sections (*About*, *Projects*, *Updates*, and *Contact*).
- **[`src/static/`](src/static/)**: Static assets copied directly to the root of `_site/` during the build.
  - **[`splash.js`](src/static/splash.js)**: Controls the single-open accordion, drives the continuous procedural sideways code rain and snowy alpine mountain range background generator on desktop/tablet screens (with adaptive hardware compute-power tier scaling, startup micro-benchmark, and automatic bypass on screens `<= 768px`), and powers the interactive RISC-V instruction set and datapath explorer.
  - **[`style.css`](src/static/style.css)**: Responsive layout and typography rules.
- **[`build.py`](build.py)**: Compiles the templates, auto-generates the panoramic transparency mask (`mask.webp`), copies static assets into `_site/`, generates `sitemap.xml`, `llms.txt`, and `llms-full.txt`, and provides a local development server that rebuilds `_site/` automatically when source files are saved.

## Requirements

- **Python 3** (requires `Pillow` to auto-generate the mask during build, installed automatically by `pip install -r requirements.txt` in CI/CD).

## Build and Local Development

1. **Build the static site** into `_site/`:

   ```bash
   python3 build.py
   ```

2. **Run the local development server** with automatic rebuild on save:

   ```bash
   python3 build.py --server
   ```

   Then visit [http://localhost:8000](http://localhost:8000). Any edits to files in `src/` or `build.py` automatically rebuild `_site/` so you can simply refresh your browser.

3. **Clean generated build output**:

   ```bash
   python3 build.py --clear
   ```

4. **Run the automated RISC-V instruction and decoder verification suite** (verifies RV32I/RV64I assembly, 32-bit hex encodings, individual bit-fields `[31:0]`, and round-trip disassembly against `llvm-mc`; add `-v` or `--verbose` to print a full table of all 789 test vectors and their decoded webpage values):

   ```bash
   python3 build.py --test
   python3 build.py --test --verbose
   ```

## CI/CD Deployment

The GitHub Actions workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs automatically on pushes to the `prod` branch:
1. Sets up Python 3.
2. Installs dependencies (`pip install -r requirements.txt`).
3. Runs `python build.py` to compile the site and generate assets into `./_site`.
4. Uploads and deploys `./_site` to GitHub Pages.

---

See LICENSE for copyright, usage, and distribution rights.
