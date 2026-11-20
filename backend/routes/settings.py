from flask import Blueprint, current_app, jsonify, request
from config import save_config
from scheduler import reschedule

settings_bp = Blueprint('settings', __name__)


@settings_bp.route('/api/settings')
def get_settings():
    config = current_app.config['APP_CONFIG']
    return jsonify({
        "managed_records": config.managed_records,
        "schedule": {
            "interval_minutes": config.schedule_interval_minutes,
            "enabled": config.schedule_enabled,
        },
        "last_update": config.last_update,
        "last_ip": config.last_ip,
    })


@settings_bp.route('/api/settings/schedule', methods=['POST'])
def update_schedule():
    body = request.get_json()
    interval = body.get('interval_minutes', 5)
    enabled = body.get('enabled', True)

    if not isinstance(interval, int) or interval < 1 or interval > 1440:
        return jsonify({"error": "interval_minutes must be between 1 and 1440"}), 400

    reschedule(current_app._get_current_object(), interval, enabled)

    return jsonify({
        "interval_minutes": interval,
        "enabled": enabled,
    })


@settings_bp.route('/api/settings/managed-records', methods=['POST'])
def update_managed_records():
    body = request.get_json()
    records = body.get('records', [])

    for rec in records:
        if not all(k in rec for k in ('record_id', 'zone_id', 'name')):
            return jsonify({"error": "Each record must have record_id, zone_id, and name"}), 400

    config = current_app.config['APP_CONFIG']
    seen = set()
    deduped = []
    for rec in records:
        key = (rec['zone_id'], rec['name'])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(rec)
    config.managed_records = deduped
    save_config(config)

    return jsonify({"managed_records": deduped})
