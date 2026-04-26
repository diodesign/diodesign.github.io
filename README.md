# diodesign.github.io CMS

This repository contains a lightweight, Python-powered static site generator as well as site content. It is used to build the diodesign.org website, which is kindly hosted by GitHub pages.

## Architecture

- [`src/data/`](src/data/): Content stored in human-friendly YAML files.
- [`src/templates/`](src/templates/): HTML templates with simple `{{ variable }}` placeholders.
- [`build.py`](build.py): The build script that assembles the YAML data and HTML templates into final static pages.

## Setup

The build script to generate the site requires **Python 3** and **PyYAML**.  To install the dependencies, run the following command:

```bash
pip install -r requirements.txt
```
  
[build.py](build.py) will attempt to install PyYAML automatically if it is missing.

## Build and test

1.  To build static pages from the current content:

    ```bash
    python3 build.py
    ```

2.  Since the site uses root-relative paths, you must use a server for local testing. To run a development server:

    ```bash
    python3 build.py --server
    ```

    Then visit [http://localhost:8000](http://localhost:8000). While the server is running, if any files in the current directory are modified, the site will be rebuilt automatically.

3.  To remove all auto-generated pages prior to committing changes:

    ```bash
    python3 build.py --clear
    ```

## CI/CD deployment

This repository includes a GitHub Actions workflow in `.github/workflows/deploy.yml`. When you push to the `prod` branch, GitHub will automatically:
1. Setup a Python environment.
2. Run `build.py` to generate the latest site.
3. Deploy the resulting files to GitHub Pages.

## Managing content

### Adding and editing content pages

Edit the `.yaml` files in `src/data/`. 

- For multi-line HTML content, use the YAML pipe operator (`|`):
  ```yaml
  content: |
    <p>This is a paragraph.</p>
    <p>This is another.</p>
  ```

### Adding log entries

To add a new entry to the Work Log or Life Log, simply add a new item to the list in `work-log.yaml` or `life-log.yaml`. The build script will automatically handle sorting (by date) and pagination.

```yaml
- title: "My New Entry"
  date: "2026-04-20"
  byline: "Chris Williams"
  permalink: "my-new-entry.html"
  content: "This is the content of my log entry."
```

-----

See [CONTRIBUTORS](contributors.md) for copyright and [LICENSE](lICENSE.md) for terms and conditions of use.