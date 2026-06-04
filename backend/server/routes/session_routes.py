from flask import Blueprint, jsonify, request
import json
from uuid import uuid4
import const
from server.utils import validate_session
from server.entity_data_player import EntityDataPlayer
from prediction.predict_entity import PredictEntity
from core_comp.model import Model
from temporal_abstraction.main_abstraction import TemporalAbstraction
from pathlib import Path
from typing import Dict, Union
import csv
import json
import pandas as pd

# Create the blueprint
session_bp = Blueprint("session", __name__)


# ---------- Helper: Load parameters for model ----------

def load_parameters_model(event_id, name_dataset=None):
    if name_dataset is None:
        default_key = next(iter(const.DICT_SETTING))  # e.g., "Falls"
        dict_setting = const.DICT_SETTING[default_key]
    else:
        dict_setting = const.DICT_SETTING[name_dataset]

    state_data_path = (
        const.MODEL_CONFIG["states_path"] + "\\" + const.LIST_EVENTS[event_id]["name"] + "_event/states.csv"
    )
    temporal_abstraction = TemporalAbstraction(
        discretization_method=const.MethodsNames.KnowledgeBased,
        path_states_table=state_data_path,
        delta_T=dict_setting["DELTA_T"][event_id],
        list_interpolation_gap=dict_setting["INTERPOLATION_GAP"][event_id],
        retroactive_state_closure=dict_setting["RETROACTIVE_STATE_CLOSURE"]
    )
    extract_path_model = (
        const.MODEL_CONFIG['models_path'] + "\\" + const.LIST_EVENTS[event_id]["name"] + "_event"
    )
    model = Model(
        event_id=event_id,
        extract_path_model=extract_path_model,
        paa_action=dict_setting["PAA_ACTION"][event_id],
        windows_size_paa=dict_setting["WINDOW_SIZE_PAA"][event_id],
        abstraction_parameters=temporal_abstraction,
        max_gap=dict_setting["MAX_GAP"][event_id],
        window_size_detection=dict_setting["WINDOW_SIZE_DETECTION"],
        strict_window_detection=dict_setting["STRICT_WINDOW_DETECTION"],
        threshold=dict_setting["THRESHOLD"][event_id],
        time_delay=dict_setting["DELTA_T"][event_id],
        relation_mapping=dict_setting["NUM_RELATION"][event_id],
        agg_function=dict_setting["AGGREGATION_FUNCTION"][event_id],
        weights_file=const.MODEL_CONFIG['weights_file']
    )
    return model, dict_setting["EVENT_INDICATOR"]


# ---------- Session Management ----------

@session_bp.route('/create_session', methods=['POST'])
def create_session():
    session_id = str(uuid4())

    predict_entity = []

    data_player = EntityDataPlayer(const.MODEL_CONFIG["raw_data_path"])

    path_info = const.MODEL_CONFIG["important_patterns"]
    with open(path_info, encoding="utf-8") as f:
        important_map = json.load(f)

    for event_id in const.LIST_EVENTS.keys():
        list_pattern = []
        dict_pattern = important_map.get(str(event_id), [])
        for key in dict_pattern:
            list_pattern.append(int(key))
        model_parameters, event_indicator = load_parameters_model(int(event_id))
        predict_entity.append(PredictEntity(
            event_idx=int(event_id),
            set_important_patterns=list_pattern,
            model_parameters=model_parameters,
            event_indicator=event_indicator
        ))

    new_session = {
        'CURRENT_IDX': 1,
        'data_buffer': [],
        'entity_id': None,
        'processing_started': False,
        'data_player': None,
        'predict_entity': None,
        'list_events': None
    }
    new_session.update({
        'entity_id': None,
        'data_player': data_player,
        'predict_entity': predict_entity
    })
    const.SESSION_DATA[session_id] = new_session

    return jsonify({'session_id': session_id}), 200


@session_bp.route('/reset_session', methods=['POST'])
def reset_session():
    session_id = request.args.get('session_id')

    # choose dataset
    name_dataset = request.args.get('name_dataset', None)

    error = validate_session(session_id)
    if error:
        return error

    session = const.SESSION_DATA[session_id]


    if name_dataset is None:
        previous_entity = session.get('entity_id')
        previous_list_events = session.get('list_events')

        new_data_player = EntityDataPlayer(const.MODEL_CONFIG["raw_data_path"], previous_entity)

        path_info = const.MODEL_CONFIG["important_patterns"]
        with open(path_info, encoding="utf-8") as f:
            important_map = json.load(f)

        new_predictors = []
        for event_id in const.LIST_EVENTS.keys():
            dict_pattern = important_map.get(str(event_id), [])
            model_parameters, event_indicator = load_parameters_model(int(event_id))
            new_predictors.append(PredictEntity(
                event_idx=int(event_id),
                set_important_patterns=dict_pattern,
                model_parameters=model_parameters,
                event_indicator=event_indicator
            ))

        new_session = {
            'CURRENT_IDX': 1,
            'data_buffer': [],
            'entity_id': previous_entity,
            'processing_started': False,
            'data_player': new_data_player,
            'predict_entity': new_predictors,
            'list_events': previous_list_events
        }
        const.SESSION_DATA[session_id] = new_session

        if new_data_player is not None:
            new_data_player.load_series_data()

        return jsonify({'status': 'Session reset'}), 200

    else:
        const.MODEL_CONFIG = const.MODEL_PATHS[name_dataset]

        const.LIST_PATTERNS, const.LIST_EVENTS = crate_pattern_and_event_dict()
        const.LIST_MODELS_ENTITIES = create_entities_list()
        const.DATA_DISTRIBUTIONS = avg_and_std_by_state(const.MODEL_CONFIG["train_data"])

        predict_entity = []

        data_player = EntityDataPlayer(const.MODEL_CONFIG["raw_data_path"])

        path_info = const.MODEL_CONFIG["important_patterns"]
        with open(path_info, encoding="utf-8") as f:
            important_map = json.load(f)

        for event_id in const.LIST_EVENTS.keys():
            list_pattern = []
            dict_pattern = important_map.get(str(event_id), [])
            for key in dict_pattern:
                list_pattern.append(int(key))
            model_parameters, event_indicator = load_parameters_model(int(event_id))
            predict_entity.append(PredictEntity(
                event_idx=int(event_id),
                set_important_patterns=list_pattern,
                model_parameters=model_parameters,
                event_indicator=event_indicator
            ))

        new_session = {
            'CURRENT_IDX': 1,
            'data_buffer': [],
            'entity_id': None,
            'processing_started': False,
            'data_player': None,
            'predict_entity': None,
            'list_events': None
        }
        new_session.update({
            'entity_id': None,
            'data_player': data_player,
            'predict_entity': predict_entity
        })
        const.SESSION_DATA[session_id] = new_session

        return jsonify({'session_id': session_id}), 200


# ---------- Entity & Events Selection ----------

@session_bp.route('/available_models_and_entities', methods=['POST'])
def fetch_available_models_and_entities():
    return jsonify({'model_and_entities': const.LIST_MODELS_ENTITIES}), 200

@session_bp.route('/fetch_dataset_names', methods=['GET'])
def fetchDatasetNames():
    lst =  list(const.DICT_SETTING.keys())
    return lst


@session_bp.route('/select_entity_and_events', methods=['POST'])
def select_entity_and_events():
    data = request.json
    session_id = data['session_id']
    error = validate_session(session_id)
    if error:
        return error

    entity_id = int(data['entity_id'])
    selected_events = data['list_events']

    const.SESSION_DATA[session_id]['entity_id'] = entity_id
    data_player = const.SESSION_DATA[session_id]['data_player']
    data_player.set_entity_id(entity_id)
    data_player.load_series_data()
    const.SESSION_DATA[session_id]['list_events'] = selected_events
    const.SESSION_DATA[session_id]['CURRENT_IDX'] = 1

    return jsonify(success=True)


@session_bp.route('/current_selection', methods=['GET'])
def current_selection():
    session_id = request.args.get('session_id')
    error = validate_session(session_id)
    if error:
        return error

    session = const.SESSION_DATA[session_id]
    entity_id = session['entity_id']
    list_events = session['list_events']

    return jsonify({'entity_id': entity_id, 'list_events': list_events}), 200


def avg_and_std_by_state(
        csv_path: Union[str, Path],
        ddof: int = 1
) -> list[Dict[int, float], Dict[int, float]]:
    df = pd.read_csv(csv_path)

    n_hosp = df["entity_id"].nunique()

    df["duration"] = df["end"] - df["start"]
    score_column = "duration"

    grouped = df.groupby("symbolid")[score_column]
    mean_dict = grouped.mean().round(3).to_dict()
    std_dict  = grouped.std(ddof=0).round(3).to_dict()

    return mean_dict, std_dict, n_hosp

def create_event_list(list_event):
    """
    {"event_idx": "event_name", ...}
    """
    event_list = {}
    for idx_event, event in list_event.items():
        event_list[str(idx_event)] = event["name"]
    return event_list

def create_entities_list():
    """
    {
          "events": {"event_idx": "event_name", ...}
          "entities": [0, 1, 2]
    }
    """
    list_model_and_entities = {}
    important_entities = []
    path = const.MODEL_CONFIG["raw_data_path"]
    df = pd.read_csv(path)
    entity_list = df[const.DatasetColumns.EntityID].unique()
    # filter entities
    for entity in entity_list:
        if entity in const.ENTITIES_LIST:
            important_entities.append(int(entity))

    list_model_and_entities["events"] = create_event_list(const.LIST_EVENTS)
    list_model_and_entities["entities"] = important_entities
    return list_model_and_entities

def load_state_mapping(states_csv: Path) -> dict[int, str]:
    mapping = {}
    with states_csv.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            state_id = int(row["StateID"])
            mapping[state_id] = f'{row["Label"]}.{row["BinLabel"]}'
    return mapping

def parse_model_filename(fname: str):
    stem = Path(fname).stem
    stem = stem.rsplit("-", 1)[0]
    _, encoded = stem.split("-", 1)
    tokens = encoded.split("_")

    idx_999 = tokens.index(str(const.EVENT_INDEX))
    state_ids = list(map(int, tokens[:idx_999]))
    tail_vals = tokens[idx_999 + 1:]

    return state_ids, tail_vals

def build_patterns_and_events(root_events: Path):
    """
    Returns
        patterns_dict , events_dict
    and keeps the ordering:
        • events alphabetically
        • models alphabetically inside each event
    """
    patterns_dict = {}
    events_dict   = {}

    pattern_id = 0           # running counter for patterns
    event_id   = 0

    for event_dir in sorted(root_events.glob("*_event")):
        event_name = event_dir.stem          # e.g. 'ahe', 'aki_stg1'
        state_map  = load_state_mapping(event_dir / "states.csv")
        tm_dir     = event_dir / "trained_models"

        this_event_pattern_ids = []

        for pkl_file in sorted(tm_dir.glob("*-FCPM.pkl")):
            state_ids, tail_vals = parse_model_filename(pkl_file.name)
            labels = [state_map[sid] for sid in state_ids]

            patterns_dict[int(pattern_id)] = [state_ids, labels, tail_vals]
            this_event_pattern_ids.append(pattern_id)
            pattern_id += 1

        events_dict[int(event_id)] = {
            "id":       event_id,
            "name":     event_name[:-6],  # remove '_event'
            "patterns": this_event_pattern_ids
        }
        event_id += 1

    return patterns_dict, events_dict

def crate_pattern_and_event_dict():
    root_path = Path(const.MODEL_CONFIG["project_name"])
    patterns_dict, events_dict = build_patterns_and_events(root_path)

    with (root_path / "patterns_dict.json").open("w", encoding="utf-8") as f:
        json.dump(patterns_dict, f, indent=4, ensure_ascii=False)

    with (root_path / "events_dict.json").open("w", encoding="utf-8") as f:
        json.dump(events_dict, f, indent=4, ensure_ascii=False)

    return patterns_dict, events_dict