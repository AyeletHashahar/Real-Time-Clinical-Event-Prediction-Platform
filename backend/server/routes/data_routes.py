from flask import Blueprint, jsonify, request
import json
import os
import pandas as pd
import numpy as np
import const
from input.read_write_files import save_data_buffer_to_file
from server.utils import validate_session
import logging
logger = logging.getLogger(__name__)

# Create the blueprint
data_bp = Blueprint("data", __name__)


# ---------- Continuous data ----------

def continuous_real_data(session_id):
    """Process and return the next data point for continuous data."""
    logger.debug("Received request at /continuous_data endpoint.")
    session = const.SESSION_DATA[session_id]

    # Check if data processing is already complete
    if session.get('data_processing_complete', False):
        return None

    if not session.get('processing_started', False):
        data_player = session['data_player']
        data_player.load_series_data()
        logger.debug("Initializing data processing for the first time.")
        session['processing_started'] = True

    logger.debug("Processing the next data point.")
    data_player = session.get('data_player')
    if not data_player:
        raise ValueError('Session data_player not initialized')

    predict_entity = session.get('predict_entity')
    next_data = data_player.process_next_point(predict_entity, session['CURRENT_IDX'])

    if next_data is None:
        session['data_processing_complete'] = True
        logger.info(f"Data processing completed for session {session_id}")
        return None

    session['CURRENT_IDX'] += 1
    session['data_buffer'].append(next_data)

    list_chosen_events = session.get('list_events')
    chosen_data = {}
    for event_id in list_chosen_events:
        if str(event_id) in next_data:
            chosen_data[event_id] = next_data[str(event_id)]

    logger.debug(f"Next data point: {chosen_data}")
    return chosen_data


@data_bp.route('/continuous_data', methods=['GET'])
def start_data_processing_route():
    """Retrieve the next processed data point."""
    session_id = request.args.get('session_id')
    error = validate_session(session_id)
    if error:
        return error

    session = const.SESSION_DATA[session_id]
    entity_id = session.get('entity_id')

    try:
        if session.get('data_player') is None:
            return jsonify({'error': 'Session not initialized – call /select_model_and_entity'}), 400

        next_data = continuous_real_data(session_id)
        if next_data is None:
            return jsonify({'message': 'No more data to process'}), 204

        # Save periodically
        if session['CURRENT_IDX'] % 10 == 0:
            save_data_buffer_to_file(session['data_buffer'], entity_id)
            session['data_buffer'] = []

        return jsonify(next_data), 200

    except Exception as e:
        logger.error("Error during data processing", exc_info=True)
        return jsonify({'error': str(e)}), 500


# ---------- Demographic data ----------

@data_bp.route('/demographic_data', methods=['GET'])
def get_demographic_data():
    try:
        session_id = request.args.get('session_id')
        error = validate_session(session_id)
        if error:
            return error

        session = const.SESSION_DATA[session_id]
        entity_id = session['entity_id']

        df = pd.read_csv(const.MODEL_CONFIG['demographic_path'])
        entity_demographic_data = df[df[const.DatasetColumns.EntityID] == float(entity_id)]

        if entity_demographic_data.empty:
            return jsonify({'error': 'EntityID not found'}), 404

        safe_df = (
            entity_demographic_data
            .replace([np.inf, -np.inf], None)
            .where(entity_demographic_data.notna(), None)
            .astype(object)
        )

        demographic_json = safe_df.to_dict(orient='records')
        return jsonify({'demographic_data': demographic_json}), 200

    except Exception as e:
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500


# ---------- Historical data ----------

@data_bp.route('/detected_patterns_and_prob', methods=['GET'])
def get_detected_patterns_and_prob():
    try:
        session_id = request.args.get('session_id')
        error = validate_session(session_id)
        if error:
            return error

        # Resolve event_id to search
        event_id = request.args.get('event_id', type=str)
        end_time = request.args.get('end_time', default=0, type=int)

        session = const.SESSION_DATA[session_id]
        entity_id = str(session['entity_id'])

        model_config = const.MODEL_CONFIG
        df_path = model_config['historical_path'] + f'{entity_id}.jsonl'
        if not os.path.exists(df_path):
            return jsonify({'error': f'Historical data file not found: {df_path}'}), 404

        # Read jsonl lazily to avoid big loads
        # Each line is expected to be a JSON object; one of the keys should be the event_id (as str),
        # holding a dict that includes "entity_data".
        detected_patters = []
        patterns_prob = 0
        event_prob = 0
        TTE_event = 0
        with open(df_path, 'r', encoding='utf-8') as f:
            import json
            ev_key = str(event_id)
            for line in f:
                try:
                    row = json.loads(line)
                except Exception:
                    continue
                # Optional start_time filtering
                ts = row[ev_key]["timestamp"]
                try:
                    ts = int(ts)
                except Exception:
                    ts = 0
                if ts == end_time:
                    patterns_prob = row[ev_key]["patterns_prob"]
                    event_prob = row[ev_key]["prediction"]
                    TTE_event = row[ev_key]["TTE"]
                    detected_patters = row[ev_key]["detection_tirps"]

        return jsonify({'detected_patters': detected_patters, 'patterns_prob':patterns_prob, 'event_prob':event_prob, 'TTE_event':TTE_event}), 200

    except Exception as e:
        return jsonify({'error': f'Unexpected error: {str(e)}'}), 500


@data_bp.route('/entity_data_from_one_event', methods=['GET'])
def entity_data_from_one_event():
    """
    Returns ONLY the `entity_data` dict for a single event from the historical file.
    Query params:
      - session_id: required
      - event_id: optional (defaults to first chosen event or 0)
      - start_time: optional (unix seconds) – start searching from this timestamp
    Response:
      { "event_id": <int>, "entity_data": { <TemporalPropertyID>: {...}, ... } }
    """
    try:
        session_id = request.args.get('session_id')
        error = validate_session(session_id)
        if error:
            return error

        # Resolve event_id to search
        event_id = "0"
        end_time = request.args.get('end_time', default=0, type=int)

        session = const.SESSION_DATA[session_id]
        entity_id = str(session['entity_id'])

        model_config = const.MODEL_CONFIG
        df_path = model_config['historical_path'] + f'{entity_id}.jsonl'
        if not os.path.exists(df_path):
            return jsonify({'error': f'Historical data file not found: {df_path}'}), 404

        # Read jsonl lazily to avoid big loads
        # Each line is expected to be a JSON object; one of the keys should be the event_id (as str),
        # holding a dict that includes "entity_data".
        found_entity_data = []
        with open(df_path, 'r', encoding='utf-8') as f:
            import json
            ev_key = str(event_id)
            for line in f:
                try:
                    row = json.loads(line)
                except Exception:
                    continue

                # Optional start_time filtering
                ts = row[ev_key]["timestamp"]
                try:
                    ts = int(ts)
                except Exception:
                    ts = 0
                if ts < end_time:
                    found_entity_data.append(row[ev_key]["entity_data"])

        if not found_entity_data:
            return jsonify({'error': 'entity_data not found for event'}), 404

        return jsonify({'entity_data': found_entity_data}), 200

    except Exception as e:
        return jsonify({'error': f'Unexpected error: {str(e)}'}), 500

@data_bp.route('/get_current_time', methods=['GET'])
def get_current_time():
    """
    Returns the current time in milliseconds since epoch.
    """
    session_id = request.args.get('session_id')
    session = const.SESSION_DATA.get(session_id)
    current_time = session['CURRENT_IDX']

    return jsonify(current_time), 200


# ---------- Data buffer ----------

@data_bp.route('/get_processed_data', methods=['GET'])
def get_processed_data():
    """Retrieve all processed data stored in the buffer."""
    session_id = request.args.get('session_id')
    error = validate_session(session_id)
    if error:
        return error

    return jsonify(const.SESSION_DATA[session_id]["data_buffer"]), 200


@data_bp.route('/clear_data_buffer', methods=['POST'])
def clear_data_buffer():
    """Clear the data buffer."""
    session_id = request.args.get('session_id')
    error = validate_session(session_id)
    if error:
        return error

    const.SESSION_DATA[session_id]['data_buffer'] = []
    return jsonify({'status': 'Data buffer cleared'}), 200
