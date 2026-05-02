import os
import math
import sys
import subprocess
import shutil
import time

# Auto-setup: Ensure dependencies are installed
def setup_dependencies():
    deps = {
        'yaml': 'PyYAML',
        'frontmatter': 'python-frontmatter',
        'markdown': 'markdown'
    }
    for module, package in deps.items():
        try:
            __import__(module)
        except ImportError:
            print(f"{package} not found. Attempting to install...")
            try:
                subprocess.check_call([sys.executable, "-m", "pip", "install", package])
                print(f"Successfully installed {package}.")
            except Exception as e:
                print(f"Error: Could not install {package}. Please run 'pip install {package}' manually.")
                sys.exit(1)

setup_dependencies()
import yaml
import frontmatter
import markdown
import http.server
import socketserver
import datetime
import email.utils
from xml.sax.saxutils import escape

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    """Custom handler to disable browser caching during development."""
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

# Configuration
DATA_DIR = 'src/data'
TEMPLATE_DIR = 'src/templates'
OUTPUT_DIR = '_site'
LOG_ENTRIES_PER_PAGE = 5

def load_data(filename):
    """Loads YAML data from the data directory."""
    path = os.path.join(DATA_DIR, filename)
    with open(path, 'r') as f:
        return yaml.safe_load(f)

def load_markdown(filename):
    """Loads Markdown with frontmatter, returning metadata and rendered HTML content."""
    path = os.path.join(DATA_DIR, filename)
    with open(path, 'r') as f:
        post = frontmatter.load(f)
        metadata = post.metadata
        metadata['content'] = markdown.markdown(post.content, extensions=['tables'])
        return metadata

def load_template(filename):
    with open(os.path.join(TEMPLATE_DIR, filename), 'r') as f:
        return f.read()

def render_template(template, context):
    rendered = template
    for key, value in context.items():
        placeholder = '{{ ' + key + ' }}'
        rendered = rendered.replace(placeholder, str(value))
    return rendered

def build_page(template_name, context, output_path):
    """
    Builds a page from a template and context.
    output_path is relative to the root, e.g., 'about/index.html'
    """
    base_template = load_template('base.html')
    page_template = load_template(template_name)
    
    page_body = render_template(page_template, context)
    
    final_context = {
        'title': context.get('page_title', 'diodesign'),
        'body': page_body
    }
    
    final_html = render_template(base_template, final_context)
    
    # Ensure directory exists
    full_output_path = os.path.join(OUTPUT_DIR, output_path)
    os.makedirs(os.path.dirname(full_output_path), exist_ok=True)
    
    with open(full_output_path, 'w') as f:
        f.write(final_html)
    print(f"Built {output_path}")

def build_log_pages(data_subdir, title, subtitle, folder_name):
    """
    Builds log pages from a directory of Markdown files.
    """
    entries = []
    log_dir = os.path.join(DATA_DIR, data_subdir)
    
    if os.path.exists(log_dir) and os.path.isdir(log_dir):
        for filename in os.listdir(log_dir):
            if filename.endswith('.md'):
                path = os.path.join(log_dir, filename)
                with open(path, 'r') as f:
                    post = frontmatter.load(f)
                    entry = post.metadata
                    entry['content'] = markdown.markdown(post.content)
                    # Fallback for permalink if not in frontmatter
                    if 'permalink' not in entry:
                        entry['permalink'] = filename.replace('.md', '.html')
                    entry['folder'] = folder_name
                    entries.append(entry)

    # Sort entries by date (descending)
    entries.sort(key=lambda x: str(x.get('date', '')), reverse=True)
    
    # Build individual entry pages
    for entry in entries:
        entry_context = {
            'page_title': entry.get('title', 'Untitled'),
            'entry_title': entry.get('title', 'Untitled'),
            'entry_date': entry.get('date', ''),
            'entry_byline': entry.get('byline', ''),
            'entry_content': entry['content']
        }
        build_page('single_entry.html', entry_context, os.path.join(folder_name, entry['permalink']))

    # Build list pages
    total_pages = math.ceil(len(entries) / LOG_ENTRIES_PER_PAGE)
    if total_pages == 0: total_pages = 1
    
    for page_num in range(1, total_pages + 1):
        start_idx = (page_num - 1) * LOG_ENTRIES_PER_PAGE
        end_idx = start_idx + LOG_ENTRIES_PER_PAGE
        page_entries = entries[start_idx:end_idx]
        
        entry_template = load_template('log_entry.html')
        entries_html = ""
        for entry in page_entries:
            entries_html += render_template(entry_template, entry)
            
        pagination_html = ""
        if total_pages > 1:
            page_links = []
            if page_num > 1:
                prev_link = "index.html" if page_num == 2 else f"p{page_num-1}.html"
                page_links.append(f'<a href="{prev_link}" class="page-link">&larr; Newer</a>')
            
            if page_num < total_pages:
                next_link = f"p{page_num+1}.html"
                page_links.append(f'<a href="{next_link}" class="page-link">Older &rarr;</a>')
            
            pagination_html = ' <span class="separator">|</span> '.join(page_links)
        
        context = {
            'page_title': title,
            'log_title': title,
            'log_subtitle': subtitle,
            'log_entries': entries_html,
            'pagination': pagination_html
        }
        
        output_name = "index.html" if page_num == 1 else f"p{page_num}.html"
        build_page('log.html', context, os.path.join(folder_name, output_name))
    
    return entries

def generate_rss(entries):
    """Generates an RSS 2.0 feed from the given entries."""
    base_url = "https://diodesign.org"
    rss_items = []
    
    # Sort all entries by date descending for the feed
    sorted_entries = sorted(entries, key=lambda x: str(x.get('date', '')), reverse=True)
    
    for entry in sorted_entries:
        title = escape(entry.get('title', 'Untitled'))
        link = f"{base_url}/{entry['folder']}/{entry['permalink']}"
        date_str = str(entry.get('date', ''))
        
        try:
            dt = datetime.datetime.strptime(date_str, "%Y-%m-%d")
            # Set to noon to avoid timezone ambiguity in a simple way for daily logs
            dt = dt.replace(hour=12, minute=0, second=0)
            pub_date = email.utils.format_datetime(dt)
        except ValueError:
            pub_date = date_str

        # Use summary if available, otherwise fallback to full content
        description_text = entry.get('summary') or entry.get('content', '')
        description = escape(description_text)
        
        item = f"""    <item>
      <title>{title}</title>
      <link>{link}</link>
      <guid isPermaLink="true">{link}</guid>
      <pubDate>{pub_date}</pubDate>
      <description>{description}</description>
    </item>"""
        rss_items.append(item)

    now = email.utils.format_datetime(datetime.datetime.now())
    
    rss_template = f"""<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>diodesign</title>
  <link>{base_url}</link>
  <description>Technical logs and musings from diodesign.org</description>
  <language>en-us</language>
  <lastBuildDate>{now}</lastBuildDate>
  <atom:link href="{base_url}/rss.xml" rel="self" type="application/rss+xml" />
  {"\n".join(rss_items)}
</channel>
</rss>"""

    rss_path = os.path.join(OUTPUT_DIR, 'rss.xml')
    with open(rss_path, 'w') as f:
        f.write(rss_template)
    print(f"Built rss.xml")

def prepare_output_directory():
    """Removes old generated files and directories to ensure a clean build."""
    if os.path.exists(OUTPUT_DIR):
        print(f"Cleaning {OUTPUT_DIR}/...")
        shutil.rmtree(OUTPUT_DIR)
    os.makedirs(OUTPUT_DIR, exist_ok=True)

def get_file_mtimes():
    """Returns a dict of filepath to mtime for all source files being watched."""
    mtimes = {}
    # Watch the src directory recursively
    if os.path.exists('src'):
        for root, dirs, files in os.walk('src'):
            for f in files:
                path = os.path.join(root, f)
                try:
                    mtimes[path] = os.path.getmtime(path)
                except OSError:
                    pass
    
    # Also watch specific root files that affect the build or appearance
    root_watches = ['build.py', 'style.css', 'splash.js']
    for f in root_watches:
        if os.path.exists(f):
            try:
                mtimes[f] = os.path.getmtime(f)
            except OSError:
                pass
    return mtimes

def build_site():
    """Performs the complete site build."""
    # Prepare for a fresh build
    prepare_output_directory()

    # Build splash page
    build_page('index.html', {'page_title': 'Home'}, 'index.html')
    
    # Build about page
    about_data = load_markdown('about.md')
    build_page('page.html', {
        'page_title': about_data['title'],
        'page_subtitle': about_data['subtitle'],
        'page_content': about_data['content']
    }, 'about/index.html')
    
    # Build contact page
    contact_data = load_markdown('contact.md')
    build_page('page.html', {
        'page_title': contact_data['title'],
        'page_subtitle': contact_data['subtitle'],
        'page_content': contact_data['content']
    }, 'contact/index.html')
    
    # Build logs
    all_entries = []
    all_entries.extend(build_log_pages('work-log', 'Work Log', 'Debugging the universe, one line at a time', 'work-log'))
    all_entries.extend(build_log_pages('life-log', 'Life Log', 'Mostly harmless', 'life-log'))

    # Generate RSS feed
    generate_rss(all_entries)

    # Build legal and contributor pages
    contrib_data = load_markdown('contributors.md')
    build_page('page.html', {
        'page_title': contrib_data['title'],
        'page_subtitle': contrib_data['subtitle'],
        'page_content': contrib_data['content']
    }, 'contributors/index.html')

    license_data = load_markdown('license.md')
    build_page('page.html', {
        'page_title': license_data['title'],
        'page_subtitle': license_data['subtitle'],
        'page_content': license_data['content']
    }, 'license/index.html')

    privacy_data = load_markdown('privacy.md')
    build_page('page.html', {
        'page_title': privacy_data['title'],
        'page_subtitle': privacy_data['subtitle'],
        'page_content': privacy_data['content']
    }, 'privacy/index.html')

    # Copy static assets
    static_assets = ['style.css', 'splash.js', 'favicon.ico', 'CNAME', 'keybase.txt']
    for asset in static_assets:
        if os.path.exists(asset):
            shutil.copy2(asset, os.path.join(OUTPUT_DIR, asset))
            print(f"Copied {asset} to {OUTPUT_DIR}")

def main():
    # Handle internal server flag used for development
    if len(sys.argv) > 1 and sys.argv[1] == '--internal-server':
        port = 8000
        print(f"Starting internal dev server on port {port} (cache disabled)...")
        
        # Aggressively clear the port if it's already in use
        try:
            subprocess.run(['fuser', '-k', f'{port}/tcp'], capture_output=True)
            time.sleep(0.5) # Give the OS a moment to release the socket
        except:
            pass

        socketserver.TCPServer.allow_reuse_address = True
        import functools
        handler = functools.partial(NoCacheHandler, directory=OUTPUT_DIR)
        
        # Retry logic for binding to the port
        retries = 10
        while retries > 0:
            try:
                with socketserver.TCPServer(("", port), handler) as httpd:
                    httpd.serve_forever()
                return # Normal exit
            except OSError as e:
                if e.errno == 98: # Address already in use
                    print(f"Port {port} is in use, retrying in 1s... ({retries} attempts left)")
                    try:
                        subprocess.run(['fuser', '-k', f'{port}/tcp'], capture_output=True)
                    except:
                        pass
                    time.sleep(1)
                    retries -= 1
                else:
                    raise e
        
        print(f"FATAL: Could not bind to port {port} after multiple attempts.")
        sys.exit(1)

    # Handle standalone --clear flag
    if len(sys.argv) > 1 and sys.argv[1] == '--clear':
        prepare_output_directory()
        print("Generated files cleared.")
        return

    build_site()

    # Start server if requested
    if '--server' in sys.argv:
        print("\nBuild successful. Starting server on port 8000...")
        # Use our own script to run the internal server with cache disabled
        server_process = subprocess.Popen([sys.executable, sys.argv[0], "--internal-server"])
        
        last_mtimes = get_file_mtimes()
        
        try:
            while True:
                time.sleep(0.5) # snappier polling
                current_mtimes = get_file_mtimes()
                
                changed = False
                for path, mtime in current_mtimes.items():
                    if path not in last_mtimes or mtime > last_mtimes[path]:
                        changed = True
                        print(f"\nFile changed: {path}")
                        
                        # If build.py itself changed, restart the whole script
                        if os.path.basename(path) == 'build.py':
                            print("build.py changed. Restarting script...")
                            server_process.terminate()
                            server_process.wait()
                            os.execv(sys.executable, [sys.executable] + sys.argv)
                        
                        break
                        
                if not changed:
                    for path in last_mtimes:
                        if path not in current_mtimes:
                            changed = True
                            print(f"\nFile deleted: {path}")
                            break
                            
                if changed:
                    print("Killing server...")
                    server_process.terminate()
                    server_process.wait()
                    
                    print("Rebuilding site...")
                    try:
                        build_site()
                        print("Build successful.")
                    except Exception as e:
                        print(f"Build failed: {e}")
                    
                    print("Restarting server on port 8000...")
                    server_process = subprocess.Popen([sys.executable, sys.argv[0], "--internal-server"])
                    
                    last_mtimes = get_file_mtimes()
                    
        except KeyboardInterrupt:
            print("\nServer stopped.")
            server_process.terminate()
            server_process.wait()

if __name__ == '__main__':
    main()
