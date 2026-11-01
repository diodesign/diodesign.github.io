# diodesign.org

This repository contains the source and zero-dependency Python static build script for **[diodesign.org](https://diodesign.org/)**, the single-page web portal for **the diodesign lab**, hosted via GitHub Pages.

## Architecture

```text
.
├── build.py                 # Zero-dependency static site builder & live-reload dev server
├── requirements.txt         # Empty (uses Python 3 standard library only)
├── src/
│   ├── templates/
│   │   ├── base.html        # Root HTML shell and live-reload client script
│   │   └── index.html       # Single-page lab portal (About, Projects, Updates, Contact)
│   └── static/
│       ├── CNAME            # Custom domain configuration (diodesign.org)
│       ├── splash.js        # Accordion UI controller & procedural alpine landscape engine
│       ├── style.css        # Responsive single-page styles
│       ├── favicon.ico
│       ├── humans.txt
│       ├── keybase.txt
│       └── robots.txt
└── _site/                   # Generated build output (git-ignored)
```

- **[`src/templates/`](src/templates/)**: Contains [`base.html`](src/templates/base.html) and [`index.html`](src/templates/index.html), which define the central lab panel and its single-open expandable sections (*About*, *Projects*, *Updates*, and *Contact*).
- **[`src/static/`](src/static/)**: Static assets copied directly to the root of `_site/` during the build.
  - **[`splash.js`](src/static/splash.js)**: Controls the single-open accordion and renders the procedural alpine & fjord landscape background on desktop/tablet screens (automatically bypassed on screens `<= 768px`).
  - **[`style.css`](src/static/style.css)**: Responsive layout and typography rules.
- **[`build.py`](build.py)**: Compiles the templates, copies static assets into `_site/`, generates `sitemap.xml` and `llms.txt`, and provides a multi-threaded local development server with automatic browser live-reload.

## Requirements

- **Python 3** (uses only the Python standard library; no third-party packages are required).

## Build and Local Development

1. **Build the static site** into `_site/`:

   ```bash
   python3 build.py
   ```

2. **Run the local development server** with automatic rebuild and live browser reload:

   ```bash
   python3 build.py --server
   ```

   Then visit [http://localhost:8000](http://localhost:8000). Any edits to files in `src/` or `build.py` automatically rebuild `_site/` and refresh connected browsers.

3. **Clean generated build output**:

   ```bash
   python3 build.py --clear
   ```

## CI/CD Deployment

The GitHub Actions workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs automatically on pushes to the `prod` branch:
1. Sets up Python 3.
2. Runs `python build.py` to compile the site into `./_site`.
3. Uploads and deploys `./_site` to GitHub Pages.

---

Copyright &copy; 2026 Chris Williams.
