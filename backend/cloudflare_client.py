import requests


class CloudflareAPIError(Exception):
    def __init__(self, message, errors=None, status_code=None):
        super().__init__(message)
        self.errors = errors or []
        self.status_code = status_code


class CloudflareClient:
    BASE_URL = "https://api.cloudflare.com/client/v4"

    def __init__(self, api_token: str):
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json",
        })

    def _request(self, method, path, **kwargs):
        url = f"{self.BASE_URL}{path}"
        resp = self.session.request(method, url, timeout=15, **kwargs)
        data = resp.json()

        if not data.get("success"):
            errors = data.get("errors", [])
            msg = errors[0].get("message", "Unknown error") if errors else "Unknown error"
            raise CloudflareAPIError(msg, errors=errors, status_code=resp.status_code)

        return data

    def list_zones(self, page=1, per_page=50) -> list:
        data = self._request("GET", "/zones", params={"page": page, "per_page": per_page})
        return data["result"]

    def list_records(self, zone_id: str, record_type: str = None, page=1, per_page=100) -> list:
        params = {"page": page, "per_page": per_page}
        if record_type:
            params["type"] = record_type
        data = self._request("GET", f"/zones/{zone_id}/dns_records", params=params)
        return data["result"]

    def get_record(self, zone_id: str, record_id: str) -> dict:
        data = self._request("GET", f"/zones/{zone_id}/dns_records/{record_id}")
        return data["result"]

    def create_record(self, zone_id: str, record_data: dict) -> dict:
        data = self._request("POST", f"/zones/{zone_id}/dns_records", json=record_data)
        return data["result"]

    def update_record(self, zone_id: str, record_id: str, record_data: dict) -> dict:
        data = self._request("PUT", f"/zones/{zone_id}/dns_records/{record_id}", json=record_data)
        return data["result"]

    def delete_record(self, zone_id: str, record_id: str) -> bool:
        self._request("DELETE", f"/zones/{zone_id}/dns_records/{record_id}")
        return True
