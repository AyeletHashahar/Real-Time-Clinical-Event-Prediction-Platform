import csv
import json

from server.app import app, socketio
import const
from server.app import app
from core_comp.model import Model
from prediction.predict_entity import PredictEntity
from temporal_abstraction.main_abstraction import TemporalAbstraction
import pandas as pd
from waitress import serve
from threading import Lock
from pathlib import Path
from typing import Dict, Union

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

if __name__ == '__main__':

    const.LIST_PATTERNS, const.LIST_EVENTS = crate_pattern_and_event_dict()
    const.LIST_MODELS_ENTITIES = create_entities_list()
    const.DATA_DISTRIBUTIONS = avg_and_std_by_state(const.MODEL_CONFIG["train_data"])

    context = (
        'C:/Certbot/live/lior.cs.bgu.ac.il/fullchain.pem',
        'C:/Certbot/live/lior.cs.bgu.ac.il/privkey.pem'
    )

    # Start the Flask app with Flask-SocketIO
    DEBUG = False# Set to True for debugging
    if DEBUG:
        app.run(debug=False, threaded=True, port=5000)
    else:
        serve(app, host='0.0.0.0', port=5000, threads=8)
        # app.run(host='0.0.0.0', port=5000, ssl_context=context, threaded=True)

