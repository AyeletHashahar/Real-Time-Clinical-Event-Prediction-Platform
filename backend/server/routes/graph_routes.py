from flask import Blueprint, jsonify, request
import pandas as pd
import numpy as np
import const
from server.utils import validate_session, safe_int_conversion

# Create the blueprint
graph_bp = Blueprint("graph", __name__)


# ---------- States ----------

@graph_bp.route('/states/<int:temporal_property_id>', methods=['GET'])
def get_states_data(temporal_property_id):
    session_id = request.args.get('session_id')
    error = validate_session(session_id)
    if error:
        return error

    event_id = safe_int_conversion(request.args.get('event_id'), 'event_id')
    session = const.SESSION_DATA[session_id]

    cutoffs_df = session['predict_entity'][event_id or 0].get_states_df()
    if cutoffs_df is None:
        return jsonify({'error': 'Data not available'}), 500

    temporal_property_df = cutoffs_df[cutoffs_df[const.StatesColumns.TemporalPropertyID] == temporal_property_id]
    if temporal_property_df.empty:
        return jsonify({'error': 'TemporalPropertyID not found'}), 404

    states = [
        {'StateID': row[const.StatesColumns.StateID], 'BinLabel': row[const.StatesColumns.BinLabel]}
        for _, row in temporal_property_df.iterrows()
    ]
    sorted_states = sorted(states, key=lambda x: x[const.StatesColumns.StateID])
    return jsonify({'states': sorted_states}), 200


@graph_bp.route('/title/<int:temporal_property_id>', methods=['GET'])
def get_title(temporal_property_id):
    session_id = request.args.get('session_id')
    error = validate_session(session_id)
    if error:
        return error

    event_id = safe_int_conversion(request.args.get('event_id'), 'event_id')
    session = const.SESSION_DATA[session_id]

    cutoffs_df = session['predict_entity'][event_id or 0].get_states_df()
    if cutoffs_df is None:
        return jsonify({'error': 'Data not available'}), 500

    temporal_property_df = cutoffs_df[cutoffs_df[const.StatesColumns.TemporalPropertyID] == temporal_property_id]
    if temporal_property_df.empty:
        return jsonify({'error': 'TemporalPropertyID not found'}), 404

    property_name = temporal_property_df[const.StatesColumns.Label].iloc[0]
    return jsonify({'title': property_name}), 200


# ---------- Helpers for mapping ----------

def get_temp_property_to_state_id_dic(session_id, event_id):
    cutoffs_df = const.SESSION_DATA[session_id]['predict_entity'][event_id or 0].get_states_df()
    temp_property_to_state_id_dic = {}
    for _, row in cutoffs_df.iterrows():
        temp_prop_id = row[const.StatesColumns.TemporalPropertyID]
        state_id = int(row[const.StatesColumns.StateID])
        if temp_prop_id not in temp_property_to_state_id_dic:
            temp_property_to_state_id_dic[temp_prop_id] = []
        temp_property_to_state_id_dic[temp_prop_id].append(state_id)
    return temp_property_to_state_id_dic


def get_state_id_to_temp_property_dic(session_id, event_id):
    cutoffs_df = const.SESSION_DATA[session_id]['predict_entity'][event_id or 0].get_states_df()
    state_id_to_temp_property_dic = {}
    for _, row in cutoffs_df.iterrows():
        temp_prop_id = int(row[const.StatesColumns.TemporalPropertyID])
        state_id = row[const.StatesColumns.StateID]
        state_id_to_temp_property_dic[state_id] = temp_prop_id
    return state_id_to_temp_property_dic


@graph_bp.route('/stateid_to_tempprop/<int:state_id>', methods=['GET'])
def get_temp_prop(state_id):
    session_id = request.args.get('session_id')
    error = validate_session(session_id)
    if error:
        return error

    event_id = safe_int_conversion(request.args.get('event_id'), 'event_id')
    state_to_prop_dic = get_state_id_to_temp_property_dic(session_id, event_id)
    if state_id not in state_to_prop_dic:
        return jsonify({'error': 'State ID not found'}), 404

    return jsonify({'temporal_property_id': state_to_prop_dic[state_id]}), 200


# ---------- Temporal properties ----------

@graph_bp.route("/temporal-properties_ids", methods=["GET"])
def get_temporal_properties_ids():
    session_id = request.args.get("session_id")
    error = validate_session(session_id)
    if error:
        return error

    event_id = safe_int_conversion(request.args.get("event_id"), "event_id")
    cutoffs_df = const.SESSION_DATA[session_id]["predict_entity"][event_id or 0].get_states_df()

    try:
        ids = sorted(map(int, cutoffs_df[const.StatesColumns.TemporalPropertyID].unique()))
        return jsonify({"ids": ids, "success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e), "success": False}), 500


@graph_bp.route('/tempprop_to_stateid/<int:temp_prop>', methods=['GET'])
def get_state_id(temp_prop):
    session_id = request.args.get('session_id')
    error = validate_session(session_id)
    if error:
        return error

    event_id = safe_int_conversion(request.args.get('event_id'), 'event_id')
    temp_prop_to_state_id_dic = get_temp_property_to_state_id_dic(session_id, event_id)

    if temp_prop not in temp_prop_to_state_id_dic:
        return jsonify({'error': 'TemporalPropertyID not found'}), 404

    return jsonify({'state_ids': temp_prop_to_state_id_dic[temp_prop]}), 200


@graph_bp.route('/temporal-properties-count', methods=['GET'])
def get_temporal_properties_count():
    session_id = request.args.get('session_id')
    error = validate_session(session_id)
    if error:
        return error

    event_id = safe_int_conversion(request.args.get('event_id'), 'event_id')
    cutoffs_df = const.SESSION_DATA[session_id]['predict_entity'][event_id or 0].get_states_df()

    try:
        unique_count = len(cutoffs_df[const.StatesColumns.TemporalPropertyID].unique())
        return jsonify({'count': int(unique_count), 'success': True})
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500


def compute_cutoff_boundaries(cutoffs_df, temporal_property_id):
    try:
        bounds_df = (
            pd.read_csv(const.MODEL_CONFIG["Variable_Explanations"])
            .set_index("TemporalPropertyID")
            .astype({"LowestBound": float, "HighestBound": float})
        )
        row = bounds_df.loc[temporal_property_id]
        lower_bound = int(row["LowestBound"])
        upper_bound = int(row["HighestBound"])
    except KeyError as e:
        raise KeyError(f"Missing bound for property {temporal_property_id}: {e}")

    filtered = cutoffs_df[
        cutoffs_df[const.StatesColumns.TemporalPropertyID] == temporal_property_id
    ]
    bins = (
        filtered.sort_values("BinID")[["BinLow", "BinHigh"]]
        .reset_index(drop=True)
    )
    if len(bins) < 2:
        raise ValueError("Not enough bins to compute boundaries")

    boundaries = [lower_bound]
    for high in bins["BinHigh"]:
        if np.isfinite(high):
            boundaries.append(float(high))
    boundaries.append(upper_bound)
    return boundaries


@graph_bp.route('/temporal-properties_cutoffs', methods=['GET'])
def get_temporal_properties_cutoffs():
    session_id = request.args.get('session_id')
    error = validate_session(session_id)
    if error:
        return error

    event_id = safe_int_conversion(request.args.get('event_id'), 'event_id')
    temporal_property_id = safe_int_conversion(request.args.get('temporal_property_id'), 'temporal_property_id')

    cutoffs_df = const.SESSION_DATA[session_id]['predict_entity'][event_id or 0].get_states_df()

    try:
        cutoffs_list = compute_cutoff_boundaries(cutoffs_df, temporal_property_id)
        return jsonify({'cutoffs': cutoffs_list, 'success': True})
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500


@graph_bp.route('/types_temporal-properties', methods=['GET'])
def get_types_temporal_properties():
    session_id = request.args.get('session_id')
    error = validate_session(session_id)
    if error:
        return error

    event_id = safe_int_conversion(request.args.get('event_id'), 'event_id')
    cutoffs_df = const.SESSION_DATA[session_id]['predict_entity'][event_id or 0].get_states_df()

    try:
        type_dict = {}
        for _, row in cutoffs_df.iterrows():
            temp_prop_id = row[const.StatesColumns.TemporalPropertyID]
            t = row[const.StatesColumns.Type]
            type_dict.setdefault(t, []).append(temp_prop_id)
        return jsonify({'Type': type_dict, 'success': True})
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500


@graph_bp.route('/label_temporal-properties', methods=['GET'])
def get_labels_temporal_properties():
    session_id = request.args.get('session_id')
    error = validate_session(session_id)
    if error:
        return error

    event_id = safe_int_conversion(request.args.get('event_id'), 'event_id')
    cutoffs_df = const.SESSION_DATA[session_id]['predict_entity'][event_id or 0].get_states_df()

    try:
        label_dict = {}
        for _, row in cutoffs_df.iterrows():
            temp_prop_id = row[const.StatesColumns.TemporalPropertyID]
            label = row[const.StatesColumns.Label]
            if temp_prop_id not in label_dict:
                label_dict[temp_prop_id] = label
        return jsonify({'labels': label_dict, 'success': True})
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500
