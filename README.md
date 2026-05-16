# diodesign.github.io CMS

This repository contains a lightweight, Python-powered static site generator as well as site content. It builds the diodesign.org website, which is kindly hosted by GitHub Pages.

## Architecture

- [`src/data/`](src/data/): Content stored in human-friendly Markdown files with YAML frontmatter.
- [`src/data/_book.yaml`](src/data/_book.yaml): The root configuration file that defines the site's primary log sections.
- [`src/templates/`](src/templates/): HTML templates with simple `{{ variable }}` placeholders.
- [`_site/`](_site/): The output directory where the built static site is generated. This directory is ignored by git.
- [`build.py`](build.py): The build script that assembles the Markdown data and HTML templates into final static pages.

## Setup

The build script to generate the site requires **Python 3**, **PyYAML**, **python-frontmatter**, and **markdown**. To install the dependencies, run the following command:

```bash
pip install -r requirements.txt
```
  
[build.py](build.py) will attempt to install these dependencies automatically if they are missing.

## Build and test

1.  To build static pages from the current content:

    ```bash
    python3 build.py
    ```

2.  Since the site uses root-relative paths, you must use a server for local testing. To run a development server:

    ```bash
    python3 build.py --server
    ```

    Then visit [http://localhost:8000](http://localhost:8000). The server will serve from the `_site/` directory, monitor the source files, and automatically rebuild the site whenever changes are detected, allowing for a seamless development experience.

3.  To remove all auto-generated pages prior to committing changes:

    ```bash
    python3 build.py --clear
    ```

## CI/CD deployment

This repository includes a GitHub Actions workflow in `.github/workflows/deploy.yml`. When you push to the `prod` branch, GitHub will automatically:
1. Setup a Python environment.
2. Run `build.py` to generate the latest site into `_site/`.
3. Deploy the contents of the `_site/` folder to GitHub Pages.

## Managing content

### Hierarchical logs and series

The log system supports nested folders and multi-part series (like a book or function-by-function commentary).

1.  **Top-level sections**: Defined in `src/data/_book.yaml`. Each entry specifies a `title`, `subtitle`, and the `path` to the log folder.
2.  **Sub-sections (series)**: Any subdirectory within a log folder can become its own sub-section if it contains its own `_book.yaml`.
3.  **Discovery**: The build script automatically crawls these directories. If it finds a `_book.yaml`, it generates a new paginated list page for that sub-section.
4.  **Linking**: Parent log pages (like the Work Log) automatically detect sub-sections and display a "Series" link at the top of their list.

### Adding and editing static pages

To create a new static page (like "About" or "Contact"), create a `.md` file in `src/data/`. The build script will automatically:
- Generate a page at `/[filename]/index.html`.
- Use the `page.html` template by default (override this with `template: name.html` in frontmatter).
- Add the page to the AI search index.

### Adding log entries

To add a new entry to a log or sub-log:
1.  Navigate to the relevant folder (e.g., `src/data/work-log/` or `src/data/work-log/diosix-commentary/`).
2.  Create a new `.md` file with the required frontmatter.
3.  The build script will handle sorting (by date) and pagination (3 entries per page).

Example entry file:

```markdown
---
title: "My New Entry"
date: "2026-04-20"
byline: "Chris Williams"
---

This is the content of my log entry in Markdown.
```

-----

See [CONTRIBUTORS](src/data/contributors.md) for copyright and [LICENSE](src/data/license.md) for terms and conditions of use.
