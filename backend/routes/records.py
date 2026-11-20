from flask import Blueprint, current_app, jsonify, request
from cloudflare_client import CloudflareAPIError
from scheduler import get_public_ip

records_bp = Blueprint('records', __name__)


@records_bp.route('/api/records', methods=['POST'])
def create_record():
    try:
        cf = current_app.config['CF_CLIENT']
        body = request.get_json()
        zone_id = body.pop('zone_id')
        result = cf.create_record(zone_id, body)
        return jsonify({
            "id": result["id"],
            "zone_id": zone_id,
            "type": result["type"],
            "name": result["name"],
            "content": result["content"],
            "ttl": result["ttl"],
            "proxied": result.get("proxied", False),
            "proxiable": result.get("proxiable", False),
        }), 201
    except CloudflareAPIError as e:
        return jsonify({"error": str(e)}), 502
    except KeyError:
        return jsonify({"error": "zone_id is required"}), 400


@records_bp.route('/api/records/<record_id>', methods=['PUT'])
def update_record(record_id):
    try:
        cf = current_app.config['CF_CLIENT']
        body = request.get_json()
        zone_id = body.pop('zone_id')
        result = cf.update_record(zone_id, record_id, body)
        return jsonify({
            "id": result["id"],
            "zone_id": zone_id,
            "type": result["type"],
            "name": result["name"],
            "content": result["content"],
            "ttl": result["ttl"],
            "proxied": result.get("proxied", False),
            "proxiable": result.get("proxiable", False),
        })
    except CloudflareAPIError as e:
        return jsonify({"error": str(e)}), 502
    except KeyError:
        return jsonify({"error": "zone_id is required"}), 400


@records_bp.route('/api/records/<record_id>', methods=['DELETE'])
def delete_record(record_id):
    try:
        cf = current_app.config['CF_CLIENT']
        body = request.get_json()
        zone_id = body.get('zone_id')
        if not zone_id:
            return jsonify({"error": "zone_id is required"}), 400
        cf.delete_record(zone_id, record_id)
        return jsonify({"success": True})
    except CloudflareAPIError as e:
        return jsonify({"error": str(e)}), 502


@records_bp.route('/api/records/bulk-update-ip', methods=['POST'])
def bulk_update_ip():
    try:
        cf = current_app.config['CF_CLIENT']
        body = request.get_json()
        records = body.get('records', [])
        if not records:
            return jsonify({"error": "records array is required"}), 400

        current_ip = get_public_ip()
        results = []

        for rec in records:
            try:
                cf.update_record(
                    zone_id=rec['zone_id'],
                    record_id=rec['record_id'],
                    record_data={
                        "type": "A",
                        "name": rec['name'],
                        "content": current_ip,
                        "ttl": rec.get('ttl', 120),
                        "proxied": rec.get('proxied', False),
                    },
                )
                results.append({"record_id": rec['record_id'], "name": rec['name'], "status": "success"})
            except Exception as e:
                results.append({"record_id": rec['record_id'], "name": rec['name'], "status": "error", "error": str(e)})

        return jsonify({"ip": current_ip, "results": results})
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 502
