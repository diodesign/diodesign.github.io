# diodesign.github.io CMS

A lightweight, Python-powered static site generator for the diodesign website.

## Architecture

- **src/data/**: Content stored in human-friendly YAML files.
- **src/templates/**: HTML templates with simple `{{ variable }}` placeholders.
- **build.py**: The build script that assembles the YAML data and HTML templates into final static pages.

## Setup

The build script requires **Python 3** and **PyYAML**.  To install the dependencies, run the following command:

```bash
pip install -r requirements.txt
```
  
`build.py` will attempt to install PyYAML automatically if it is missing.

## Build and test

1. **Build the site.**
   ```bash
   python3 build.py
   ```

2. **Clear generated files.**
   To remove all auto-generated pages without rebuilding:
   ```bash
   python3 build.py --clear
   ```

3. **Run a local server.**
   Since the site uses absolute paths, you must use a server for local testing:
   ```bash
   python3 -m http.server 8000
   ```
   Then visit [http://localhost:8000](http://localhost:8000).

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

The contents of this repository are copyright (c) 2026 Chris Williams <[chrisw@diosix.org](mailto:chrisw@diosix.org)>.
Licensed under the [CC BY-SA 4.0 License](https://creativecommons.org/licenses/by-sa/4.0/).