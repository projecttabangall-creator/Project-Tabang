from flask import Flask, jsonify, request
from flask_cors import CORS
from pyfingerprint.pyfingerprint import PyFingerprint
from dotenv import load_dotenv
import json
import os
import requests as http_requests

load_dotenv()

app = Flask(__name__)
CORS(app)

FINGERPRINT_PORT = os.getenv("FINGERPRINT_PORT", "/dev/ttyS0")
FINGERPRINT_BAUD = int(os.getenv("FINGERPRINT_BAUD", "57600"))
API_BASE_URL = os.getenv("API_BASE_URL", "https://project-tabang---claude-code.web.app/api")
FINGERPRINT_LOGIN_SECRET = os.getenv("FINGERPRINT_LOGIN_SECRET", "")
ENROLLMENTS_FILE = os.getenv(
    "FINGERPRINT_ENROLLMENTS_FILE",
    os.path.join(os.path.dirname(__file__), "enrollments.json"),
)

enrolled_identities = {}
enrollment_status = {}
VALID_ROLES = {"worker", "admin", "superadmin"}
UNKNOWN_SENSOR_TEMPLATE_MESSAGE = (
    "Fingerprint already exists on this device but is not linked to an account. "
    "Ask an admin to reset the sensor or repair enrollments.json."
)
DUPLICATE_FINGERPRINT_MESSAGE = "Fingerprint already enrolled to another account."


def load_enrollments():
    global enrolled_identities
    if not os.path.exists(ENROLLMENTS_FILE):
        enrolled_identities = {}
        return

    try:
        with open(ENROLLMENTS_FILE, "r", encoding="utf-8") as fp:
            data = json.load(fp)
        enrolled_identities = sanitize_enrollments(data)
    except Exception as error:
        print(f"[FINGERPRINT SERVICE] Failed to load enrollments: {error}")
        enrolled_identities = {}


def sanitize_enrollments(data):
    if not isinstance(data, dict):
        return {}

    sanitized = {}
    for user_id, record in data.items():
        if not isinstance(user_id, str) or not isinstance(record, dict):
            print(f"[FINGERPRINT SERVICE] Ignoring malformed enrollment for {user_id}")
            continue

        position = record.get("position")
        role = record.get("role")
        if not isinstance(position, int) or role not in VALID_ROLES:
            print(f"[FINGERPRINT SERVICE] Ignoring invalid enrollment for {user_id}")
            continue

        sanitized[user_id] = {
            "position": position,
            "role": role,
        }

    return sanitized


def save_enrollments():
    try:
        with open(ENROLLMENTS_FILE, "w", encoding="utf-8") as fp:
            json.dump(enrolled_identities, fp, indent=2, sort_keys=True)
    except Exception as error:
        print(f"[FINGERPRINT SERVICE] Failed to save enrollments: {error}")


def set_enrollment_status(user_id, stage, message):
    enrollment_status[user_id] = {
        "stage": stage,
        "message": message,
    }


def get_sensor():
    try:
        fp = PyFingerprint(FINGERPRINT_PORT, FINGERPRINT_BAUD, 0xFFFFFFFF, 0x00000000)
        if not fp.verifyPassword():
            raise Exception("Invalid sensor password")
        return fp
    except Exception as error:
        raise Exception(f"Fingerprint sensor not available: {error}")


def find_identity_by_position(position):
    for user_id, record in enrolled_identities.items():
        if record.get("position") == position:
            return user_id, record
    return None, None


def get_user_record(user_id):
    record = enrolled_identities.get(user_id)
    if not isinstance(record, dict):
        return None
    return record


def delete_template_if_present(fp, position):
    if not isinstance(position, int) or position < 0:
        return False

    try:
        fp.deleteTemplate(position)
        print(f"[ENROLL] Deleted old fingerprint template at position {position}")
        return True
    except Exception as error:
        print(
            f"[ENROLL] Warning: could not delete template at position {position}: {error}"
        )
        return False


def remove_stale_position(position):
    stale_user_ids = [
        existing_user_id
        for existing_user_id, record in enrolled_identities.items()
        if record.get("position") == position
    ]
    for existing_user_id in stale_user_ids:
        enrolled_identities.pop(existing_user_id, None)


def reject_duplicate(user_id, position, existing_user_id, existing_record):
    if position < 0:
        return None

    if not existing_user_id:
        return UNKNOWN_SENSOR_TEMPLATE_MESSAGE

    if existing_user_id != user_id:
        existing_role = existing_record.get("role", "another account")
        print(
            f"[ENROLL] Duplicate fingerprint at position {position}; "
            f"owned by {existing_role} {existing_user_id}"
        )
        return DUPLICATE_FINGERPRINT_MESSAGE

    return None


def sync_biometric_status(user_id, role, auth_token, biometric_enrolled):
    headers = {}
    if auth_token:
        headers["Authorization"] = f"Bearer {auth_token}"

    if role == "worker":
        return http_requests.patch(
            f"{API_BASE_URL}/workers/{user_id}/biometric",
            json={"biometricEnrolled": biometric_enrolled},
            headers=headers,
            timeout=10,
        )

    return http_requests.patch(
        f"{API_BASE_URL}/auth/profile/biometric",
        json={"biometricEnrolled": biometric_enrolled},
        headers=headers,
        timeout=10,
    )


def request_login_token(user_id, role):
    if not FINGERPRINT_LOGIN_SECRET:
        raise Exception("FINGERPRINT_LOGIN_SECRET is not configured")

    return http_requests.post(
        f"{API_BASE_URL}/auth/fingerprint-login-token",
        json={"userId": user_id, "role": role},
        headers={"x-fingerprint-login-secret": FINGERPRINT_LOGIN_SECRET},
        timeout=10,
    )


@app.route("/fingerprint/enroll", methods=["POST"])
def enroll():
    data = request.json or {}
    user_id = data.get("userId") or data.get("workerId")
    role = data.get("role") or ("worker" if data.get("workerId") else None)
    auth_token = data.get("authToken") or data.get("adminToken")

    if not user_id:
        return jsonify({"error": "userId is required"}), 400

    if role not in VALID_ROLES:
        return jsonify({"error": "role is required"}), 400

    set_enrollment_status(user_id, "starting", "Preparing the fingerprint scanner.")

    try:
        fp = get_sensor()
    except Exception as error:
        set_enrollment_status(user_id, "error", str(error))
        return jsonify({"error": str(error)}), 503

    try:
        set_enrollment_status(
            user_id,
            "waiting_first_scan",
            "Waiting for the first fingerprint scan.",
        )
        print(f"[ENROLL] Waiting for first scan (user: {user_id}, role: {role})...")
        while not fp.readImage():
            pass

        set_enrollment_status(
            user_id,
            "first_scan_captured",
            "First fingerprint captured. Remove the finger from the scanner.",
        )
        fp.convertImage(0x01)

        result = fp.searchTemplate()
        position = result[0]
        user_record = get_user_record(user_id)
        is_reenrollment = user_record is not None
        if position >= 0:
            existing_user_id, existing_record = find_identity_by_position(position)
            duplicate_error = reject_duplicate(
                user_id,
                position,
                existing_user_id,
                existing_record,
            )
            if duplicate_error:
                set_enrollment_status(
                    user_id,
                    "error",
                    duplicate_error,
                )
                return jsonify({"error": duplicate_error}), 409

        set_enrollment_status(
            user_id,
            "waiting_finger_removal",
            "Remove the finger, then place the same finger again.",
        )
        while fp.readImage():
            pass

        set_enrollment_status(
            user_id,
            "waiting_second_scan",
            "Waiting for the second fingerprint scan.",
        )
        while not fp.readImage():
            pass

        set_enrollment_status(
            user_id,
            "second_scan_captured",
            "Second fingerprint captured. Finalizing enrollment.",
        )
        fp.convertImage(0x02)

        if fp.compareCharacteristics() == 0:
            set_enrollment_status(
                user_id,
                "error",
                "The two scans did not match. Please try again.",
            )
            return jsonify({"error": "Fingerprints did not match. Try again."}), 400

        fp.createTemplate()

        if user_record:
            old_position = user_record.get("position")
            delete_template_if_present(fp, old_position)
            remove_stale_position(old_position)

        stored_position = fp.storeTemplate()

        enrolled_identities[user_id] = {
            "position": stored_position,
            "role": role,
        }
        save_enrollments()

        print(
            f"[ENROLL] Stored fingerprint at position {stored_position} for {role} {user_id}"
        )

        try:
            resp = sync_biometric_status(user_id, role, auth_token, True)
            if resp.status_code != 200:
                print(f"[ENROLL] Warning: backend update returned {resp.status_code}")
        except Exception as error:
            print(f"[ENROLL] Warning: could not update backend - {error}")

        set_enrollment_status(
            user_id,
            "complete",
            "Fingerprint re-enrolled successfully."
            if is_reenrollment
            else "Fingerprint enrolled successfully.",
        )
        return jsonify({
            "success": True,
            "message": (
                "Fingerprint re-enrolled successfully."
                if is_reenrollment
                else "Fingerprint enrolled successfully"
            ),
        }), 200
    except Exception as error:
        set_enrollment_status(user_id, "error", f"Enrollment failed: {error}")
        return jsonify({"error": f"Enrollment failed: {error}"}), 500


@app.route("/fingerprint/enroll-status/<user_id>", methods=["GET"])
def enroll_status(user_id):
    status = enrollment_status.get(user_id)
    if not status:
        return jsonify({"stage": "idle", "message": "No active enrollment."}), 200
    return jsonify(status), 200


@app.route("/fingerprint/verify", methods=["POST"])
def verify():
    data = request.json or {}
    worker_id = data.get("workerId")

    if not worker_id:
        return jsonify({"error": "workerId is required"}), 400

    worker_record = enrolled_identities.get(worker_id)
    if not worker_record or worker_record.get("role") != "worker":
        return jsonify({"success": False, "message": "No fingerprint enrolled for this worker"}), 200

    try:
        fp = get_sensor()
    except Exception as error:
        return jsonify({"error": str(error)}), 503

    print(f"[VERIFY] Waiting for scan (worker: {worker_id})...")
    while not fp.readImage():
        pass
    fp.convertImage(0x01)

    result = fp.searchTemplate()
    position = result[0]
    accuracy = result[1]

    if position == worker_record.get("position"):
        print(f"[VERIFY] Match! Worker {worker_id}, accuracy {accuracy}")
        return jsonify({"success": True, "workerId": worker_id}), 200

    print(f"[VERIFY] No match for worker {worker_id}")
    return jsonify({"success": False, "message": "Fingerprint not recognized"}), 200


@app.route("/fingerprint/login", methods=["POST"])
def fingerprint_login():
    try:
        fp = get_sensor()
    except Exception as error:
        return jsonify({"error": str(error)}), 503

    print("[LOGIN] Waiting for fingerprint scan...")
    while not fp.readImage():
        pass
    fp.convertImage(0x01)

    result = fp.searchTemplate()
    position = result[0]
    accuracy = result[1]

    if position < 0:
        print("[LOGIN] No fingerprint match")
        return jsonify({"success": False, "message": "Fingerprint not recognized"}), 200

    user_id, record = find_identity_by_position(position)
    if not user_id or not record:
        print(f"[LOGIN] Template position {position} has no linked account")
        return jsonify({"success": False, "message": "Fingerprint is not linked to an account"}), 200

    role = record.get("role")
    if role not in {"worker", "admin", "superadmin"}:
        return jsonify({"success": False, "message": "Unsupported fingerprint role"}), 200

    try:
        resp = request_login_token(user_id, role)
        payload = resp.json()
    except Exception as error:
        print(f"[LOGIN] Backend token request failed: {error}")
        return jsonify({"error": f"Could not contact backend: {error}"}), 503

    if resp.status_code != 200:
        print(f"[LOGIN] Backend rejected fingerprint login: {resp.status_code} {payload}")
        return jsonify({
            "success": False,
            "message": payload.get("error", "Fingerprint login rejected"),
        }), 200

    print(f"[LOGIN] Match! {role} {user_id}, accuracy {accuracy}")
    return jsonify({
        "success": True,
        "customToken": payload.get("customToken"),
        "user": payload.get("user"),
    }), 200


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


load_enrollments()


if __name__ == "__main__":
    port = int(os.getenv("FLASK_PORT", "5000"))
    print(f"[FINGERPRINT SERVICE] Starting on port {port}")
    print(f"[FINGERPRINT SERVICE] Sensor: {FINGERPRINT_PORT} @ {FINGERPRINT_BAUD} baud")
    print(f"[FINGERPRINT SERVICE] Loaded {len(enrolled_identities)} enrollment(s)")
    app.run(host="0.0.0.0", port=port, debug=False)
