# import json
#
# import pandas as pd
# from flask import jsonify, request
#
# from core_comp.model import Model
# from input.read_write_files import save_data_buffer_to_file
# from prediction.predict_entity import PredictEntity
# from server.app import app
# from server.entity_data_player import EntityDataPlayer
# import const
# import os
# from uuid import uuid4
# import re
# import ast
# import numpy as np
# from typing import Any
#
# from temporal_abstraction.main_abstraction import TemporalAbstraction
#
#
#
# # ---------- Helper Functions ----------
# def validate_session(session_id):
#     """Validate if session_id exists in SESSION_DATA"""
#     if not session_id:
#         return jsonify({'error': 'Missing session_id parameter'}), 400
#     if session_id not in const.SESSION_DATA:
#         return jsonify({'error': 'Invalid session_id'}), 400
#     return None
#
#
# def safe_int_conversion(value, param_name):
#     """Safely convert parameter to integer with error handling"""
#     if value is None:
#         return None
#     try:
#         return int(value)
#     except (ValueError, TypeError):
#         return None
#
#
# # ---------- send data ----------
# def continuous_real_data(session_id):
#     # Log the start of the request
#     app.logger.debug("Received request at /continuous_data endpoint.")
#     session = const.SESSION_DATA[session_id]
#
#     # Check if data processing is already complete
#     if session.get('data_processing_complete', False):
#         return None  # Signal that processing is done
#
#     if not session.get('processing_started', False):
#         # First time initialization
#         data_player = session['data_player']
#         data_player.load_series_data()
#         app.logger.debug("Initializing data processing for the first time.")
#         session['processing_started'] = True
#
#     # For subsequent requests, process and return the next data point
#     app.logger.debug("Processing the next data point.")
#     data_player = session.get('data_player')
#     if not data_player:
#         raise ValueError('Session data_player not initialized')
#
#     predict_entity = session.get('predict_entity')
#     next_data = data_player.process_next_point(predict_entity, session['CURRENT_IDX'])
#
#     # Check if we've reached the end of data
#     if next_data is None:
#         session['data_processing_complete'] = True
#         app.logger.info(f"Data processing completed for session {session_id}")
#         return None
#
#     session['CURRENT_IDX'] += 1
#     session['data_buffer'].append(next_data)
#
#     list_chosen_events = session.get('list_events')
#     chosen_data = {}
#     for event_id in list_chosen_events:
#         if str(event_id) in next_data:
#             chosen_data[event_id] = next_data[str(event_id)]
#     # Log the data returned by process_next_point
#     app.logger.debug(f"Next data point: {chosen_data}")
#     return chosen_data
#
#
# @app.route('/continuous_data', methods=['GET'])
# def start_data_processing_route():
#     """HTTP endpoint for retrieving the next processed data point."""
#     session_id = request.args.get('session_id')
#
#     # Validate session
#     error = validate_session(session_id)
#     if error:
#         return error
#
#     session = const.SESSION_DATA[session_id]
#     entity_id = session.get('entity_id')
#
#     try:
#         if session.get('data_player') is None:
#             return jsonify({'error': 'Session not initialized – call /select_model_and_entity'}), 400
#         next_data = continuous_real_data(session_id)
#
#         # Check if processing is complete (next_data is None)
#         if next_data is None:
#             return jsonify({'message': 'No more data to process'}), 204  # 204 No Content
#
#         # save in the historical data
#         if session['CURRENT_IDX'] % 10 == 0:
#             save_data_buffer_to_file(session['data_buffer'], entity_id)
#             session['data_buffer'] = []
#
#         # Return the data with 200 status
#         print(session['CURRENT_IDX'])
#         print(next_data)
#         return jsonify(next_data), 200
#
#     except Exception as e:
#         app.logger.error("Error during data processing", exc_info=True)
#         return jsonify({'error': str(e)}), 500
#
#
# # ---------- end send data ----------
#
#
# # ---------- manage session ----------
# # TODO: in the Future, all the paramters (like paa_action, windows_size_paa, etc.) should be in the model_config.json file
# def load_parameters_model(event_id):
#     state_data_path = (const.MODEL_CONFIG["states_path"] + "\\" + const.LIST_EVENTS[event_id]["name"] +
#                        "_event/states.csv")
#     temporal_abstraction = TemporalAbstraction(
#         discretization_method=const.MethodsNames.KnowledgeBased,
#         path_states_table=state_data_path,
#         delta_T=const.DELTA_T[event_id],
#         list_interpolation_gap=const.INTERPOLATION_GAP[event_id],
#         retroactive_state_closure=const.RETROACTIVE_STATE_CLOSURE
#     )
#     extract_path_model = (const.MODEL_CONFIG['models_path'] + "\\" + const.LIST_EVENTS[event_id]["name"]
#                           + "_event")
#     model = Model(
#         event_id=event_id,
#         extract_path_model=extract_path_model,
#         paa_action=const.PAA_ACTION[event_id],
#         windows_size_paa=const.WINDOW_SIZE_PAA[event_id],
#         abstraction_parameters=temporal_abstraction,
#         max_gap=const.MAX_GAP[event_id],
#         window_size_detection=const.WINDOW_SIZE_DETECTION,
#         strict_window_detection=const.STRICT_WINDOW_DETECTION,
#         threshold=const.THRESHOLD[event_id],
#         time_delay=const.DELTA_T[event_id],
#         relation_mapping=const.NUM_RELATION[event_id],
#         agg_function = const.AGGREGATION_FUNCTION[event_id],
#         weights_file= const.MODEL_CONFIG['weights_file']
#     )
#     return model
#
# @app.route('/create_session', methods=['POST'])
# def create_session():
#     session_id = str(uuid4())
#
#     predict_entity = []
#
#     data_player = EntityDataPlayer(const.MODEL_CONFIG["raw_data_path"])
#
#     path_info = const.MODEL_CONFIG["important_patterns"]
#     with open(path_info, encoding="utf-8") as f:
#         important_map = json.load(f)
#
#     for event_id in const.LIST_EVENTS.keys():
#         list_pattern = []
#         dict_pattern = important_map.get(str(event_id), [])
#         for key in dict_pattern:
#             list_pattern.append(int(key))
#         predict_entity.append(PredictEntity(
#             event_idx=int(event_id),
#             set_important_patterns=list_pattern,
#             model_parameters=load_parameters_model(int(event_id))
#         ))
#
#     new_session = {
#         'CURRENT_IDX': 1,
#         'data_buffer': [],
#         'entity_id': None,
#         'processing_started': False,
#         'data_player': None,
#         'predict_entity': None,
#         'list_events': None
#     }
#     new_session.update({
#         'entity_id': None,
#         'data_player': data_player,
#         'predict_entity': predict_entity
#     })
#     const.SESSION_DATA[session_id] = new_session
#
#     return jsonify({'session_id': session_id}), 200
#
#
# @app.route('/reset_session', methods=['POST'])
# def reset_session():
#     session_id = request.args.get('session_id')
#
#     # Validate session
#     error = validate_session(session_id)
#     if error:
#         return error
#
#     session = const.SESSION_DATA[session_id]
#     previous_entity = session.get('entity_id')
#     previous_list_events = session.get('list_events')
#
#     new_data_player = None
#     new_predictors = []
#     new_data_player = EntityDataPlayer(const.MODEL_CONFIG["raw_data_path"],
#                                        previous_entity)
#
#     path_info = const.MODEL_CONFIG["important_patterns"]
#     with open(path_info, encoding="utf-8") as f:
#         important_map = json.load(f)
#
#     for event_id in const.LIST_EVENTS.keys():
#         list_pattern = []
#         dict_pattern = important_map.get(str(event_id), [])
#         for key in dict_pattern:
#             list_pattern.append(int(key))
#         new_predictors.append(PredictEntity(
#             event_idx=int(event_id),
#             set_important_patterns=dict_pattern,
#             model_parameters=load_parameters_model(int(event_id))
#         ))
#
#     new_session = {
#         'CURRENT_IDX': 1,
#         'data_buffer': [],
#         'entity_id': None,
#         'processing_started': False,
#         'data_player': None,
#         'predict_entity': None,
#         'list_events': None
#     }
#     new_session.update({
#         'entity_id': previous_entity,
#         'data_player': new_data_player,
#         'predict_entity': new_predictors,
#         'list_events': previous_list_events
#     })
#     const.SESSION_DATA[session_id] = new_session
#
#     if new_data_player is not None:
#         new_data_player.load_series_data()
#
#     return jsonify({'status': 'Session reset'}), 200
#
# # ---------------------------------------------------------------------------
# # POST /reset_session
# # ---------------------------------------------------------------------------
# # @app.route("/reset_session", methods=["POST"])
# # def reset_session():
# #     old_sid = request.args.get("session_id")
# #     print("[reset_session] got request, sid =", old_sid)
# #
# #     if not old_sid or old_sid not in const.SESSION_DATA:
# #         return jsonify({"error": "invalid session"}), 400
# #
# #     old_session       = const.SESSION_DATA[old_sid]
# #     prev_entity       = old_session["entity_id"]
# #     prev_list_events  = old_session["list_events"]
# #
# #     new_sid = str(uuid4())
# #
# #     new_player = EntityDataPlayer(const.MODEL_CONFIG["raw_data_path"],
# #                                   prev_entity)
# #     new_predictors = [
# #         PredictEntity(
# #             event_idx=int(eid),
# #             model_parameters=load_parameters_model(int(eid))
# #         )
# #         for eid in const.LIST_EVENTS.keys()
# #     ]
# #
# #     const.SESSION_DATA[new_sid] = {
# #         "CURRENT_IDX":        1,
# #         "data_buffer":        [],
# #         "entity_id":          prev_entity,
# #         "processing_started": False,
# #         "data_player":        new_player,
# #         "predict_entity":     new_predictors,
# #         "list_events":        prev_list_events,
# #     }
# #
# #     new_player.load_series_data()
# #
# #     del const.SESSION_DATA[old_sid]
# #     print(f"[reset_session] {old_sid} removed; new sid={new_sid}")
# #
# #     return jsonify({"status": "reset", "session_id": new_sid}), 200
#
#
# # ---------- end manage session ----------
#
#
# # ---------- handle entities ----------
#
# @app.route('/available_models_and_entities', methods=['POST'])
# def fetch_available_models_and_entities():
#     return jsonify({'model_and_entities': const.LIST_MODELS_ENTITIES}), 200
#
#
#
# @app.route('/select_entity_and_events', methods=['POST'])
# def select_entity_and_events():
#     data = request.json
#     session_id = data['session_id']
#
#     # Validate session
#     error = validate_session(session_id)
#     if error:
#         return error
#
#     entity_id = int(data['entity_id'])
#     selected_events = data['list_events']
#
#     const.SESSION_DATA[session_id]['entity_id'] = entity_id
#     data_player = const.SESSION_DATA[session_id]['data_player']
#     data_player.set_entity_id(entity_id)
#     data_player.load_series_data()
#     const.SESSION_DATA[session_id]['list_events'] = selected_events
#
#     const.SESSION_DATA[session_id]['CURRENT_IDX'] = 1
#
#     app.logger.debug("Updated session entity_id=%s", entity_id)
#     return jsonify(success=True)
#
#
# @app.route('/current_selection', methods=['GET'])
# def current_selection():
#     session_id = request.args.get('session_id')
#
#     # Validate session
#     error = validate_session(session_id)
#     if error:
#         return error
#
#     session = const.SESSION_DATA[session_id]
#     entity_id = session['entity_id']
#     list_events = session['list_events']
#
#     return jsonify({'entity_id': entity_id, 'list_events':list_events}), 200
#
#
# # ---------- end handle entities ----------
#
#
# # ---------- handle demographic & historical data ----------
#
# @app.route('/demographic_data', methods=['GET'])
# def get_demographic_data():
#     try:
#         session_id = request.args.get('session_id')
#
#         # Validate session
#         error = validate_session(session_id)
#         if error:
#             return error
#
#         session = const.SESSION_DATA[session_id]
#         entity_id = session['entity_id']
#
#         df = pd.read_csv(const.MODEL_CONFIG['demographic_path'])
#         entity_demographic_data = df[df[const.DatasetColumns.EntityID] == float(entity_id)]
#
#         if entity_demographic_data.empty:
#             # 404 is more appropriate than 500 when not found
#             return jsonify({'error': 'EntityID not found'}), 404
#
#         # >>> sanitize <<<  (NaN/inf -> None so JSON becomes valid)
#         safe_df = (
#             entity_demographic_data
#             .replace([np.inf, -np.inf], None)
#             .where(entity_demographic_data.notna(), None)
#             .astype(object)
#         )
#
#         demographic_json = safe_df.to_dict(orient='records')
#         return jsonify({'demographic_data': demographic_json}), 200
#
#     except Exception as e:
#         return jsonify({'error': f'An error occurred: {str(e)}'}), 500
#
#
# # ------------- handle historical data -------------
# # TODO: chack this function
# @app.route('/detected_patterns_and_prob', methods=['GET'])
# def get_detected_patterns_and_prob():
#     try:
#         session_id = request.args.get('session_id')
#         error = validate_session(session_id)
#         if error:
#             return error
#
#         # Resolve event_id to search
#         event_id = request.args.get('event_id', type=str)
#         end_time = request.args.get('end_time', default=0, type=int)
#
#         session = const.SESSION_DATA[session_id]
#         entity_id = str(session['entity_id'])
#
#         model_config = const.MODEL_CONFIG
#         df_path = model_config['historical_path'] + f'{entity_id}.jsonl'
#         if not os.path.exists(df_path):
#             return jsonify({'error': f'Historical data file not found: {df_path}'}), 404
#
#         # Read jsonl lazily to avoid big loads
#         # Each line is expected to be a JSON object; one of the keys should be the event_id (as str),
#         # holding a dict that includes "entity_data".
#         detected_patters = []
#         patterns_prob = 0
#         event_prob = 0
#         TTE_event = 0
#         with open(df_path, 'r', encoding='utf-8') as f:
#             import json
#             ev_key = str(event_id)
#             for line in f:
#                 try:
#                     row = json.loads(line)
#                 except Exception:
#                     continue
#                 # Optional start_time filtering
#                 ts = row[ev_key]["timestamp"]
#                 try:
#                     ts = int(ts)
#                 except Exception:
#                     ts = 0
#                 if ts == end_time:
#                     patterns_prob = row[ev_key]["patterns_prob"]
#                     event_prob = row[ev_key]["prediction"]
#                     TTE_event = row[ev_key]["TTE"]
#                     detected_patters = row[ev_key]["detection_tirps"]
#
#         return jsonify({'detected_patters': detected_patters, 'patterns_prob':patterns_prob, 'event_prob':event_prob, 'TTE_event':TTE_event}), 200
#
#     except Exception as e:
#         return jsonify({'error': f'Unexpected error: {str(e)}'}), 500
#
#
# # ---------- raw entity_data (one event) ----------
# @app.route('/entity_data_from_one_event', methods=['GET'])
# def entity_data_from_one_event():
#     """
#     Returns ONLY the `entity_data` dict for a single event from the historical file.
#     Query params:
#       - session_id: required
#       - event_id: optional (defaults to first chosen event or 0)
#       - start_time: optional (unix seconds) – start searching from this timestamp
#     Response:
#       { "event_id": <int>, "entity_data": { <TemporalPropertyID>: {...}, ... } }
#     """
#     try:
#         session_id = request.args.get('session_id')
#         error = validate_session(session_id)
#         if error:
#             return error
#
#         # Resolve event_id to search
#         event_id = "0"
#         end_time = request.args.get('end_time', default=0, type=int)
#
#         session = const.SESSION_DATA[session_id]
#         entity_id = str(session['entity_id'])
#
#         model_config = const.MODEL_CONFIG
#         df_path = model_config['historical_path'] + f'{entity_id}.jsonl'
#         if not os.path.exists(df_path):
#             return jsonify({'error': f'Historical data file not found: {df_path}'}), 404
#
#         # Read jsonl lazily to avoid big loads
#         # Each line is expected to be a JSON object; one of the keys should be the event_id (as str),
#         # holding a dict that includes "entity_data".
#         found_entity_data = []
#         with open(df_path, 'r', encoding='utf-8') as f:
#             import json
#             ev_key = str(event_id)
#             for line in f:
#                 try:
#                     row = json.loads(line)
#                 except Exception:
#                     continue
#
#                 # Optional start_time filtering
#                 ts = row[ev_key]["timestamp"]
#                 try:
#                     ts = int(ts)
#                 except Exception:
#                     ts = 0
#                 if ts < end_time:
#                     found_entity_data.append(row[ev_key]["entity_data"])
#
#         if not found_entity_data:
#             return jsonify({'error': 'entity_data not found for event'}), 404
#
#         return jsonify({'entity_data': found_entity_data}), 200
#
#     except Exception as e:
#         return jsonify({'error': f'Unexpected error: {str(e)}'}), 500
#
#
#
# # ---------- end handle demographic & historical data ----------
#
#
# # ------ handle graphs data ------
#
# @app.route('/states/<int:temporal_property_id>', methods=['GET'])
# def get_states_data(temporal_property_id):
#     session_id = request.args.get('session_id')
#
#     # Validate session
#     error = validate_session(session_id)
#     if error:
#         return error
#
#     # Convert event_id to integer
#     event_id = safe_int_conversion(request.args.get('event_id'), 'event_id')
#
#     session = const.SESSION_DATA[session_id]
#     entity_id = session['entity_id']
#
#     if event_id is not None:
#         cutoffs_df = session['predict_entity'][event_id].get_states_df()
#     else:
#         cutoffs_df = session['predict_entity'][0].get_states_df()
#
#     if cutoffs_df is not None:
#         # Filter the DataFrame by the given temporal_property_id (property_id in this case)
#         temporal_property_df = cutoffs_df[cutoffs_df[const.StatesColumns.TemporalPropertyID] == temporal_property_id]
#
#         if not temporal_property_df.empty:
#             # Create a list of dictionaries with StateID and BinLabel
#             states = [
#                 {'StateID': row[const.StatesColumns.StateID], 'BinLabel': row[const.StatesColumns.BinLabel]}
#                 for _, row in temporal_property_df.iterrows()
#             ]
#
#             # Sort the states by StateID and return the result
#             sorted_states = sorted(states, key=lambda x: x[const.StatesColumns.StateID])
#             return jsonify({'states': sorted_states}), 200
#         else:
#             return jsonify({'error': 'TemporalPropertyID not found'}), 404
#     else:
#         return jsonify({'error': 'Data not available'}), 500
#
#
# @app.route('/title/<int:temporal_property_id>', methods=['GET'])
# def get_title(temporal_property_id):
#     session_id = request.args.get('session_id')
#
#     # Validate session
#     error = validate_session(session_id)
#     if error:
#         return error
#
#     # Convert event_id to integer
#     event_id = safe_int_conversion(request.args.get('event_id'), 'event_id')
#
#     session = const.SESSION_DATA[session_id]
#
#     if event_id is not None:
#         cutoffs_df = session['predict_entity'][event_id].get_states_df()
#     else:
#         cutoffs_df = session['predict_entity'][0].get_states_df()
#
#
#     if cutoffs_df is not None:
#         # Check if the temporal_property_id exists in the DataFrame
#         temporal_property_df = cutoffs_df[cutoffs_df[const.StatesColumns.TemporalPropertyID] == temporal_property_id]
#
#         if not temporal_property_df.empty:
#             # Get the property name (title)
#             property_name = temporal_property_df[const.StatesColumns.Label].iloc[0]
#             return jsonify({'title': property_name}), 200
#         else:
#             return jsonify({'error': 'TemporalPropertyID not found'}), 404
#     else:
#         return jsonify({'error': 'Data not available'}), 500
#
#
# def get_temp_property_to_state_id_dic(session_id, event_id):
#     session = const.SESSION_DATA[session_id]
#     entity_id = session['entity_id']
#
#     if event_id is not None:
#         cutoffs_df = session['predict_entity'][event_id].get_states_df()
#     else:
#         cutoffs_df = session['predict_entity'][0].get_states_df()
#
#     temp_property_to_state_id_dic = {}
#     for _, row in cutoffs_df.iterrows():
#         temp_prop_id = row[const.StatesColumns.TemporalPropertyID]
#         state_id = int(row[const.StatesColumns.StateID])
#         if temp_prop_id not in temp_property_to_state_id_dic.keys():
#             temp_property_to_state_id_dic[temp_prop_id] = []
#             temp_property_to_state_id_dic[temp_prop_id].append(state_id)
#     return temp_property_to_state_id_dic
#
#
# def get_state_id_to_temp_property_dic(session_id, event_id):
#     session = const.SESSION_DATA[session_id]
#     entity_id = session['entity_id']
#
#     if event_id is not None:
#         cutoffs_df = session['predict_entity'][event_id].get_states_df()
#     else:
#         cutoffs_df = session['predict_entity'][0].get_states_df()
#
#     state_id_to_temp_property_dic = {}
#     for _, row in cutoffs_df.iterrows():
#         temp_prop_id = int(row[const.StatesColumns.TemporalPropertyID])
#         state_id = row[const.StatesColumns.StateID]
#         state_id_to_temp_property_dic[state_id] = temp_prop_id
#     return state_id_to_temp_property_dic
#
#
# @app.route('/stateid_to_tempprop/<int:state_id>', methods=['GET'])
# def get_temp_prop(state_id):
#     session_id = request.args.get('session_id')
#
#     # Validate session
#     error = validate_session(session_id)
#     if error:
#         return error
#
#     # Convert event_id to integer
#     event_id = safe_int_conversion(request.args.get('event_id'), 'event_id')
#
#     state_to_prop_dic = get_state_id_to_temp_property_dic(session_id, event_id)
#     if state_id in state_to_prop_dic.keys():
#         return jsonify({'temporal_property_id': state_to_prop_dic[state_id]}), 200
#     else:
#         return jsonify({'error': 'State ID not found'}), 404
#
# @app.route("/temporal-properties_ids", methods=["GET"])
# def get_temporal_properties_ids():
#     """
#     Return the list of unique temporal-property IDs for the requested event.
#     JSON: { "ids": [3, 7, 17, 42], "success": true }
#     """
#     session_id = request.args.get("session_id")
#     err = validate_session(session_id)
#     if err:
#         return err
#
#     event_id = safe_int_conversion(request.args.get("event_id"), "event_id")
#
#     session    = const.SESSION_DATA[session_id]
#     cutoffs_df = session["predict_entity"][event_id or 0].get_states_df()
#
#     try:
#         ids = sorted(map(int, cutoffs_df[const.StatesColumns.TemporalPropertyID].unique()))
#         return jsonify({"ids": ids, "success": True}), 200
#     except Exception as e:
#         return jsonify({"error": str(e), "success": False}), 500
#
#
# @app.route('/tempprop_to_stateid/<int:temp_prop>', methods=['GET'])
# def get_state_id(temp_prop):
#     session_id = request.args.get('session_id')
#
#     # Validate session
#     error = validate_session(session_id)
#     if error:
#         return error
#
#     # Convert event_id to integer
#     event_id = safe_int_conversion(request.args.get('event_id'), 'event_id')
#
#     temp_prop_to_state_id_dic = get_state_id_to_temp_property_dic(session_id, event_id)
#     if temp_prop in temp_prop_to_state_id_dic.keys():
#         return jsonify({'state_ids': temp_prop_to_state_id_dic[temp_prop]}), 200
#     else:
#         return jsonify({'error': 'TemporalPropertyID not found'}), 404
#
#
# @app.route('/temporal-properties-count', methods=['GET'])
# def get_temporal_properties_count():
#     session_id = request.args.get('session_id')
#
#     # Validate session
#     error = validate_session(session_id)
#     if error:
#         return error
#
#     # Convert event_id to integer
#     event_id = safe_int_conversion(request.args.get('event_id'), 'event_id')
#
#     session = const.SESSION_DATA[session_id]
#     entity_id = session['entity_id']
#
#     if event_id is not None:
#         cutoffs_df = session['predict_entity'][event_id].get_states_df()
#     else:
#         cutoffs_df = session['predict_entity'][0].get_states_df()
#
#     try:
#         unique_count = len(cutoffs_df[const.StatesColumns.TemporalPropertyID].unique())
#         return jsonify({'count': int(unique_count), 'success': True})
#     except Exception as e:
#         return jsonify({'error': str(e), 'success': False}), 500
#
# def compute_cutoff_boundaries(cutoffs_df, temporal_property_id):
#
#     try:
#         bounds_df = (
#             pd.read_csv(const.MODEL_CONFIG["Variable_Explanations"])
#             .set_index("TemporalPropertyID")
#             .astype({"LowNormalBound": float, "HighNormalBound": float})
#         )
#         row = bounds_df.loc[temporal_property_id]
#         lower_bound = int(row["LowNormalBound"])
#         upper_bound = int(row["HighNormalBound"])
#     except KeyError as e:
#         raise KeyError(
#             f"Missing bound for property {temporal_property_id}: {e}"
#         )
#
#     filtered = cutoffs_df[
#         cutoffs_df[const.StatesColumns.TemporalPropertyID] == temporal_property_id
#     ]
#     bins = (
#         filtered.sort_values("BinID")[["BinLow", "BinHigh"]]
#                 .reset_index(drop=True)
#     )
#     if len(bins) < 2:
#         raise ValueError("Not enough bins to compute boundaries")
#
#     boundaries = [lower_bound]                        # lower
#     for high in bins["BinHigh"]:                      # bin highs
#         if np.isfinite(high):
#             boundaries.append(float(high))
#     boundaries.append(upper_bound)                   # upper
#     return boundaries
#
#
# @app.route('/temporal-properties_cutoffs', methods=['GET'])
# def get_temporal_properties_cutoffs():
#     session_id = request.args.get('session_id')
#     error = validate_session(session_id)
#     if error:
#         return error
#
#     event_id = safe_int_conversion(request.args.get('event_id'), 'event_id')
#     temporal_property_id = safe_int_conversion(request.args.get('temporal_property_id'), 'temporal_property_id')
#
#     session = const.SESSION_DATA[session_id]
#     cutoffs_df = session['predict_entity'][event_id or 0].get_states_df()
#
#     try:
#         cutoffs_list = compute_cutoff_boundaries(cutoffs_df, temporal_property_id)
#         return jsonify({'cutoffs': cutoffs_list, 'success': True})
#     except Exception as e:
#         return jsonify({'error': str(e), 'success': False}), 500
#
#
# @app.route('/types_temporal-properties', methods=['GET'])
# def get_types_temporal_properties():
#     session_id = request.args.get('session_id')
#
#     # Validate session
#     error = validate_session(session_id)
#     if error:
#         return error
#
#     # Convert event_id to integer
#     event_id = safe_int_conversion(request.args.get('event_id'), 'event_id')
#
#     session = const.SESSION_DATA[session_id]
#     entity_id = session['entity_id']
#
#     if event_id is not None:
#         cutoffs_df = session['predict_entity'][event_id].get_states_df()
#     else:
#         cutoffs_df = session['predict_entity'][0].get_states_df()
#
#     try:
#         type_dict = {}
#         for _, row in cutoffs_df.iterrows():
#             temp_prop_id = row[const.StatesColumns.TemporalPropertyID]
#             type = row[const.StatesColumns.Type]
#             if type not in type_dict.keys():
#                 type_dict[type] = []
#             if temp_prop_id not in type_dict[type]:
#                 type_dict[type].append(temp_prop_id)
#         return jsonify({'Type': type_dict, 'success': True})
#     except Exception as e:
#         return jsonify({'error': str(e), 'success': False}), 500
#
#
# @app.route('/label_temporal-properties', methods=['GET'])
# def get_labels_temporal_properties():
#     session_id = request.args.get('session_id')
#
#     # Validate session
#     error = validate_session(session_id)
#     if error:
#         return error
#
#     # Convert event_id to integer
#     event_id = safe_int_conversion(request.args.get('event_id'), 'event_id')
#
#     session = const.SESSION_DATA[session_id]
#     entity_id = session['entity_id']
#
#     if event_id is not None:
#         cutoffs_df = session['predict_entity'][event_id].get_states_df()
#     else:
#         cutoffs_df = session['predict_entity'][0].get_states_df()
#
#     try:
#         label_dict = {}
#         for _, row in cutoffs_df.iterrows():
#             temp_prop_id = row[const.StatesColumns.TemporalPropertyID]
#             label = row[const.StatesColumns.Label]
#             if temp_prop_id not in label_dict.keys():
#                 label_dict[temp_prop_id] = label
#         return jsonify({'labels': label_dict, 'success': True})
#     except Exception as e:
#         return jsonify({'error': str(e), 'success': False}), 500
#
#
# # ------ end handle graphs data ------
#
#
# # ---------- handle data buffer ----------
#
# @app.route('/get_processed_data', methods=['GET'])
# def get_processed_data():
#     """Retrieve all processed data stored in the buffer via RESTful API."""
#     session_id = request.args.get('session_id')
#
#     # Validate session
#     error = validate_session(session_id)
#     if error:
#         return error
#
#     return jsonify(const.SESSION_DATA[session_id]["data_buffer"]), 200
#
#
# @app.route('/clear_data_buffer', methods=['POST'])
# def clear_data_buffer():
#     """Clear the data buffer."""
#     session_id = request.args.get('session_id')
#
#     # Validate session
#     error = validate_session(session_id)
#     if error:
#         return error
#
#     const.SESSION_DATA[session_id]['data_buffer'] = []
#     return jsonify({'status': 'Data buffer cleared'}), 200
#
#
# # ---------- end handle data buffer ----------
#
# @app.route('/')
# def index():
#     return "WebSocket server running."
#
#
# # ------ handle events & patterns data -----
#
# # @app.route('/events', methods=['GET'])
# # def get_events():
# #     session_id = request.args.get('session_id')
# #     session = const.SESSION_DATA.get(session_id)
# #
# #     # Validate session
# #     error = validate_session(session_id)
# #     if error:
# #         return error
# #
# #     all_events = const.LIST_EVENTS
# #
# #     return jsonify(all_events)
#
# #TODO: this is with the assumption that the user will select the events in the front-end
#
# @app.route('/events', methods=['GET'])
# def get_events():
#     session_id = request.args.get('session_id')
#
#     # Validate session
#     error = validate_session(session_id)
#     if error:
#         return error
#
#     session = const.SESSION_DATA[session_id]
#     list_chosen_events = session.get('list_events')
#     all_events = const.LIST_EVENTS
#
#     if not list_chosen_events:  # first run / safety-net
#         return jsonify(all_events)
#
#     filtered = {eid: all_events[eid] for eid in list_chosen_events if eid in all_events}
#     return jsonify(filtered)
#
# # Get specific event
# @app.route('/events/<int:event_id>', methods=['GET'])
# def get_event(event_id):
#     session_id = request.args.get('session_id')
#
#     # Validate session
#     error = validate_session(session_id)
#     if error:
#         return error
#
#     session = const.SESSION_DATA[session_id]
#     entity_id = session['entity_id']
#
#     events_df = const.LIST_EVENTS
#
#     event = events_df.get(event_id)
#     if event is None:
#         return jsonify({"error": "Event not found"}), 404
#     return jsonify(event)
#
#
# # Get patterns for specific event
# @app.route('/events/<int:event_id>/patterns', methods=['GET'])
# def get_event_patterns(event_id):
#     session_id = request.args.get('session_id')
#
#     # Validate session
#     error = validate_session(session_id)
#     if error:
#         return error
#
#     session = const.SESSION_DATA[session_id]
#
#     patterns_df = const.LIST_PATTERNS
#     events_df = const.LIST_EVENTS
#
#     event = events_df.get(event_id)
#     if event is None:
#         return jsonify({"error": "Event not found"}), 404
#
#     path_info = const.MODEL_CONFIG["important_patterns"]
#     with open(path_info, encoding="utf-8") as f:
#         important_map = json.load(f)
#     imp_dict = important_map.get(str(event_id), [])
#
#     patterns = {}
#     for pattern_id in event['patterns']:
#         if pattern_id in patterns_df and str(pattern_id) in imp_dict:
#             patterns[pattern_id] = patterns_df[pattern_id]
#
#     return jsonify(patterns)
#
#
# # Modified patterns endpoint to support event filtering
# @app.route('/patterns', methods=['GET'])
# def get_patterns():
#     session_id = request.args.get('session_id')
#
#     # Validate session
#     error = validate_session(session_id)
#     if error:
#         return error
#
#     # Convert event_id to integer if provided
#     event_id = safe_int_conversion(request.args.get('event_id'), 'event_id')
#
#     session = const.SESSION_DATA[session_id]
#     patterns_df = const.LIST_PATTERNS
#     events_df = const.LIST_EVENTS
#
#     path_info = const.MODEL_CONFIG["important_patterns"]
#     with open(path_info, encoding="utf-8") as f:
#         important_map = json.load(f)
#         print(important_map)
#
#     if event_id is not None:
#         event = events_df.get(event_id)
#         imp_dict = important_map.get(str(event_id), [])
#         if event is None:
#             return jsonify({"error": "Event not found"}), 404
#
#         patterns = {
#             pattern_id: patterns_df[pattern_id]
#             for pattern_id in event['patterns']
#             if pattern_id in patterns_df and str(pattern_id) in imp_dict
#         }
#         return jsonify(patterns)
#
#     return jsonify(patterns_df)
#
# @app.route('/patterns/importance', methods=['GET'])
# def get_patterns_importance():
#     session_id = request.args.get('session_id')
#     error = validate_session(session_id)
#     if error:
#         return error
#
#     event_id = safe_int_conversion(request.args.get('event_id'), 'event_id')
#     if event_id is None:
#         return jsonify({"error": "event_id required"}), 400
#
#     path_info = const.MODEL_CONFIG["important_patterns"]
#     with open(path_info, encoding="utf-8") as f:
#         importance_map = json.load(f)          # {event_id: {pattern_id: importance}}
#
#     return jsonify(importance_map.get(str(event_id), {}))
#
# def get_information_on_pattern(pattern_name):
#     path_info = const.MODEL_CONFIG["weights_file"]
#     df = pd.read_csv(path_info)
#     return df.set_index("TIRP_Representation").loc[pattern_name].squeeze()
#
# def translet_to_lable(key, pattern_info, event_label: str = "event"):
#     """
#     Examples
#     --------
#     "(1+, 2-)"        -> "(name2-) - (name1+)"
#     "(3-, 4+)"        -> "(name4+) - (name3-)"
#     "(5+, 5-)"        -> "(name5-) - (name5+)"
#     Any non-numeric token is left as-is.
#     """
#     numbers, labels, _ = pattern_info
#     num2label = {str(n): lbl for n, lbl in zip(numbers, labels)}
#
#     def convert(token: str) -> str:
#         m = re.fullmatch(r"\s*(\d+)\s*([+\-]?)\s*", token)
#         if not m:
#             return token.strip()
#         num, sign = m.groups()
#         label = num2label.get(num, event_label)
#         return f"{label}{sign}"
#
#     # drop the outer parentheses        "(A, B)"  →  "A, B"
#     inside = key.strip()[1:-1]
#     parts  = [convert(t) for t in inside.split(",")]
#
#     # if we have exactly two parts, reverse and format as requested
#     if len(parts) == 2:
#         left, right = parts         # left == part-0 , right == part-1
#         return f"({right}) - ({left})"
#
#     # fallback (unchanged behaviour for 1 item or >2 items)
#     translated = ", ".join(parts)
#     return f"({translated})"
#
#
# def combined_means(
#     cls0: dict[str, list[float]],
#     cls1: dict[str, list[float]],
#     pattern_info,
#     event_name
# ) -> dict[str, dict[str, float]]:
#     """
#     Computes the mean of combined values from two dictionaries (cls0 and cls1),
#     for each key present in cls0 or cls1. Returns a nested dictionary with the
#     outer_key wrapping the results (if provided), or a flat dictionary otherwise.
#
#     Args:
#         cls0 (dict[str, list[float]]): First dictionary of lists of floats.
#         cls1 (dict[str, list[float]]): Second dictionary of lists of floats.
#         outer_key (str, optional): If provided, wraps the result in another dictionary under this key.
#
#     Returns:
#         dict[str, dict[str, float]] or dict[str, float]: Combined mean values.
#     """
#     result: dict[str, float] = {}
#
#     all_keys = set(cls0) | set(cls1)
#     for key in all_keys:
#         combined = cls0.get(key, []) + cls1.get(key, [])
#         str_key = translet_to_lable(key, pattern_info, event_name)
#         result[str_key] = round(sum(combined) / len(combined), 3) if combined else None
#
#     return result
#
# from typing import Dict, Mapping
#
#
# def str_to_metrics_dict(raw: str, *, keep_numpy: bool = True) -> Dict[str, Dict[str, Any]]:
#     raw = raw.strip()
#
#     if keep_numpy:
#         safe_globals = {"__builtins__": {}, "np": np}
#         return eval(raw, safe_globals)          # type: ignore [eval-usage]
#
#     cleaned = re.sub(r"np\.float64\(([^)]+)\)", r"\1", raw)
#     return ast.literal_eval(cleaned)
#
# def _weighted_average_metrics(class_a: Mapping[str, Mapping[str, float]],
#                               class_b: Mapping[str, Mapping[str, float]],
#                               w_a: float,
#                               w_b: float
#                               ) -> Dict[str, Dict[str, float]]:
#
#     w_sum = w_a + w_b
#     w_a /= w_sum
#     w_b /= w_sum
#
#     combined: Dict[str, Dict[str, float]] = {}
#     all_keys = set(class_a) | set(class_b)
#
#     for key in all_keys:
#         rec_a = class_a.get(key, {})
#         rec_b = class_b.get(key, {})
#
#         combined[key] = {}
#         for metric in set(rec_a) | set(rec_b):
#             val_a = rec_a.get(metric, 0.0)
#             val_b = rec_b.get(metric, 0.0)
#             combined[key][metric] = val_a * w_a + val_b * w_b
#
#     return combined
#
# def transition_key(raw: str, pattern_info) -> str:
#     if "-" not in raw:
#         return raw
#
#     n_str, rest = raw.split("-", 1)
#     try:
#         n = int(n_str)
#     except ValueError:
#         return raw
#
#     parts = rest.split("_")
#     name_parts = []
#     for part in parts:
#         for idx in range(0, len(pattern_info[0])):
#             if int(part) == pattern_info[0][idx]:
#                 name_parts.append(pattern_info[1][idx])
#                 break
#     rhs = ", ".join(name_parts[:n])  # name1, name2, …, namen
#     lhs = ", ".join(name_parts[:n - 1])  # name1, name2, …, namen-1
#
#     # probability-style string
#     return f"P({rhs} | {lhs})"
#
#
# def _transition_probabilities(metrics: Mapping[str, Mapping[str, float]], pattern_info
#                               ) -> Dict[str, float]:
#     """VS_child / VS_parent """
#     ordered = sorted(metrics, key=lambda k: int(k.split('-')[0]))
#     trans: Dict[str, float] = {}
#
#     for i in range(1, len(ordered) - 1):
#         prev_vs = metrics[ordered[i - 1]]["VS"]
#         curr_vs = metrics[ordered[i]]["VS"]
#         trans[ordered[i]] = None if prev_vs == 0 else curr_vs / prev_vs
#
#     finel_result = {transition_key(k, pattern_info): v for k, v in trans.items()}
#
#     return finel_result
#
#
# def weighted_transition_probabilities(class_a: Dict[str, Dict[str, float]],
#                                       class_b: Dict[str, Dict[str, float]],
#                                       weight_a: float = 1.0,
#                                       weight_b: float = 1.0,
#                                         pattern_info: Dict[str, Any] = None
#                                       ) -> Dict[str, float]:
#     combined = _weighted_average_metrics(class_a, class_b, weight_a, weight_b)
#     return _transition_probabilities(combined, pattern_info)
#
# def format_transition_prob_key(raw_key: str, code_map: dict[str, str]) -> str:
#     # raw_key = 'P(Foley.Low, RR.Low | Foley.Low)'
#     inside = raw_key[2:-1]  # 'Foley.Low, RR.Low | Foley.Low'
#     next_part, prev_part = [s.strip() for s in inside.split("|")]
#
#     # פונקציה עזר שממירה 'A, B, C' → ['A','B','C'] → ['I1','I2','I3']
#     def to_codes_list(s: str) -> list[str]:
#         return [ code_map[x.strip()] for x in s.split(",") ]
#
#     next_codes = to_codes_list(next_part)
#     prev_codes = to_codes_list(prev_part)
#
#     return f"P({', '.join(next_codes)} | {', '.join(prev_codes)})"
#
# def pattern_info_dict(session_id: str, pattern_id: int, event_id: int) -> dict | None:
#     """
#     Build a full pattern-info dictionary **without** touching Flask request/response.
#
#     Returns:
#         dict  –  ready for jsonify / direct use
#         None  –  if pattern_id not found
#     """
#     # --- 1. Resolve the relevant dataframes ---------------------------------
#     patterns_df = const.LIST_PATTERNS
#     cutoffs_df  = const.SESSION_DATA[session_id]['predict_entity'][int(event_id)].get_states_df()
#
#     pattern_info = patterns_df.get(pattern_id)
#     if pattern_info is None:
#         return None
#
#     # --- 2. Build intervals + cut-offs --------------------------------------
#     inverted_map = {v: k for k, v in const.RELATION_MAPPING[7].items()}
#     intervals    = []
#
#     for i, (label, state_id) in enumerate(zip(pattern_info[1], pattern_info[0])):
#         slice_df = cutoffs_df[cutoffs_df[const.StatesColumns.StateID] == state_id]
#         slice_df = (
#             slice_df
#             .replace([np.inf, -np.inf], None)  # ∞ → None
#             .where(slice_df.notna(), None)  # NaN → None
#             .astype(object)  # np.float64 → python float
#         )
#         slice_df[const.StatesColumns.Label]  = label
#
#         intervals.append({
#             "label":     label,
#             "state_id":  state_id,
#             "cutoffs":   slice_df.to_dict(orient="records"),
#         })
#
#     code_map = {
#         iv["label"]: f"I{idx + 1}"
#         for idx, iv in enumerate(intervals)
#     }
#
#     event_name = const.LIST_EVENTS[event_id]["name"]
#     code_map[event_name] = "event"
#
#     for iv in intervals:
#         iv["code"] = code_map[iv["label"]]
#
#     relations = {}
#
#     list_rel = [inverted_map[int(p)] for p in pattern_info[2]]
#     n_intervals = len(pattern_info[0])
#     k = 0
#
#     for j in range(1, n_intervals):
#         for i in range(j):
#             relations[f"{i}-{j}"] = list_rel[k]
#             k += 1
#
#     # --- 3. Stats & explanations --------------------------------------------
#     pattern_name = const.SESSION_DATA[session_id]['predict_entity'][int(event_id)].model_parameters.list_names_patterns[pattern_id]
#     pattern_details = get_information_on_pattern(pattern_name)
#     confidences     = (pattern_details["Vertical_Support"] / const.DATA_DISTRIBUTIONS[2]).round(3)
#
#     model      = const.SESSION_DATA[session_id]['predict_entity'][int(event_id)].model_parameters
#     tiep_means = combined_means(model.list_fcpm_models[pattern_id].durations_cases,
#                                 model.list_fcpm_models[pattern_id].durations_controls,
#                                 pattern_info, const.LIST_EVENTS[event_id]["name"])
#
#     formatted_tiep = {}
#     for raw_tiep, dur in tiep_means.items():
#         # raw_tiep = '(AKI_st1_ig=45_mg=360+) - (SpO2.High-)'
#         left, right = raw_tiep.split(" - ")
#         # החליפו label בקודים
#         code_left = code_map[event_name] if "AKI_" in left else code_map[left.strip("()+-")]
#         code_right = code_map[right.strip("()+-")]
#         sign_left = "+" if "+" in left else "-"
#         sign_right = "+" if "+" in right else "-"
#         formatted_key = f"({code_left}{sign_left}) - ({code_right}{sign_right})"
#         formatted_tiep[formatted_key] = dur
#
#     tiep_means = formatted_tiep
#
#     transition_probabilities = weighted_transition_probabilities(str_to_metrics_dict(pattern_details["Prefix_Metrics_Cls0"]), str_to_metrics_dict(pattern_details["Prefix_Metrics_Cls1"]), 0.8, 0.2, pattern_info)
#
#     formatted_transitions = {
#         format_transition_prob_key(k, code_map): v
#         for k, v in transition_probabilities.items()
#     }
#     transition_probabilities = formatted_transitions
#
#     # scientific explanations
#     var_exp       = []
#     var_exp_df    = pd.read_csv(const.MODEL_CONFIG["Variable_Explanations"])
#     for lbl in pattern_info[1]:
#         base = lbl.split('.')[0]
#         row  = var_exp_df[var_exp_df[const.StatesColumns.Label] == base].iloc[0]
#         var_exp.append({
#             "label":       row["FullName"],
#             "type":        row[const.StatesColumns.Type],
#             "explanation": row[const.StatesColumns.ScientificExplanation],
#         })
#
#     avg_dist = const.DATA_DISTRIBUTIONS[0]
#     std_dist = const.DATA_DISTRIBUTIONS[1]
#
#     state_metrics = []
#     for iv in intervals:
#         sid = iv["state_id"]
#         state_metrics.append({
#             "code": iv["code"],
#             "mu": float(avg_dist.get(sid, 0)),
#             "sigma": float(std_dist.get(sid, 0)),
#         })
#
#     cutoffs_table = []
#     for iv in intervals:
#         cf = iv["cutoffs"][0]
#         low = cf["BinLow"] or None # possibly None
#         high = cf["BinHigh"] or None # possibly None
#         cutoffs_table.append({
#             "code": iv["code"],
#             "low": low if low is not None else None,
#             "high": high if high is not None else None
#         })
#
#     # --- 4. Final dict -------------------------------------------------------
#     return {
#         "event_id": event_id,
#         "pattern_id": pattern_id,
#         "code_map": code_map,
#         "intervals":            intervals,
#         "relations":            relations,
#         "event": {"name": event_name, "code": "event"},
#         "state_metrics": state_metrics,
#         "cutoffs":       cutoffs_table,
#         "Vertical_Support":     float(pattern_details["Vertical_Support"]) / const.DATA_DISTRIBUTIONS[2],
#         "Mean_Horizontal_Support": float(pattern_details["Mean_Horizontal_Support"]),
#         "Mean_Mean_Duration":   float(pattern_details["Mean_Mean_Duration"]),
#         "confidences":          float(confidences),
#         "tieps_avg_duration":   tiep_means,
#         "Variable_Explanations": var_exp,
#         "transition_probabilities": transition_probabilities
#     }
#
#
# @app.route('/pattern_info/<int:pattern_id>', methods=['GET'])
# def get_pattern_info(pattern_id):
#     session_id = request.args.get('session_id')
#     event_id   = request.args.get('event_id', type=int)
#
#     if event_id is None:
#         return jsonify({'error': 'Missing event_id parameter'}), 400
#
#     result = pattern_info_dict(session_id, pattern_id, event_id)
#     if result is None:
#         return jsonify({'error': 'Pattern not found'}), 404
#
#     return jsonify(result)
#
# @app.route('/all_patterns_info', methods=['GET'])
# def get_all_patterns_info():
#     session_id = request.args.get('session_id')
#     if session_id not in const.SESSION_DATA:
#         return jsonify({'error': 'invalid session'}), 400
#
#     all_event_ids = list(const.LIST_EVENTS.keys())
#     session = const.SESSION_DATA[session_id]
#     list_chosen_events = session.get('list_events')
#     if list_chosen_events:
#         selected_event_ids = [eid for eid in all_event_ids if eid in list_chosen_events]
#
#     path_info = const.MODEL_CONFIG["important_patterns"]
#     with open(path_info, encoding="utf-8") as f:
#         important_map = json.load(f)
#
#     results = []
#     with app.test_client() as c:
#         for event_id in selected_event_ids:
#             imp_dict = important_map.get(str(event_id), [])
#             for pattern_id in const.LIST_EVENTS[event_id]['patterns']:
#                 if str(pattern_id) in imp_dict:
#                     info = pattern_info_dict(session_id, pattern_id, event_id)
#                     results.append(info)
#
#     return jsonify(results)
#
#
# @app.route('/get_normal_bounds_for_TemporalPropertyID', methods=['GET'])
# def get_normal_bounds_for_TemporalPropertyID():
#     try:
#         # Read the variable explanations CSV
#         var_exp_df = pd.read_csv(const.MODEL_CONFIG["Variable_Explanations"])
#
#         # Create dictionary with TemporalPropertyID as key and bounds as value
#         normal_bounds_dict = {}
#
#         for _, row in var_exp_df.iterrows():
#             temporal_id = int(row['TemporalPropertyID'])
#             low_bound = float(row['LowNormalBound']) if pd.notna(row['LowNormalBound']) else None
#             high_bound = float(row['HighNormalBound']) if pd.notna(row['HighNormalBound']) else None
#
#             normal_bounds_dict[temporal_id] = [low_bound, high_bound]
#
#         return jsonify(normal_bounds_dict), 200
#
#     except Exception as e:
#         return jsonify({
#             'error': 'Unable to retrieve normal bounds'
#         }), 500
#
#
# @app.route('/get_current_time', methods=['GET'])
# def get_current_time():
#     """
#     Returns the current time in milliseconds since epoch.
#     """
#     session_id = request.args.get('session_id')
#     session = const.SESSION_DATA.get(session_id)
#     current_time = session['CURRENT_IDX']
#
#     return jsonify(current_time), 200
#
# # ------ end handle events & patterns data -----
