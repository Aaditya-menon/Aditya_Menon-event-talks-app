import os
import re
import json
import time
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from flask import Flask, jsonify, render_template, request
from bs4 import BeautifulSoup

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
HISTORY_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tweet_history.json")

# In-memory cache for feed data
feed_cache = {
    "data": None,
    "last_fetched": 0
}
CACHE_DURATION = 3600  # Cache feed for 1 hour by default

def load_history():
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print("Error loading history:", e)
            return []
    return []

def save_history(history):
    try:
        with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
            json.dump(history, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print("Error saving history:", e)

def clean_html_for_tweet(html_content):
    if not html_content:
        return ""
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Replace code blocks or code inline with single quotes or backticks
    for code in soup.find_all('code'):
        if code.string:
            code.replace_with(f"`{code.string}`")
            
    # Replace list items with standard list characters
    for li in soup.find_all('li'):
        li.insert_before('\n- ')
        
    text = soup.get_text()
    
    # Remove excessive whitespace
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n\s*\n+', '\n', text)
    return text.strip()

def fetch_and_parse_feed():
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        req = urllib.request.Request(FEED_URL, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as response:
            xml_data = response.read()
            
        root = ET.fromstring(xml_data)
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        entries = root.findall('atom:entry', ns)
        
        parsed_entries = []
        for entry in entries:
            title_val = entry.find('atom:title', ns)
            date_str = title_val.text.strip() if title_val is not None else "Unknown Date"
            
            updated_val = entry.find('atom:updated', ns)
            updated_str = updated_val.text.strip() if updated_val is not None else ""
            
            link_val = entry.find('atom:link', ns)
            link_str = link_val.attrib.get('href', '').strip() if link_val is not None else ""
            
            content_val = entry.find('atom:content', ns)
            content_html = content_val.text if content_val is not None else ""
            
            # Sub-items parsing (by <h3> tags)
            pattern = re.compile(r'<h3>(.*?)</h3>', re.DOTALL)
            headers_found = pattern.findall(content_html)
            sections = re.split(r'<h3>.*?</h3>', content_html, flags=re.DOTALL)
            
            items = []
            
            # If no <h3> tags found, treat whole entry as one item
            if not headers_found:
                text_content = clean_html_for_tweet(content_html)
                # Fallback to general content, strip HTML tags for text
                soup = BeautifulSoup(content_html, 'html.parser')
                clean_text = soup.get_text().strip()
                item_id = f"{date_str.replace(' ', '_').replace(',', '')}_item_1"
                items.append({
                    'id': item_id,
                    'type': 'Update',
                    'html': content_html,
                    'text': clean_text
                })
            else:
                for i, h_type in enumerate(headers_found):
                    sec_html = sections[i+1].strip() if i+1 < len(sections) else ""
                    text_content = clean_html_for_tweet(sec_html)
                    item_id = f"{date_str.replace(' ', '_').replace(',', '')}_item_{i+1}"
                    items.append({
                        'id': item_id,
                        'type': h_type.strip(),
                        'html': sec_html,
                        'text': text_content
                    })
                    
            parsed_entries.append({
                'date': date_str,
                'updated': updated_str,
                'link': link_str,
                'items': items
            })
            
        return parsed_entries, None
    except Exception as e:
        import traceback
        traceback.print_exc()
        return [], str(e)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    current_time = time.time()
    
    if force_refresh or not feed_cache["data"] or (current_time - feed_cache["last_fetched"] > CACHE_DURATION):
        data, err = fetch_and_parse_feed()
        if err:
            return jsonify({'success': False, 'error': err}), 500
        feed_cache["data"] = data
        feed_cache["last_fetched"] = current_time
        
    return jsonify({
        'success': True,
        'data': feed_cache["data"],
        'last_fetched': datetime.fromtimestamp(feed_cache["last_fetched"]).strftime('%Y-%m-%d %H:%M:%S')
    })

@app.route('/api/history', methods=['GET', 'POST'])
def handle_history():
    if request.method == 'GET':
        history = load_history()
        return jsonify({'success': True, 'data': history})
    elif request.method == 'POST':
        try:
            req_data = request.json
            if not req_data or 'item_id' not in req_data or 'tweet_text' not in req_data:
                return jsonify({'success': False, 'error': 'Missing required fields'}), 400
                
            history = load_history()
            
            # Add new entry
            new_entry = {
                'id': req_data.get('item_id'),
                'date': req_data.get('date', ''),
                'type': req_data.get('type', 'Update'),
                'tweet_text': req_data.get('tweet_text'),
                'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'link': req_data.get('link', '')
            }
            
            history.insert(0, new_entry) # Put latest first
            save_history(history)
            
            return jsonify({'success': True, 'data': new_entry})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    # Running on local development server
    app.run(host='127.0.0.1', port=5000, debug=True)
