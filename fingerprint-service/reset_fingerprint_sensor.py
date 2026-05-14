from pyfingerprint.pyfingerprint import PyFingerprint
from dotenv import load_dotenv
import os

load_dotenv()

port = os.getenv("FINGERPRINT_PORT", "/dev/ttyS0")
baud = int(os.getenv("FINGERPRINT_BAUD", "57600"))

fp = PyFingerprint(port, baud, 0xFFFFFFFF, 0x00000000)

if not fp.verifyPassword():
    raise RuntimeError("Invalid fingerprint sensor password")

fp.clearDatabase()
print("Fingerprint sensor template database cleared.")
