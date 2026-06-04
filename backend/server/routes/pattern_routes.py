from flask import Blueprint, jsonify, request
import json
import pandas as pd
import const
from server.utils import validate_session, safe_int_conversion
from server.routes.pattern_helpers import pattern_info_dict

# Create the blueprint
pattern_bp = Blueprint("pattern", __name__)


# ---------- EVENTS ----------

@pattern_bp.route('/events', methods=['GET'])
def get_events():
    session_id = request.args.get('session_id')
    error = validate_session(session_id)
    if error:
        return error

    session = const.SESSION_DATA[session_id]
    list_chosen_events = session.get('list_events')
    all_events = const.LIST_EVENTS

    if not list_chosen_events:  # first run / safety-net
        return jsonify(all_events)

    filtered = {eid: all_events[eid] for eid in list_chosen_events if eid in all_events}
    return jsonify(filtered)


@pattern_bp.route('/events/<int:event_id>', methods=['GET'])
def get_event(event_id):
    session_id = request.args.get('session_id')
    error = validate_session(session_id)
    if error:
        return error

    event = const.LIST_EVENTS.get(event_id)
    if event is None:
        return jsonify({"error": "Event not found"}), 404
    return jsonify(event)


@pattern_bp.route('/events/<int:event_id>/patterns', methods=['GET'])
def get_event_patterns(event_id):
    session_id = request.args.get('session_id')
    error = validate_session(session_id)
    if error:
        return error

    event = const.LIST_EVENTS.get(event_id)
    if event is None:
        return jsonify({"error": "Event not found"}), 404

    path_info = const.MODEL_CONFIG["important_patterns"]
    with open(path_info, encoding="utf-8") as f:
        important_map = json.load(f)
    imp_dict = important_map.get(str(event_id), [])

    patterns = {}
    for pattern_id in event['patterns']:
        if pattern_id in const.LIST_PATTERNS and str(pattern_id) in imp_dict:
            patterns[pattern_id] = const.LIST_PATTERNS[pattern_id]

    return jsonify(patterns)


# ---------- PATTERNS ----------

@pattern_bp.route('/patterns', methods=['GET'])
def get_patterns():
    session_id = request.args.get('session_id')
    error = validate_session(session_id)
    if error:
        return error

    event_id = safe_int_conversion(request.args.get('event_id'), 'event_id')

    path_info = const.MODEL_CONFIG["important_patterns"]
    with open(path_info, encoding="utf-8") as f:
        important_map = json.load(f)

    if event_id is not None:
        event = const.LIST_EVENTS.get(event_id)
        imp_dict = important_map.get(str(event_id), [])
        if event is None:
            return jsonify({"error": "Event not found"}), 404

        patterns = {
            pattern_id: const.LIST_PATTERNS[pattern_id]
            for pattern_id in event['patterns']
            if pattern_id in const.LIST_PATTERNS and str(pattern_id) in imp_dict
        }
        return jsonify(patterns)

    return jsonify(const.LIST_PATTERNS)


@pattern_bp.route('/patterns/importance', methods=['GET'])
def get_patterns_importance():
    session_id = request.args.get('session_id')
    error = validate_session(session_id)
    if error:
        return error

    event_id = safe_int_conversion(request.args.get('event_id'), 'event_id')
    if event_id is None:
        return jsonify({"error": "event_id required"}), 400

    path_info = const.MODEL_CONFIG["important_patterns"]
    with open(path_info, encoding="utf-8") as f:
        importance_map = json.load(f)

    return jsonify(importance_map.get(str(event_id), {}))


@pattern_bp.route('/pattern_info/<int:pattern_id>', methods=['GET'])
def get_pattern_info(pattern_id):
    session_id = request.args.get('session_id')
    event_id = request.args.get('event_id', type=int)

    if event_id is None:
        return jsonify({'error': 'Missing event_id parameter'}), 400

    result = pattern_info_dict(session_id, pattern_id, event_id)
    if result is None:
        return jsonify({'error': 'Pattern not found'}), 404

    return jsonify(result)


@pattern_bp.route('/all_patterns_info', methods=['GET'])
def get_all_patterns_info():
    session_id = request.args.get('session_id')
    if session_id not in const.SESSION_DATA:
        return jsonify({'error': 'invalid session'}), 400

    session = const.SESSION_DATA[session_id]
    list_chosen_events = session.get('list_events', [])

    path_info = const.MODEL_CONFIG["important_patterns"]
    with open(path_info, encoding="utf-8") as f:
        important_map = json.load(f)

    results = []
    for event_id in list_chosen_events:
        imp_dict = important_map.get(str(event_id), [])
        for pattern_id in const.LIST_EVENTS[event_id]['patterns']:
            if str(pattern_id) in imp_dict:
                info = pattern_info_dict(session_id, pattern_id, event_id)
                results.append(info)

    return jsonify(results)


@pattern_bp.route('/get_normal_bounds_for_TemporalPropertyID', methods=['GET'])
def get_normal_bounds_for_TemporalPropertyID():
    try:
        var_exp_df = pd.read_csv(const.MODEL_CONFIG["Variable_Explanations"])
        normal_bounds_dict = {
            int(row['TemporalPropertyID']): [
                float(row['LowNormalBound']) if pd.notna(row['LowNormalBound']) else None,
                float(row['HighNormalBound']) if pd.notna(row['HighNormalBound']) else None
            ]
            for _, row in var_exp_df.iterrows()
        }
        return jsonify(normal_bounds_dict), 200
    except Exception:
        return jsonify({'error': 'Unable to retrieve normal bounds'}), 500
