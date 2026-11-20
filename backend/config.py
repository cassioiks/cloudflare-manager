import os
import json
from dataclasses import dataclass, field

CONFIG_PATH = os.environ.get('CONFIG_PATH', '/app/data/config.json')
LOG_PATH = os.environ.get('LOG_PATH', '/app/data/update_log.json')
MAX_LOG_ENTRIES = 100


@dataclass
class AppConfig:
    api_token: str
    managed_records: list = field(default_factory=list)
    schedule_interval_minutes: int = 5
    schedule_enabled: bool = True
    last_update: str = None
    last_ip: str = None


def load_config() -> AppConfig:
    api_token = os.environ.get('CF_API_TOKEN')
    if not api_token:
        raise RuntimeError("CF_API_TOKEN environment variable is required")

    config = AppConfig(api_token=api_token)

    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH) as f:
            data = json.load(f)
        config.managed_records = data.get('managed_records', [])
        config.schedule_interval_minutes = data.get('schedule', {}).get('interval_minutes', 5)
        config.schedule_enabled = data.get('schedule', {}).get('enabled', True)
        config.last_update = data.get('last_update')
        config.last_ip = data.get('last_ip')

    return config


def save_config(config: AppConfig):
    data = {
        "managed_records": config.managed_records,
        "schedule": {
            "interval_minutes": config.schedule_interval_minutes,
            "enabled": config.schedule_enabled,
        },
        "last_update": config.last_update,
        "last_ip": config.last_ip,
    }
    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
    with open(CONFIG_PATH, 'w') as f:
        json.dump(data, f, indent=2)


def load_update_log() -> list:
    if os.path.exists(LOG_PATH):
        with open(LOG_PATH) as f:
            return json.load(f)
    return []


def append_update_log(entry: dict):
    log = load_update_log()
    log.insert(0, entry)
    log = log[:MAX_LOG_ENTRIES]
    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
    with open(LOG_PATH, 'w') as f:
        json.dump(log, f, indent=2)
