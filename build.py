import argparse
from datetime import datetime, timezone
import http.server
import os
import re
import shutil
import socketserver
import threading
import time

# Configuration
TEMPLATES_DIR = 'src/templates'
STATIC_DIR = 'src/static'
OUTPUT_DIR = '_site'
BASE_URL = 'https://diodesign.org'
PORT = 8000

RELOAD_VERSION = str(time.time())
SERVER_STOPPING = False


def load_template(name):
    """Loads an HTML template from src/templates/."""
    path = os.path.join(TEMPLATES_DIR, name)
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()


def render_template(template_content, context):
    """Replaces {{ key }} placeholders using a dictionary context."""
    def replace_match(match):
        key = match.group(1).strip()
        return str(context.get(key, ''))

    return re.sub(r'\{\{\s*(.*?)\s*\}\}', replace_match, template_content)


def prepare_output_directory():
    """Clears old generated files inside _site/ while preserving the root directory inode."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"Cleaning {OUTPUT_DIR}/...")
    for item in os.listdir(OUTPUT_DIR):
        item_path = os.path.join(OUTPUT_DIR, item)
        try:
            if os.path.isdir(item_path):
                shutil.rmtree(item_path)
            else:
                os.remove(item_path)
        except OSError:
            pass


def generate_sitemap():
    """Generates a clean sitemap.xml for the single-page site."""
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        '  <url>\n'
        f'    <loc>{BASE_URL}/</loc>\n'
        f'    <lastmod>{today}</lastmod>\n'
        '    <priority>1.0</priority>\n'
        '  </url>\n'
        '</urlset>\n'
    )
    with open(os.path.join(OUTPUT_DIR, 'sitemap.xml'), 'w', encoding='utf-8') as f:
        f.write(xml)
    print("Built sitemap.xml")


def generate_llms_txt():
    """Generates a concise llms.txt describing the program and its projects."""
    content = (
        "# the diodesign program\n\n"
        "> Blending low-level systems engineering, artificial intelligence, and human craft at the foundations of computing.\n\n"
        "The diodesign program is an independent personal initiative run by Chris Williams exploring how AI and human engineering aptitude work together across firmware, hypervisors, and FPGA/ASIC design.\n\n"
        "## Projects\n\n"
        "- [Diosix](https://diosix.org/): An open-source bare-metal multiprocessor hypervisor written in Zig for 64-bit RISC-V systems.\n"
        "- [diodesign.org](https://github.com/diodesign/diodesign.github.io): This single-page portal and procedural landscape engine.\n\n"
        "## Contact\n\n"
        "- Email: chrisw@diosix.org\n"
        "- GitHub: https://github.com/diodesign\n"
        "- LinkedIn: https://www.linkedin.com/in/diodesign/\n"
        "- Bluesky: https://bsky.app/profile/diodesign.org\n"
        "- Keybase: https://keybase.io/diodesign\n"
    )
    with open(os.path.join(OUTPUT_DIR, 'llms.txt'), 'w', encoding='utf-8') as f:
        f.write(content)
    print("Built llms.txt")


def build_site():
    """Builds the complete single-page site into _site/."""
    prepare_output_directory()

    base_html = load_template('base.html')
    index_body = render_template(load_template('index.html'), {})
    full_html = render_template(base_html, {
        'title': 'the diodesign program',
        'body_class': 'home-page',
        'body': index_body
    })

    with open(os.path.join(OUTPUT_DIR, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(full_html)
    print("Built index.html")

    if os.path.exists(STATIC_DIR):
        for item in os.listdir(STATIC_DIR):
            s = os.path.join(STATIC_DIR, item)
            d = os.path.join(OUTPUT_DIR, item)
            if os.path.isdir(s):
                shutil.copytree(s, d, dirs_exist_ok=True)
            else:
                shutil.copy2(s, d)
        print(f"Copied static assets from {STATIC_DIR} to {OUTPUT_DIR}")

    generate_sitemap()
    generate_llms_txt()

    global RELOAD_VERSION
    RELOAD_VERSION = f"{time.time():.6f}"
    with open(os.path.join(OUTPUT_DIR, '.build_id'), 'w', encoding='utf-8') as f:
        f.write(RELOAD_VERSION)


def get_file_mtimes():
    """Returns a dict of filepath -> mtime for all watched source files."""
    mtimes = {}
    if os.path.exists('src'):
        for root, _, files in os.walk('src'):
            for f in files:
                path = os.path.join(root, f)
                try:
                    mtimes[path] = os.path.getmtime(path)
                except OSError:
                    pass
    if os.path.exists('build.py'):
        try:
            mtimes['build.py'] = os.path.getmtime('build.py')
        except OSError:
            pass
    return mtimes


class DevServerHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP handler serving _site/ with no-cache headers and /__livereload endpoint."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=OUTPUT_DIR, **kwargs)

    def log_message(self, format, *args):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        if self.path.startswith('/__livereload'):
            build_id_path = os.path.join(OUTPUT_DIR, '.build_id')
            try:
                with open(build_id_path, 'r', encoding='utf-8') as f:
                    payload = f.read().strip().encode('utf-8')
            except OSError:
                payload = str(RELOAD_VERSION).encode('utf-8')

            self.send_response(200)
            self.send_header('Content-Type', 'text/plain; charset=utf-8')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            try:
                self.wfile.write(payload)
            except (BrokenPipeError, ConnectionResetError):
                pass
            return

        super().do_GET()


class ThreadingDevServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


def run_server():
    """Runs the persistent development server and rebuilds on file changes."""
    global SERVER_STOPPING
    build_site()

    print(f"\nStarting development server on port {PORT} with live reload...")
    httpd = ThreadingDevServer(("", PORT), DevServerHandler)
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()
    print(f"Dev server running at: http://localhost:{PORT}/ (cache disabled, auto-reload enabled)")

    last_mtimes = get_file_mtimes()
    try:
        while True:
            time.sleep(0.4)
            current_mtimes = get_file_mtimes()
            if current_mtimes != last_mtimes:
                print("\nChange detected! Rebuilding site...")
                try:
                    build_site()
                    print("Rebuild complete. Connected browsers notified to reload.")
                except Exception as e:
                    print(f"Error during build: {e}")
                last_mtimes = get_file_mtimes()
    except KeyboardInterrupt:
        print("\nStopping development server...")
        SERVER_STOPPING = True
        httpd.shutdown()
        httpd.server_close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Build the diodesign single-page website.')
    parser.add_argument('--server', action='store_true', help='Start a local dev server and watch for changes.')
    parser.add_argument('--clear', action='store_true', help='Clear the generated _site/ directory.')
    args = parser.parse_args()

    if args.clear:
        if os.path.exists(OUTPUT_DIR):
            shutil.rmtree(OUTPUT_DIR)
            print(f"Removed {OUTPUT_DIR}/.")
    elif args.server:
        run_server()
    else:
        build_site()
