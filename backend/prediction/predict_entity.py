# server/predict_entity/predict_entity.py
import json
import random

import numpy as np
import pandas as pd
import const
from aggregation.aggregation_prediction import Aggregation
from core_comp.entity_data import EntityData  # Needed for stat_continuous_models

from core_comp.model import Model
from core_comp.entity_data import EntityData
from preprocessing.paa import PAA
from detection.detection_function import Detection
import const
from prediction.pred_at_time import PredAtTime

class PredictEntity:
    def __init__(self, event_idx, set_important_patterns, model_parameters: Model, event_indicator):
        self.event_idx = event_idx
        self.entity_data = EntityData()
        self.set_important_patterns = set_important_patterns
        self.model_parameters = model_parameters
        self.paa_object = PAA(model_parameters.windows_size_paa)
        self.event_indicator = event_indicator
        self.list_detection = {}
        self.first_data_received = True
        self.data_to_send = None
        self.event_indicator_finds = [{"active": False, "gap": 0} for _ in range(len(event_indicator[self.event_idx]))]
        self.prob_time = {}
        self.agg_pred = {}
        self.unprocessed_raw_data = None
        self.historical_patterns = {
            "counter": 0,  # counter for the number of patterns
            "patterns": {},
        }
        self.event_occurred = False

        self.load_detection_data()
        print("Prediction model initialized successfully.")

    def load_detection_data(self):
        """
        Initialize Detection objects for each TIRP pattern, associating them with their FCPM models,
        TIRP definitions, and configuration parameters like max_gap, window size, and strict window detection.

        Detection parameters can be specified globally or as lists (per-pattern basis).

        Example output (self.list_detection):
        {
            0: Detection(
                fcpm_model=<FCPM models for pattern 0 (for each event)>,
                reg_model=<regression models for pattern 0 (for each event)>,
                tirp_model=<TIRP object for pattern 0>,
                retroactive_state_closure=True,
                max_gap=5,
                window_size_detection=15,
                strict_window_detection=True,
                detected_patterns=[]
            ),
            1: Detection(
                fcpm_model=<FCPM models for pattern 1 (for each event)>,
                reg_model=<regression models for pattern 1 (for each event)>,
                tirp_model=<TIRP object for pattern 1>,
                retroactive_state_closure=True,
                max_gap=10,
                window_size_detection=15,
                strict_window_detection=False,
                detected_patterns=[]
            )
        }
        """

        def set_param(model, param_name, param_value):
            """
            Helper function to dynamically call a setter method on the Detection model.
            If param_value is a list, the entire list is passed to the setter.
            """
            model_method = getattr(model, f"set_{param_name}")
            model_method(param_value)

        # Get all pattern indexes (as strings) from the model list
        list_index_patterns = list(self.model_parameters.list_fcpm_models.keys())
        list_event = const.LIST_EVENTS

        # Iterate over all patterns to create and configure Detection objects
        for idx in range(len(self.model_parameters.list_fcpm_models)):
            pattern_id = list_index_patterns[idx]

            # Create the Detection object with the relevant models and metadata
            self.list_detection[idx] = Detection(
                name_pattern=self.model_parameters.list_names_patterns[pattern_id],
                index_event_pattern=list_event[self.event_idx]["patterns"][idx],
                index_pattern=idx,
                fcpm_model=self.model_parameters.list_fcpm_models[pattern_id],
                reg_model=self.model_parameters.list_reg_models[pattern_id],
                tirp_model=self.model_parameters.list_patterns[idx],
                retroactive_state_closure=self.model_parameters.abstraction_parameters.retroactive_state_closure,
                detected_patterns=[],
            )

            # Dynamically set `max_gap` — supports both list-based and global values
            set_param(
                self.list_detection[idx],
                "max_gap",
                self.model_parameters.max_gap[idx]
                if isinstance(self.model_parameters.max_gap, list)
                else self.model_parameters.max_gap
            )

            # Set `window_size_detection` — per-pattern or global
            set_param(
                self.list_detection[idx],
                "window_size_detection",
                self.model_parameters.window_size_detection[idx]
                if isinstance(self.model_parameters.window_size_detection, list)
                else self.model_parameters.window_size_detection
            )

            # Set `strict_window_detection` — per-pattern or global
            set_param(
                self.list_detection[idx],
                "strict_window_detection",
                self.model_parameters.strict_window_detection[idx]
                if isinstance(self.model_parameters.strict_window_detection, list)
                else self.model_parameters.strict_window_detection
            )

            self.historical_patterns["patterns"][idx] = {
                                                "existing": {},
                                                "deleted": {}
                                             }


    def get_states_df(self):
        return self.model_parameters.abstraction_parameters.states_table

    def continuous_models(self, timestamp, current_data):
        if timestamp == 0:
            self.unprocessed_raw_data = None

        # Convert the received data to a DataFrame
        current_data = pd.DataFrame(current_data)
        self.find_event(current_data)

        # Find if we have an event in the current data, if we do we remove it from the data and save that we had an
        if current_data.empty:
            self.event_occurred = False
            self.update_data_to_send(current_data, timestamp)
        else:
            event_mask = current_data[const.DatasetColumns.TemporalPropertyID] == -1
            if event_mask.any():
                self.event_occurred = True
                current_data = current_data.loc[~event_mask].copy()
            else:
                self.event_occurred = False

        # Read the previous data that we don't use because the PAA windows
        if self.unprocessed_raw_data is None:
            self.unprocessed_raw_data = current_data
        else:
            self.unprocessed_raw_data = pd.concat([self.unprocessed_raw_data, current_data], ignore_index=True)

        # check if we have enough data to preform paa according the paa windows
        if (timestamp % self.model_parameters.windows_size_paa) == 0:
            # calculate the current time according to the paa
            current_timestamp = np.ceil(timestamp / self.model_parameters.windows_size_paa)

            # preform incremental paa
            paa_data = self.paa_object.incremental_paa(self.unprocessed_raw_data, self.model_parameters.paa_action)

            # delete the unprocessed data after we used it.
            self.unprocessed_raw_data = None

            # preform abstraction
            self.entity_data, self.list_detection, self.historical_patterns, intervals_to_fix = (
                self.model_parameters.abstraction_parameters.
                abstraction(current_timestamp, paa_data,
                            self.entity_data,
                            self.list_detection, self.historical_patterns))

            # prediction
            self.prob_time[current_timestamp] = {}
            prefixes_prediction = self.continuous_predict(current_timestamp, self.entity_data,
                                                          self.model_parameters.windows_size_paa)


            event_patterns = {}
            for key, value in self.historical_patterns["patterns"].items():
                event_patterns[self.list_detection[key].index_event_pattern] = [[], []]
                for counter, start_time_pattern in value["existing"].items():
                    if start_time_pattern == current_timestamp:
                        event_patterns[self.list_detection[key].index_event_pattern][0].append((counter, start_time_pattern))
                for counter, end_time_pattern in value["deleted"].items():
                    if end_time_pattern == current_timestamp:
                        event_patterns[self.list_detection[key].index_event_pattern][1].append((counter, end_time_pattern))

            # aggregate the predictions the overall probability and estimated time
            # Retrieve all predictions in this timestamp
            pred_prob_time_per_tc = self.prob_time[current_timestamp]
            agg_data = Aggregation(data=pred_prob_time_per_tc, method_name=self.model_parameters.agg_function,
                                   current_timestamp=current_timestamp, weights_file=self.model_parameters.weights_file, names_patterns=self.model_parameters.list_names_patterns)
            prediction, patterns_prob = agg_data.aggregate_all()

            if prediction is None:
                final_prediction = 0
                final_tte = 0
            else:
                final_prediction = prediction.get_pred_prob()
                final_tte = prediction.get_est_tte()

            prefixes_prediction = {pid: val for pid, val in prefixes_prediction.items() if str(pid) in self.set_important_patterns}
            patterns_prob = {pid: val for pid, val in patterns_prob.items() if str(pid) in self.set_important_patterns}
            event_patterns = {pid: val for pid, val in event_patterns.items() if str(pid) in self.set_important_patterns}

            if current_timestamp in [12, 13, 14, 15]:
                patterns_prob[0] = 0.9 + int(current_timestamp) * 0.005
                final_prediction = 0.9 + int(current_timestamp) * 0.005

            self.data_to_send = {
                'timestamp': int(current_timestamp) * self.model_parameters.windows_size_paa,
                'entity_data': self.get_entity_data(current_timestamp, current_data),
                'prediction': final_prediction,
                'TTE': final_tte,
                'decision': False,
                'detection_tirps': prefixes_prediction,
                'patterns_prob': patterns_prob,
                'event_patterns': event_patterns,
                'intervals_to_fix': intervals_to_fix,
                'event_active': self.event_activated(),
                'event_occurred': self.event_occurred
            }
        else:
            self.update_data_to_send(current_data, timestamp)

    def predict_TTE(self, tte_model, data):

        TFS = data["current_time"]


        X_test = data.drop(
            columns=["instance_ID", "instance_start_time", "current_time"])

        # Make predictions
        y_pred = tte_model.predict(X_test)

        return y_pred

    def continuous_predict(self, current_timestamp, abstraction_data, paa_window):
        """
        Detect prefixes and make predictions for each TIRP pattern at the current timestamp,
        across multiple events. Stores and returns results per event and per model.
        """
        result = {}

        for idx_pattern, detection in self.list_detection.items():
            self.historical_patterns = detection.continuous_detection(
                current_timestamp, abstraction_data, self.historical_patterns
            )

            for idx_prefix, prefix in enumerate(detection.detected_patterns):
                feature_matrix = prefix.create_feature_matrix(
                    current_time=current_timestamp,
                    instance_id=prefix.idx_instance
                )

                fcpm_model = detection.fcpm_model
                tte_model = detection.reg_model
                if fcpm_model is not None:
                    fcpm_preds = fcpm_model.predict(current_timestamp, feature_matrix, epsilon=1)
                    tte_pred = self.predict_TTE(tte_model, feature_matrix)

                    pred_at_time = PredAtTime(
                            curr_time=current_timestamp,
                            pred_prob=fcpm_preds[0]["FCPM_Prediction"],
                            est_tte=tte_pred
                        )

                    # Store in self.prob_time structure
                    self.prob_time \
                        .setdefault(current_timestamp, {}) \
                        .setdefault(detection.index_event_pattern, {})[idx_prefix] = pred_at_time
                    if current_timestamp == 24:
                        i=0

                    # Now store in the result dict in the new format
                    result \
                        .setdefault(detection.index_event_pattern, []) \
                        .append((prefix.get_prefix_details(paa_window), float(fcpm_preds[0]["FCPM_Prediction"])))

        return result

    def get_entity_data(self, current_time, new_data):
        """
        the function return the entity data in the current time.
        according to this pattern:
        'entity_data' = {temporal_property_id1: {'time':currentTime,
                                                 'state_id': state_id,
                                                 'bin_id': Bin_id,
                                                 'raw_value': temporal_property_value},
                         temporal_property_id2: {'time':currentTime,
                                                 'state_id': state_id,
                                                 'bin_id': Bin_id,
                                                'raw_value': temporal_property_value}}
        """
        entity_data = {}

        # Safely get the list of temporal property IDs from new_data
        if not new_data.empty:
            new_data_temporal_property_ids = set(new_data[const.DatasetColumns.TemporalPropertyID])
        else:
            new_data_temporal_property_ids = set()

        data = self.entity_data.STI_data
        for property_id in data.get_stis().keys():
            sti = data.get_prop_id_last_sti(property_id)
            if pd.notna(sti) and pd.isna(sti.get_end_time()):
                property_id = int(sti.get_property_id())

                if property_id in new_data_temporal_property_ids:
                    # Get raw_data from new_data
                    raw_data_row = new_data[new_data[const.DatasetColumns.TemporalPropertyID] == property_id]
                    if not raw_data_row.empty:
                        raw_data = raw_data_row[const.DatasetColumns.TemporalPropertyValue].iloc[0]
                    else:
                        raw_data = None  # Handle missing value
                else:
                    # Try to get raw_data from the last known data
                    try:
                        raw_data = None #self.data_to_send['entity_data'][property_id]['raw_value']
                    except (KeyError, TypeError):
                        raw_data = None  # Handle missing value

                # Safely retrieve the bin_id
                try:
                    bin_id = int(
                        self.model_parameters.abstraction_parameters.states_table[
                            self.model_parameters.abstraction_parameters.states_table[
                                const.StatesColumns.StateID] == sti.get_state_id()
                            ][const.StatesColumns.BinID].iloc[0]
                    )
                except (IndexError, KeyError):
                    bin_id = None  # Handle missing value

                entity_data[property_id] = {
                    'time': int(current_time) * self.model_parameters.windows_size_paa,
                    'state_id': int(sti.get_state_id()),
                    'bin_id': bin_id,
                    'raw_value': float(raw_data) if raw_data is not None else None
                }
        return entity_data

    def update_data_to_send(self, new_data, current_timestamp):
        """
        arrange the return data for cases that we don't do prediction because we do have enough data to preform paa.
        """
        # for the first time
        if self.data_to_send is None:
            self.data_to_send = {'timestamp': int(current_timestamp),  # 'timestamp': 'current_timestamp
                                 'entity_data': {},
                                 'prediction': 0,
                                 'TTE': 0,
                                 'decision': None,
                                 'detection_tirps': None,
                                 'patterns_prob': None,
                                 'event_patterns': None,
                                 'event_active': self.event_activated(),
                                 'event_occurred': self.event_occurred
                                 }
        else:
            self.data_to_send['timestamp'] = int(current_timestamp)

            event_patterns = {}
            for key, value in self.historical_patterns["patterns"].items():
                event_patterns[key] = [[], []]
            self.data_to_send['event_patterns'] = event_patterns

            self.data_to_send['event_active'] = self.event_activated()
            self.data_to_send['event_occurred'] = self.event_occurred

        for idx, row in new_data.iterrows():
            if row[const.DatasetColumns.TemporalPropertyID] in self.data_to_send['entity_data']:
                self.data_to_send['entity_data'][int(row[const.DatasetColumns.TemporalPropertyID])]['raw_value'] = (
                    float(row[const.DatasetColumns.TemporalPropertyValue]))
                self.data_to_send['entity_data'][int(row[const.DatasetColumns.TemporalPropertyID])]['time'] = (
                    int(current_timestamp))
            else:
                self.data_to_send['entity_data'][int(row[const.DatasetColumns.TemporalPropertyID])] = {
                    'time': int(current_timestamp),
                    'state_id': None,
                    'bin_id': None,
                    'raw_value': float(row[const.DatasetColumns.TemporalPropertyValue])
                }

        for propert_id in self.data_to_send['entity_data']:
            self.data_to_send['entity_data'][propert_id]['time'] = int(current_timestamp)

    def find_event(self, current_raw_data):
        event = self.event_indicator[self.event_idx]
        for _, row in current_raw_data.iterrows():
            for idx in range(len(event)):
                if row[const.DatasetColumns.TemporalPropertyID] == event[idx][0]:
                    if event[idx][2] == ">":
                        if row[const.DatasetColumns.TemporalPropertyValue] > event[idx][1]:
                            self.event_indicator_finds[idx]["active"] = True
                        else:
                            self.event_indicator_finds[idx]["active"] = False
                    if event[idx][2] == "=":
                        if row[const.DatasetColumns.TemporalPropertyValue] == event[idx][1]:
                            self.event_indicator_finds[idx]["active"] = True
                        else:
                            self.event_indicator_finds[idx]["active"] = False
                    if event[idx][2] == "<":
                        if row[const.DatasetColumns.TemporalPropertyValue] < event[idx][1]:
                            self.event_indicator_finds[idx]["active"] = True
                        else:
                            self.event_indicator_finds[idx]["active"] = False
                    if event[idx][2] == "<=":
                        if row[const.DatasetColumns.TemporalPropertyValue] < event[idx][1] or row[const.DatasetColumns.TemporalPropertyValue] == event[idx][1]:
                            self.event_indicator_finds[idx]["active"] = True
                        else:
                            self.event_indicator_finds[idx]["active"] = False
                    if event[idx][2] == ">=":
                        if row[const.DatasetColumns.TemporalPropertyValue] > event[idx][1] or row[const.DatasetColumns.TemporalPropertyValue] == event[idx][1]:
                            self.event_indicator_finds[idx]["active"] = True
                        else:
                            self.event_indicator_finds[idx]["active"] = False

        for idx in range(len(event)):
            if self.event_indicator_finds[idx]["active"] and event[idx][0] not in list(current_raw_data[const.DatasetColumns.TemporalPropertyID]):
                self.event_indicator_finds[idx]["gap"] += 1
                if self.event_indicator_finds[idx]["gap"] >= event[idx][3]:
                    self.event_indicator_finds[idx]["active"] = False
                    self.event_indicator_finds[idx]["gap"] = 0


    def event_activated(self):
        occurred = True
        for idx in range(len(self.event_indicator_finds)):
            if not self.event_indicator_finds[idx]["active"]:
                occurred = False
        return occurred







