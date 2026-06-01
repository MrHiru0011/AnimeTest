from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
from datetime import datetime
import os
import json

app = Flask(__name__)
CORS(app)

# Config
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'mp4', 'mkv', 'avi', 'webm', 'mov'}
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE

# Database simulasi (gunakan file JSON)
LIBRARY_FILE = 'anime_library.json'

def load_library():
    if os.path.exists(LIBRARY_FILE):
        with open(LIBRARY_FILE, 'r') as f:
            return json.load(f)
    return {"anime": [], "watchlist": []}

def save_library(data):
    with open(LIBRARY_FILE, 'w') as f:
        json.dump(data, f, indent=2)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "message": "HilzNime Backend Running 🎬"}), 200

@app.route('/api/library', methods=['GET'])
def get_library():
    library = load_library()
    return jsonify(library), 200

@app.route('/api/upload', methods=['POST'])
def upload_video():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
        
        file = request.files['file']
        anime_title = request.form.get('title', 'Untitled')
        anime_episode = request.form.get('episode', '1')
        
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        if not allowed_file(file.filename):
            return jsonify({"error": "File format not allowed"}), 400
        
        # Save file
        filename = secure_filename(f"{anime_title}_EP{anime_episode}_{datetime.now().timestamp()}.mp4")
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Update library
        library = load_library()
        anime_entry = {
            "id": int(datetime.now().timestamp()),
            "title": anime_title,
            "episode": int(anime_episode),
            "filename": filename,
            "uploaded_at": datetime.now().isoformat(),
            "progress": 0,
            "rating": 0,
            "notes": ""
        }
        library["anime"].append(anime_entry)
        save_library(library)
        
        return jsonify({
            "status": "success",
            "message": "Video uploaded successfully",
            "anime": anime_entry
        }), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/video/<filename>', methods=['GET'])
def get_video(filename):
    try:
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(filename))
        if not os.path.exists(filepath):
            return jsonify({"error": "File not found"}), 404
        return send_file(filepath, mimetype='video/mp4')
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/anime/<int:anime_id>', methods=['GET', 'PUT'])
def manage_anime(anime_id):
    library = load_library()
    
    if request.method == 'GET':
        for anime in library["anime"]:
            if anime["id"] == anime_id:
                return jsonify(anime), 200
        return jsonify({"error": "Anime not found"}), 404
    
    elif request.method == 'PUT':
        data = request.json
        for anime in library["anime"]:
            if anime["id"] == anime_id:
                anime["progress"] = data.get("progress", anime["progress"])
                anime["rating"] = data.get("rating", anime["rating"])
                anime["notes"] = data.get("notes", anime["notes"])
                save_library(library)
                return jsonify({"status": "success", "anime": anime}), 200
        return jsonify({"error": "Anime not found"}), 404

@app.route('/api/anime/<int:anime_id>', methods=['DELETE'])
def delete_anime(anime_id):
    library = load_library()
    
    for idx, anime in enumerate(library["anime"]):
        if anime["id"] == anime_id:
            filename = anime["filename"]
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            
            if os.path.exists(filepath):
                os.remove(filepath)
            
            library["anime"].pop(idx)
            save_library(library)
            return jsonify({"status": "success", "message": "Anime deleted"}), 200
    
    return jsonify({"error": "Anime not found"}), 404

@app.route('/api/watchlist', methods=['GET', 'POST'])
def manage_watchlist():
    library = load_library()
    
    if request.method == 'GET':
        return jsonify(library["watchlist"]), 200
    
    elif request.method == 'POST':
        anime_id = request.json.get("anime_id")
        for anime in library["anime"]:
            if anime["id"] == anime_id:
                if anime_id not in library["watchlist"]:
                    library["watchlist"].append(anime_id)
                    save_library(library)
                return jsonify({"status": "success", "watchlist": library["watchlist"]}), 200
        return jsonify({"error": "Anime not found"}), 404

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
