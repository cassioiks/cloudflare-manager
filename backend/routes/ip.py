import time
from flask import Blueprint, jsonify
from scheduler import get_public_ip

ip_bp = Blueprint('ip', __name__)

_ip_cache = {"ip": None, "timestamp": 0}
CACHE_TTL = 30


@ip_bp.route('/api/ip')
def current_ip():
    now = time.time()
    if _ip_cache["ip"] and (now - _ip_cache["timestamp"]) < CACHE_TTL:
        return jsonify({"ip": _ip_cache["ip"]})

    try:
        ip = get_public_ip()
        _ip_cache["ip"] = ip
        _ip_cache["timestamp"] = now
        return jsonify({"ip": ip})
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 502
