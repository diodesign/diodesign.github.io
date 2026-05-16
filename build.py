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
        'markdown': 'markdown',
        'pygments': 'pygments'
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
from pygments.formatters import HtmlFormatter
from pygments.style import Style
from pygments.token import Keyword, Name, Comment, String, Error, \
     Number, Operator, Generic, Whitespace, Punctuation

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
LOG_ENTRIES_PER_PAGE = 3

# Global context for templates
LATEST_LOG_CONTEXT = {
    'latest_url': '#',
    'latest_title': 'None'
}

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
        metadata['content'] = markdown.markdown(post.content, extensions=['tables', 'codehilite', 'fenced_code', 'def_list'])
        return metadata

# Template cache — populated on first access, cleared at the start of each build
TEMPLATE_CACHE = {}

def load_template(filename):
    if filename not in TEMPLATE_CACHE:
        with open(os.path.join(TEMPLATE_DIR, filename), 'r') as f:
            TEMPLATE_CACHE[filename] = f.read()
    return TEMPLATE_CACHE[filename]

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
    final_context.update(LATEST_LOG_CONTEXT)
    
    final_html = render_template(base_template, final_context)
    
    # Ensure directory exists
    full_output_path = os.path.join(OUTPUT_DIR, output_path)
    os.makedirs(os.path.dirname(full_output_path), exist_ok=True)
    
    with open(full_output_path, 'w') as f:
        f.write(final_html)
    print(f"Built {output_path}")

all_entries = []

def build_log_hierarchy(data_path, title, subtitle, folder_path, breadcrumbs=None, sort_order='descending'):
    """
    Recursively builds log pages starting from data_path.
    data_path is the relative path from project root (e.g. 'src/data/work-log/')
    folder_path is the path in the URL (e.g. 'work-log')
    """
    if breadcrumbs is None:
        breadcrumbs = [{'title': 'Home', 'url': '/'}]
    
    # Generate HTML for breadcrumbs (parent path)
    breadcrumb_html = ' <span class="sep">&gt;</span> '.join([f'<a href="{b["url"]}">{b["title"]}</a>' for b in breadcrumbs])
    
    # For entries, we append the CURRENT section title to the breadcrumb trail
    entry_breadcrumb_html = f'{breadcrumb_html} <span class="sep">&gt;</span> <a href="/{folder_path}/">{title}</a>'

    global all_entries
    local_entries = []
    sub_logs = []
    
    if os.path.exists(data_path) and os.path.isdir(data_path):
        # Use sorted listdir for deterministic processing
        for item in sorted(os.listdir(data_path)):
            if item.startswith('_'): continue
            
            full_path = os.path.join(data_path, item)
            if os.path.isfile(full_path) and item.endswith('.md'):
                with open(full_path, 'r') as f:
                    post = frontmatter.load(f)
                    entry = post.metadata
                    entry['content_raw'] = post.content # Keep for search index
                    entry['content'] = markdown.markdown(post.content, extensions=['tables', 'codehilite', 'fenced_code', 'def_list'])
                    # Fallback for permalink if not in frontmatter
                    if 'permalink' not in entry:
                        entry['permalink'] = item.replace('.md', '.html')
                    entry['folder'] = folder_path
                    local_entries.append(entry)
                    # Don't re-append to all_entries here as we did it in the collection phase
            
            elif os.path.isdir(full_path):
                book_path = os.path.join(full_path, '_book.yaml')
                if os.path.exists(book_path):
                    with open(book_path, 'r') as f:
                        books = yaml.safe_load(f)
                        if books and len(books) > 0:
                            book = books[0]
                            sub_title = book.get('title', item)
                            sub_subtitle = book.get('subtitle', '')
                            sub_folder_path = os.path.join(folder_path, item)
                            
                            # Recursion with updated breadcrumbs and sort order
                            new_breadcrumbs = breadcrumbs + [{'title': title, 'url': f'/{folder_path}/'}]
                            sub_sort_order = book.get('sort', 'descending')
                            build_log_hierarchy(full_path, sub_title, sub_subtitle, sub_folder_path, breadcrumbs=new_breadcrumbs, sort_order=sub_sort_order)
                            
                            sub_logs.append({
                                'title': sub_title,
                                'subtitle': sub_subtitle,
                                'url': f"/{sub_folder_path}/"
                            })

    # Sort local entries by date
    is_descending = sort_order != 'ascending'
    local_entries.sort(key=lambda x: str(x.get('date', '')), reverse=is_descending)
    
    # Build individual entry pages
    for entry in local_entries:
        entry_context = {
            'page_title': entry.get('title', 'Untitled'),
            'entry_title': entry.get('title', 'Untitled'),
            'entry_date': entry.get('date', ''),
            'entry_byline': entry.get('byline', ''),
            'entry_content': entry['content'],
            'breadcrumbs': entry_breadcrumb_html
        }
        build_page('single_entry.html', entry_context, os.path.join(folder_path, entry['permalink']))

    # Render sub-logs HTML snippet
    sub_log_template = load_template('sub_log_item.html')
    sub_logs_html = ""
    for sl in sub_logs:
        sub_logs_html += render_template(sub_log_template, sl)

    # Build list pages (paginated)
    total_pages = math.ceil(len(local_entries) / LOG_ENTRIES_PER_PAGE)
    if total_pages == 0: total_pages = 1
    
    for page_num in range(1, total_pages + 1):
        start_idx = (page_num - 1) * LOG_ENTRIES_PER_PAGE
        end_idx = start_idx + LOG_ENTRIES_PER_PAGE
        page_entries = local_entries[start_idx:end_idx]
        
        entry_template = load_template('log_entry.html')
        entries_html = ""
        for entry in page_entries:
            entries_html += render_template(entry_template, entry)
            
        pagination_html = ""
        if total_pages > 1:
            page_links = []
            if page_num > 1:
                prev_link = "index.html" if page_num == 2 else f"p{page_num-1}.html"
                label = "&larr; Newer" if is_descending else "&larr; Older"
                page_links.append(f'<a href="{prev_link}" class="page-link">{label}</a>')
            
            if page_num < total_pages:
                next_link = f"p{page_num+1}.html"
                label = "Older &rarr;" if is_descending else "Newer &rarr;"
                page_links.append(f'<a href="{next_link}" class="page-link">{label}</a>')
            
            pagination_html = ' <span class="separator">|</span> '.join(page_links)
        
        context = {
            'page_title': title,
            'log_title': title,
            'log_subtitle': subtitle,
            'sub_logs': sub_logs_html,
            'log_entries': entries_html,
            'pagination': pagination_html,
            'breadcrumbs': breadcrumb_html
        }
        
        output_name = "index.html" if page_num == 1 else f"p{page_num}.html"
        build_page('log.html', context, os.path.join(folder_path, output_name))

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
    root_watches = ['build.py', 'style.css', 'splash.js', 'search.js', 'characters.js']
    for f in root_watches:
        if os.path.exists(f):
            try:
                mtimes[f] = os.path.getmtime(f)
            except OSError:
                pass
    return mtimes

def get_latest_log_entry():
    """Finds the most recent log entry from all collected entries."""
    if not all_entries:
        return None
    sorted_all = sorted(all_entries, key=lambda x: str(x.get('date', '')), reverse=True)
    return sorted_all[0]

def build_site():
    """Performs the complete site build."""
    # Clear template cache so stale templates aren't used across rebuilds
    TEMPLATE_CACHE.clear()

    # Prepare for a fresh build
    prepare_output_directory()

    # 1. First, collect all entries from the hierarchy without building pages
    global all_entries
    all_entries = []
    root_book = load_data('_book.yaml')
    
    # We need a non-destructive way to collect all entries
    # I'll add a 'collect_only' flag to build_log_hierarchy or just call it after collecting
    def collect_all_entries(data_path, folder_path):
        if os.path.exists(data_path) and os.path.isdir(data_path):
            for item in sorted(os.listdir(data_path)):
                if item.startswith('_'): continue
                full_path = os.path.join(data_path, item)
                if os.path.isfile(full_path) and item.endswith('.md'):
                    with open(full_path, 'r') as f:
                        post = frontmatter.load(f)
                        entry = post.metadata
                        entry['permalink'] = entry.get('permalink', item.replace('.md', '.html'))
                        entry['folder'] = folder_path
                        entry['content_raw'] = post.content
                        all_entries.append(entry)
                elif os.path.isdir(full_path):
                    book_path = os.path.join(full_path, '_book.yaml')
                    if os.path.exists(book_path):
                        collect_all_entries(full_path, os.path.join(folder_path, item))

    for section in root_book:
        data_path = section['path']
        url_folder = os.path.basename(data_path.rstrip('/'))
        collect_all_entries(data_path, url_folder)

    # 2. Populate latest log context for footer
    global LATEST_LOG_CONTEXT
    latest = get_latest_log_entry()
    if latest:
        LATEST_LOG_CONTEXT = {
            'latest_url': f"/{latest['folder']}/{latest['permalink']}",
            'latest_title': latest.get('title', 'Untitled')
        }

    # 3. Now build everything (pages will now have the correct footer context)
    for section in root_book:
        data_path = section['path']
        url_folder = os.path.basename(data_path.rstrip('/'))
        sort_order = section.get('sort', 'descending')
        build_log_hierarchy(data_path, section['title'], section['subtitle'], url_folder, breadcrumbs=[{'title': 'Home', 'url': '/'}], sort_order=sort_order)

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

    # Generate RSS feed
    generate_rss(all_entries)

    # Build all top-level markdown files as static pages
    for filename in os.listdir(DATA_DIR):
        if filename.endswith('.md') and not filename.startswith('_'):
            name = filename.replace('.md', '')
            data = load_markdown(filename)
            template = data.get('template', 'page.html')
            
            # Special case for root index if it ever moved to markdown
            output_path = "index.html" if name == "index" else f"{name}/index.html"
            
            build_page(template, {
                'page_title': data.get('title', name.capitalize()),
                'page_subtitle': data.get('subtitle', ''),
                'page_content': data['content']
            }, output_path)

    # If index.html isn't a markdown file, build it from template
    if not os.path.exists(os.path.join(DATA_DIR, 'index.md')):
        build_page('index.html', {'page_title': 'Home'}, 'index.html')

    # Copy static assets
    static_assets = ['style.css', 'splash.js', 'characters.js', 'search.js', 'favicon.ico', 'CNAME', 'keybase.txt']
    for asset in static_assets:
        if os.path.exists(asset):
            shutil.copy2(asset, os.path.join(OUTPUT_DIR, asset))
            print(f"Copied {asset} to {OUTPUT_DIR}")

    # Build search index for AI
    build_search_index()

    # Generate syntax highlighting CSS
    generate_syntax_css()

class DioDesignStyle(Style):
    """Custom Pygments style matching the site's gold and purple theme."""
    background_color = "#120720" # Deeper purple than site bg
    highlight_color = "#4b0082"  # Site accent color
    
    styles = {
        Whitespace:                "#f0f0f0",
        Comment:                   "italic #8e7fb0", # Site muted color
        Comment.Preproc:           "noitalic #ffd700",
        
        Keyword:                   "bold #ffd700",   # Site highlight color (Gold)
        Keyword.Pseudo:            "nobold",
        Keyword.Type:              "nobold #66D9EF", # Soft blue for types
        
        Operator:                  "#ffd700",
        Punctuation:               "#f0f0f0",
        
        Name:                      "#f0f0f0",
        Name.Builtin:              "#66D9EF",
        Name.Function:             "#ffd700",
        Name.Class:                "bold #ffd700",
        Name.Namespace:            "#f0f0f0",
        Name.Exception:            "bold #ffd700",
        Name.Variable:             "#f0f0f0",
        Name.Constant:             "#ae81ff",
        Name.Label:                "#ffd700",
        Name.Entity:               "#ae81ff",
        Name.Attribute:            "#ffd700",
        Name.Tag:                  "#ffd700",
        Name.Decorator:            "#ffd700",
        
        String:                    "#a5ff90", # Vibrant green for strings
        String.Doc:                "italic #8e7fb0",
        String.Interpol:           "#a5ff90",
        String.Escape:             "#ae81ff",
        String.Regex:              "#ae81ff",
        String.Symbol:             "#ae81ff",
        String.Other:              "#a5ff90",
        
        Number:                    "#ae81ff", # Purple for numbers
        
        Generic.Heading:           "bold #f0f0f0",
        Generic.Subheading:        "bold #8e7fb0",
        Generic.Deleted:           "#f92672",
        Generic.Inserted:          "#a6e22e",
        Generic.Error:             "#f92672",
        Generic.Emph:              "italic",
        Generic.Strong:            "bold",
        Generic.Prompt:            "bold #8e7fb0",
        Generic.Output:            "#f0f0f0",
        Generic.Traceback:         "#f92672",
        
        Error:                     "border:#f92672"
    }

def generate_syntax_css():
    """Generates the CSS for syntax highlighting using Pygments."""
    formatter = HtmlFormatter(style=DioDesignStyle)
    css_content = formatter.get_style_defs('.codehilite')
    
    # Add some basic styling for the code block containers
    extra_css = """
.codehilite {
    background: #120720;
    padding: 1.25rem;
    border-radius: 12px;
    margin-bottom: 2rem;
    overflow-x: auto;
    font-family: 'ui-monospace', 'Cascadia Code', 'Source Code Pro', 'Menlo', 'Consolas', monospace;
    font-size: 0.95rem;
    line-height: 1.5;
    border: 1px solid rgba(255, 215, 0, 0.15); /* Subtle gold border */
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}
.codehilite pre {
    margin: 0;
    white-space: pre;
}
/* Scrollbar styling for code blocks */
.codehilite::-webkit-scrollbar {
    height: 8px;
}
.codehilite::-webkit-scrollbar-track {
    background: #120720;
    border-radius: 0 0 12px 12px;
}
.codehilite::-webkit-scrollbar-thumb {
    background: #4b0082;
    border-radius: 10px;
}
.codehilite::-webkit-scrollbar-thumb:hover {
    background: #ffd700;
}
"""
    css_path = os.path.join(OUTPUT_DIR, 'syntax.css')
    with open(css_path, 'w') as f:
        f.write(css_content + extra_css)
    print(f"Built syntax.css with custom diodesign theme")

def clean_markdown(text):
    """Strips markdown and HTML syntax, leaving plain searchable prose."""
    import re
    # Collapse inline links to their label text
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    # Strip HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Normalise whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def chunk_text(text, title='', date='', max_chars=4500):
    """
    Paragraph-boundary chunking.

    Splits on blank lines so individual paragraphs are never severed.
    Each chunk is prefixed with the entry title and date so that the LLM
    always knows the source context even when reading a mid-article chunk.
    """
    header = f"{title}" + (f" ({date})" if date else '') + "\n\n" if title else ''
    header_len = len(header)

    paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]

    chunks = []
    current_paras = []
    current_len = header_len

    for para in paragraphs:
        para_len = len(para) + 2  # +2 for the separating newlines
        if current_len + para_len > max_chars and current_paras:
            chunks.append(header + '\n\n'.join(current_paras))
            current_paras = []
            current_len = header_len
        current_paras.append(para)
        current_len += para_len

    if current_paras:
        chunks.append(header + '\n\n'.join(current_paras))

    return chunks if chunks else [header.strip()]


def build_search_index():
    """Generates a search-index.json for client-side RAG + AI context."""
    import json

    index = []

    def add_to_index(title, url, raw_content, date=''):
        cleaned = clean_markdown(raw_content)
        for i, chunk in enumerate(chunk_text(cleaned, title=title, date=date)):
            index.append({
                'title': title,
                'url':   url,
                'content': chunk,
                'chunk': i,
            })

    # Index the home page specifically
    add_to_index(
        "Home",
        "/",
        "the diodesign lab. Synthesizing silicon and intelligence through low-level systems experimentation."
    )

    # Process static pages automatically
    for filename in os.listdir(DATA_DIR):
        if filename.endswith('.md') and not filename.startswith('_'):
            path = os.path.join(DATA_DIR, filename)
            with open(path, 'r') as f:
                post = frontmatter.load(f)
                name = filename.replace('.md', '')
                title = post.metadata.get('title', name.capitalize())
                summary = post.metadata.get('summary', '')
                # Prepend the summary so it is always present in the first chunk
                full_content = (f"{summary}\n\n" if summary else '') + post.content
                url = "/" if name == "index" else f"/{name}/"
                add_to_index(title, url, full_content)

    # Process logs from global all_entries
    for entry in all_entries:
        add_to_index(
            entry.get('title', 'Untitled'),
            f"/{entry['folder']}/{entry['permalink']}",
            entry.get('content_raw', ''),
            date=str(entry.get('date', ''))
        )

    index_path = os.path.join(OUTPUT_DIR, 'search-index.json')
    with open(index_path, 'w') as f:
        json.dump(index, f, separators=(',', ':'))
    print(f"Built search-index.json with {len(index)} chunks")

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
