from flask import jsonify

# ---------- Session Validation ----------

def validate_session(session_id):
    """
    Validate if session_id exists in SESSION_DATA.
    Returns an error response (jsonify, 400) if invalid, else None.
    """
    import const

    if not session_id:
        return jsonify({'error': 'Missing session_id parameter'}), 400
    if session_id not in const.SESSION_DATA:
        return jsonify({'error': 'Invalid session_id'}), 400
    return None


# ---------- Safe Conversion ----------

def safe_int_conversion(value, param_name):
    """
    Safely convert parameter to integer with error handling.
    Returns None if conversion fails.
    """
    if value is None:
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None
