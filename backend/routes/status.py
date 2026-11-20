from flask import Blueprint, current_app, jsonify
from config import load_update_log
from scheduler import get_public_ip, scheduler, JOB_ID

status_bp = Blueprint('status', __name__)


@status_bp.route('/api/status')
def get_status():
    config = current_app.config['APP_CONFIG']

    try:
        current_ip = get_public_ip()
    except RuntimeError:
        current_ip = None

    managed_status = []
    for rec in config.managed_records:
        match = rec.get('last_known_content') == current_ip if current_ip else None
        managed_status.append({
            "record_id": rec["record_id"],
            "zone_id": rec["zone_id"],
            "name": rec["name"],
            "proxied": rec.get("proxied", False),
            "last_known_content": rec.get("last_known_content"),
            "ip_match": match,
        })

    job = scheduler.get_job(JOB_ID)
    next_run = job.next_run_time.isoformat() if job and job.next_run_time else None

    log = load_update_log()

    return jsonify({
        "current_ip": current_ip,
        "last_update": config.last_update,
        "last_ip": config.last_ip,
        "schedule": {
            "enabled": config.schedule_enabled,
            "interval_minutes": config.schedule_interval_minutes,
            "next_run": next_run,
        },
        "managed_records": managed_status,
        "recent_log": log[:20],
    })
