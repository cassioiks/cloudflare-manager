import re
import requests
from datetime import datetime, timezone
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from cloudflare_client import CloudflareAPIError
from config import save_config, append_update_log

scheduler = BackgroundScheduler()
JOB_ID = 'dns_auto_update'

IP_SOURCES = [
    'https://api.ipify.org',
    'https://ifconfig.me/ip',
    'https://icanhazip.com',
]


def get_public_ip() -> str:
    for url in IP_SOURCES:
        try:
            resp = requests.get(url, timeout=5)
            ip = resp.text.strip()
            if re.match(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$', ip):
                return ip
        except Exception:
            continue
    raise RuntimeError("Could not determine public IP from any source")


def _find_record_id(cf_client, zone_id: str, name: str) -> str:
    try:
        recs = cf_client.list_records(zone_id, record_type="A")
    except Exception:
        return None
    for r in recs:
        if r.get('name') == name:
            return r.get('id')
    return None


def auto_update_dns(app):
    with app.app_context():
        config = app.config['APP_CONFIG']
        cf_client = app.config['CF_CLIENT']

        if not config.managed_records:
            return

        try:
            current_ip = get_public_ip()
        except RuntimeError as e:
            append_update_log({
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "message": str(e),
                "ip": None,
                "results": [],
            })
            return

        results = []
        for record in config.managed_records:
            if record.get('last_known_content') == current_ip:
                continue
            payload = {
                "type": "A",
                "name": record['name'],
                "content": current_ip,
                "ttl": 120,
                "proxied": record.get('proxied', False),
            }
            try:
                cf_client.update_record(
                    zone_id=record['zone_id'],
                    record_id=record['record_id'],
                    record_data=payload,
                )
                record['last_known_content'] = current_ip
                results.append({"name": record['name'], "status": "success"})
            except CloudflareAPIError as e:
                if e.status_code == 404:
                    fresh_id = _find_record_id(cf_client, record['zone_id'], record['name'])
                    if fresh_id:
                        try:
                            cf_client.update_record(
                                zone_id=record['zone_id'],
                                record_id=fresh_id,
                                record_data=payload,
                            )
                            record['record_id'] = fresh_id
                            record['last_known_content'] = current_ip
                            results.append({"name": record['name'], "status": "success", "healed": True})
                            continue
                        except Exception as e2:
                            results.append({"name": record['name'], "status": "error", "error": str(e2)})
                            continue
                results.append({"name": record['name'], "status": "error", "error": str(e)})
            except Exception as e:
                results.append({"name": record['name'], "status": "error", "error": str(e)})

        if not results and current_ip == config.last_ip:
            return

        config.last_ip = current_ip
        config.last_update = datetime.now(timezone.utc).isoformat()
        save_config(config)

        if results:
            append_update_log({
                "timestamp": config.last_update,
                "message": f"Updated IP to {current_ip}",
                "ip": current_ip,
                "results": results,
            })


def init_scheduler(app):
    config = app.config['APP_CONFIG']
    if config.schedule_enabled:
        scheduler.add_job(
            auto_update_dns,
            trigger=IntervalTrigger(minutes=config.schedule_interval_minutes),
            id=JOB_ID,
            args=[app],
            replace_existing=True,
        )
    if not scheduler.running:
        scheduler.start()


def reschedule(app, interval_minutes: int, enabled: bool):
    config = app.config['APP_CONFIG']
    config.schedule_interval_minutes = interval_minutes
    config.schedule_enabled = enabled
    save_config(config)

    if scheduler.get_job(JOB_ID):
        scheduler.remove_job(JOB_ID)

    if enabled:
        scheduler.add_job(
            auto_update_dns,
            trigger=IntervalTrigger(minutes=interval_minutes),
            id=JOB_ID,
            args=[app],
            replace_existing=True,
        )
