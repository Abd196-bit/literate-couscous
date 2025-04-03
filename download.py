from flask import send_file, Blueprint

download_bp = Blueprint('download', __name__)

@download_bp.route('/download')
def download_project():
    """Route to download the project zip file"""
    try:
        return send_file('/home/runner/workspace/literate-couscous-clean.zip',
                        mimetype='application/zip',
                        as_attachment=True,
                        download_name='literate-couscous-clean.zip')
    except Exception as e:
        return str(e)