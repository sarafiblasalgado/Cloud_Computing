# Root description
curl "http://localhost:5000/"

# Instance info
curl "http://localhost:5000/instance"

# Detect (returns language code, e.g. "en")
curl "http://localhost:5000/detect?text=Hello%20world"

# Detect (using URL-encoding helper)
curl -G --data-urlencode "text=Bonjour le monde" "http://localhost:5000/detect"

# Detect probabilities (JSON list)
curl "http://localhost:5000/detect_probs?text=Hello%20world"

# Detect probabilities (with URL-encoding)
curl -G --data-urlencode "text=¿Cómo estás?" "http://localhost:5000/detect_probs"

# Is language? (checks if detected top language matches requested)
curl "http://localhost:5000/is_language?text=Hola%20mundo&lang=es"

# Is language? (using --data-urlencode)
curl -G --data-urlencode "text=Hallo Welt" --data-urlencode "lang=de" "http://localhost:5000/is_language"

# Examples of error cases
curl "http://localhost:5000/detect"                      # missing text -> 400
curl "http://localhost:5000/is_language?text=Hi"         # missing lang -> 400