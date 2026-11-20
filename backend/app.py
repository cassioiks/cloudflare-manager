import os
from flask import Flask, send_from_directory
from flask_cors import CORS
from config import load_config
from cloudflare_client import CloudflareClient
from scheduler import init_scheduler


def create_app():
    static_dir = os.path.join(os.path.dirname(__file__), 'static')
    app = Flask(__name__, static_folder=static_dir, static_url_path='')
    CORS(app)

    app_config = load_config()
    cf_client = CloudflareClient(app_config.api_token)

    app.config['CF_CLIENT'] = cf_client
    app.config['APP_CONFIG'] = app_config

    from routes.zones import zones_bp
    from routes.records import records_bp
    from routes.ip import ip_bp
    from routes.status import status_bp
    from routes.settings import settings_bp

    app.register_blueprint(zones_bp)
    app.register_blueprint(records_bp)
    app.register_blueprint(ip_bp)
    app.register_blueprint(status_bp)
    app.register_blueprint(settings_bp)

    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_spa(path):
        if path and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        return send_from_directory(app.static_folder, 'index.html')

    init_scheduler(app)

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=5480, debug=True)
