import requests
import json

# Configuration
OLLAMA_URL = "http://localhost:11434/api/generate"  # Ollama API endpoint
MODEL = "llama3.2"  # Replace with the model you're using (e.g., "llama2", "mistral")
PROMPT = "Hello, how can I assist you today?"  # Test prompt
MAX_TOKENS = 50  # Limit the response length

# Payload for the POST request
payload = {
    "model": MODEL,
    "prompt": PROMPT,
    "max_tokens": MAX_TOKENS
}

# Headers
headers = {
    "Content-Type": "application/json"
}

def test_ollama():
    try:
        # Send POST request to Ollama
        response = requests.post(OLLAMA_URL, headers=headers, data=json.dumps(payload))
        
        # Check if the request was successful
        response.raise_for_status()

        # Parse and print the response
        result = response.json()
        print("Response from Ollama:")
        print(json.dumps(result, indent=2))

    except requests.exceptions.ConnectionError:
        print("Error: Could not connect to Ollama at", OLLAMA_URL)
        print("Ensure Ollama is running on port 11434.")
    except requests.exceptions.HTTPError as http_err:
        print(f"HTTP error occurred: {http_err}")
        print("Response:", response.text)
    except ValueError:
        print("Error: Invalid JSON response from Ollama")
        print("Response:", response.text)
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    print(f"Testing Ollama at {OLLAMA_URL} with model '{MODEL}'...")
    test_ollama()