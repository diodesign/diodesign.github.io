import os
import math
import sys
import subprocess
import shutil

# Auto-setup: Ensure PyYAML is installed
try:
    import yaml
except ImportError:
    print("PyYAML not found. Attempting to install...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "PyYAML"])
        import yaml
        print("Successfully installed PyYAML.")
    except Exception as e:
        print(f"Error: Could not install PyYAML. Please run 'pip install PyYAML' manually.")
        sys.exit(1)

# Configuration
DATA_DIR = 'src/data'
TEMPLATE_DIR = 'src/templates'
OUTPUT_DIR = '.'
LOG_ENTRIES_PER_PAGE = 5

def load_data(filename):
    path = os.path.join(DATA_DIR, filename)
    with open(path, 'r') as f:
        return yaml.safe_load(f)

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

def build_log_pages(data_file, title, subtitle, folder_name):
    entries = load_data(data_file)
    entries.sort(key=lambda x: x['date'], reverse=True)
    
    # Build individual entry pages
    for entry in entries:
        entry_context = {
            'page_title': entry['title'],
            'entry_title': entry['title'],
            'entry_date': entry['date'],
            'entry_byline': entry['byline'],
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

def prepare_output_directory():
    """Removes old generated files and directories to ensure a clean build."""
    # Clean root .html files
    for item in os.listdir(OUTPUT_DIR):
        if item.endswith('.html'):
            os.remove(os.path.join(OUTPUT_DIR, item))
    
    # Purge generated subdirectories to remove stale entries/pages
    dirs_to_clean = ['about', 'contact', 'work-log', 'life-log']
    for d in dirs_to_clean:
        dir_path = os.path.join(OUTPUT_DIR, d)
        if os.path.exists(dir_path):
            print(f"Cleaning {d}/...")
            shutil.rmtree(dir_path)

def main():
    # Handle standalone --clear flag
    if len(sys.argv) > 1 and sys.argv[1] == '--clear':
        prepare_output_directory()
        print("Generated files cleared.")
        return

    # Prepare for a fresh build
    prepare_output_directory()

    # Build splash page
    build_page('index.html', {'page_title': 'Home'}, 'index.html')
    
    # Build about page
    about_data = load_data('about.yaml')
    build_page('page.html', {
        'page_title': about_data['title'],
        'page_subtitle': about_data['subtitle'],
        'page_content': about_data['content']
    }, 'about/index.html')
    
    # Build contact page
    contact_data = load_data('contact.yaml')
    build_page('page.html', {
        'page_title': contact_data['title'],
        'page_subtitle': contact_data['subtitle'],
        'page_content': contact_data['content']
    }, 'contact/index.html')
    
    # Build logs
    build_log_pages('work-log.yaml', 'Work Log', 'Chronicles of engineering and research', 'work-log')
    build_log_pages('life-log.yaml', 'Life Log', 'Personal updates and musings', 'life-log')

    # Start server if requested
    if '--server' in sys.argv:
        print("\nBuild successful. Starting server on port 8000...")
        try:
            # Using -m http.server for simplicity
            subprocess.run([sys.executable, "-m", "http.server", "8000"])
        except KeyboardInterrupt:
            print("\nServer stopped.")

if __name__ == '__main__':
    main()
