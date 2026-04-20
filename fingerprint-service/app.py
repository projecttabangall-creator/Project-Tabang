from flask import Flask, jsonify, request
from flask_cors import CORS
from pyfingerprint.pyfingerprint import PyFingerprint
from dotenv import load_dotenv
import os
import requests as http_requests

load_dotenv()

app = Flask(__name__)
CORS(app)  # Allow frontend (localhost:3000) to call this service

FINGERPRINT_PORT = os.getenv("FINGERPRINT_PORT", "/dev/ttyS0")
FINGERPRINT_BAUD = int(os.getenv("FINGERPRINT_BAUD", "57600"))
API_BASE_URL = os.getenv("API_BASE_URL", "https://project-tabang---claude-code.web.app/api")

# Key: worker Firestore document ID, Value: fingerprint position index on sensor
enrolled_workers = {}

def get_sensor():
    try:
        fp = PyFingerprint(FINGERPRINT_PORT, FINGERPRINT_BAUD, 0xFFFFFFFF, 0x00000000)
        if not fp.verifyPassword():
            raise Exception("Invalid sensor password")
        return fp
    except Exception as e:
        raise Exception(f"Fingerprint sensor not available: {e}")


@app.route("/fingerprint/enroll", methods=["POST"])
def enroll():
    data = request.json
    worker_id = data.get("workerId")
    admin_token = data.get("adminToken")

    if not worker_id:
        return jsonify({"error": "workerId is required"}), 400

    try:
        fp = get_sensor()
    except Exception as e:
        return jsonify({"error": str(e)}), 503

    # Scan 1
    print(f"[ENROLL] Waiting for first scan (worker: {worker_id})...")
    while not fp.readImage():
        pass
    fp.convertImage(0x01)

    result = fp.searchTemplate()
    if result[0] >= 0:
        return jsonify({"error": "Fingerprint already enrolled"}), 409

    # Scan 2
    print("[ENROLL] Remove finger, then place same finger again...")
    while fp.readImage():
        pass
    while not fp.readImage():
        pass
    fp.convertImage(0x02)

    if fp.compareCharacteristics() == 0:
        return jsonify({"error": "Fingerprints did not match. Try again."}), 400

    fp.createTemplate()
    position = fp.storeTemplate()
    enrolled_workers[worker_id] = position
    print(f"[ENROLL] Stored at position {position} for worker {worker_id}")

    # Update backend
    try:
        headers = {}
        if admin_token:
            headers["Authorization"] = f"Bearer {admin_token}"
        resp = http_requests.patch(
            f"{API_BASE_URL}/workers/{worker_id}/biometric",
            json={"biometricEnrolled": True},
            headers=headers,
            timeout=10
        )
        if resp.status_code != 200:
            print(f"[ENROLL] Warning: backend update returned {resp.status_code}")
    except Exception as e:
        print(f"[ENROLL] Warning: could not update backend — {e}")

    return jsonify({"success": True, "message": "Fingerprint enrolled successfully"}), 200


@app.route("/fingerprint/verify", methods=["POST"])
def verify():
    data = request.json
    worker_id = data.get("workerId")

    if not worker_id:
        return jsonify({"error": "workerId is required"}), 400

    if worker_id not in enrolled_workers:
        return jsonify({"success": False, "message": "No fingerprint enrolled for this worker"}), 200

    try:
        fp = get_sensor()
    except Exception as e:
        return jsonify({"error": str(e)}), 503

    print(f"[VERIFY] Waiting for scan (worker: {worker_id})...")
    while not fp.readImage():
        pass
    fp.convertImage(0x01)

    result = fp.searchTemplate()
    position = result[0]
    accuracy = result[1]

    if position == enrolled_workers[worker_id]:
        print(f"[VERIFY] Match! Worker {worker_id}, accuracy {accuracy}")
        return jsonify({"success": True, "workerId": worker_id}), 200

    print(f"[VERIFY] No match for worker {worker_id}")
    return jsonify({"success": False, "message": "Fingerprint not recognized"}), 200


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


if __name__ == "__main__":
    port = int(os.getenv("FLASK_PORT", "5000"))
    print(f"[FINGERPRINT SERVICE] Starting on port {port}")
    print(f"[FINGERPRINT SERVICE] Sensor: {FINGERPRINT_PORT} @ {FINGERPRINT_BAUD} baud")
    app.run(host="0.0.0.0", port=port, debug=False)
