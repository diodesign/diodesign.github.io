# diodesign.github.io CMS

This repository contains a lightweight, Python-powered static site generator as well as site content. It builds the diodesign.org website, which is kindly hosted by GitHub pages.

## Architecture

- [`src/data/`](src/data/): Content stored in human-friendly Markdown files with YAML frontmatter.
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

### Adding and editing content pages

Edit the `.md` files in `src/data/`. These files use YAML frontmatter for metadata (title, subtitle, etc.) and Markdown for the page body.

### Adding log entries

To add a new entry to the Work Log or Life Log, create a new `.md` file in `src/data/work-log/` or `src/data/life-log/`. The build script will automatically handle sorting (by date) and pagination based on the metadata in each file.

Example entry file:
```markdown
---
title: "My New Entry"
date: "2026-04-20"
byline: "Chris Williams"
permalink: "my-new-entry.html"
---

This is the content of my log entry in Markdown.
```

-----

See [CONTRIBUTORS](src/data/contributors.md) for copyright and [LICENSE](src/data/license.md) for terms and conditions of use.