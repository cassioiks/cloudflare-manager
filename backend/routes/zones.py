from flask import Blueprint, current_app, jsonify, request
from cloudflare_client import CloudflareAPIError

zones_bp = Blueprint('zones', __name__)


@zones_bp.route('/api/zones')
def list_zones():
    try:
        cf = current_app.config['CF_CLIENT']
        zones = cf.list_zones()
        return jsonify([{
            "id": z["id"],
            "name": z["name"],
            "status": z["status"],
        } for z in zones])
    except CloudflareAPIError as e:
        return jsonify({"error": str(e)}), 502


@zones_bp.route('/api/zones/<zone_id>/records')
def list_records(zone_id):
    try:
        cf = current_app.config['CF_CLIENT']
        record_type = request.args.get('type')
        records = cf.list_records(zone_id, record_type=record_type)
        return jsonify([{
            "id": r["id"],
            "zone_id": zone_id,
            "type": r["type"],
            "name": r["name"],
            "content": r["content"],
            "ttl": r["ttl"],
            "proxied": r.get("proxied", False),
            "proxiable": r.get("proxiable", False),
        } for r in records])
    except CloudflareAPIError as e:
        return jsonify({"error": str(e)}), 502
