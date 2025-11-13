"""Web service that accepts a text and returns its language code."""

import os
from flask import Flask, request, jsonify, send_file
from langdetect import detect, detect_langs, LangDetectException

app = Flask(__name__)


@app.route("/")
def serve_ui():
    """Serves the index.html UI to interact with the API via POST requests."""
    here = os.path.dirname(os.path.abspath(__file__))
    index_path = os.path.join(here, 'index.html')
    print(here, index_path)
    if not os.path.exists(index_path):
        return "index.html not found", 404
    return send_file(index_path)

@app.route("/instance", methods=['GET'])    
def instance_info():
    dirs = os.listdir('/var/lib/cloud/instances/')
    return dirs[0]


@app.route("/detect", methods=['GET', 'POST'])
def detect_route():
    """Identifies the language of the text."""
    if request.method == 'GET':
        query = request.args.get('text')
    else:
        payload = request.get_json(silent=True) or {}
        query = payload.get('text') or request.form.get('text')
    if not query:
        return jsonify({"error": "missing 'text' parameter"}), 400
    try:
        language = detect(query)
    except LangDetectException as e:
        return jsonify({"error": "could not detect language", "details": str(e)}), 400
    if request.method == 'GET':
        return language
    return jsonify({"language": language})


@app.route("/detect_probs", methods=['GET', 'POST'])
def detect_probs():
    """
    Returns a JSON list of candidate languages with probabilities.
    Example: GET /detect_probs?text=Hello%20world
    """
    if request.method == 'GET':
        text = request.args.get('text')
    else:
        payload = request.get_json(silent=True) or {}
        text = payload.get('text') or request.form.get('text')
    if not text:
        return jsonify({"error": "missing 'text' parameter"}), 400
    try:
        results = detect_langs(text)
    except LangDetectException as e:
        return jsonify({"error": "could not detect language", "details": str(e)}), 400

    languages = [{"lang": r.lang, "prob": r.prob} for r in results]
    return jsonify({"languages": languages})


@app.route("/is_language", methods=['GET', 'POST'])
def is_language():
    """
    Checks whether the provided text is in the specified language.
    Example: GET /is_language?text=Hola%20mundo&lang=es
    Returns JSON with requested, detected, probability and match (true/false).
    """
    if request.method == 'GET':
        text = request.args.get('text')
        requested_lang = request.args.get('lang')
    else:
        payload = request.get_json(silent=True) or {}
        text = payload.get('text') or request.form.get('text')
        requested_lang = payload.get('lang') or request.form.get('lang')
    if not text or not requested_lang:
        return jsonify({"error": "missing 'text' or 'lang' parameter"}), 400
    try:
        results = detect_langs(text)
    except LangDetectException as e:
        return jsonify({"error": "could not detect language", "details": str(e)}), 400

    top = results[0]
    match = top.lang.lower() == requested_lang.lower()
    return jsonify({
        "requested": requested_lang,
        "detected": top.lang,
        "probability": top.prob,
        "match": match
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
