import pickle
from pathlib import Path

import pandas as pd
import const
from input.read_write_files import read_patterns_dataframe
from temporal_abstraction.main_abstraction import TemporalAbstraction


class Model:
    def __init__(self ,event_id, extract_path_model: str, paa_action, windows_size_paa,
                 abstraction_parameters: TemporalAbstraction, max_gap, window_size_detection, strict_window_detection,
                 threshold, time_delay, relation_mapping, agg_function, weights_file):
        self.event_id = event_id
        self.list_fcpm_models = {}
        self.list_reg_models = {}
        self.list_patterns = []
        self.list_names_patterns = {}
        self.paa_action = paa_action
        self.windows_size_paa = windows_size_paa
        self.abstraction_parameters = abstraction_parameters
        self.max_gap = max_gap
        self.window_size_detection = window_size_detection
        self.strict_window_detection = strict_window_detection
        self.threshold = threshold
        self.time_delay = time_delay
        self.relation_mapping = relation_mapping
        self.agg_function = agg_function
        self.weights_file = weights_file

        self.load_models(extract_path_model)
        self.extract_tirp_from_name()


    def load_models(self, models_root: str) -> None:
        """
        • models_root = תיקיית-על שבה נמצאות תיקיות ה-*.event*
          (למשל  "ahe_small"  כפי שהראית).
        • self.events  הוא  events_dict  שנבנה מה-JSON:
            { "0": {"id":0 , "name":"ahe"      , "patterns":[0,1]}, ... }
        • self.pattern  הוא  patterns_dict     שנבנה מה-JSON:
            { "0": [[45,43], [...], ["0","0","0"]], ... }
        פונקציה זו קוראת את כל קובצי ה-*.pkl  וממלאה:
            self.list_fcpm_models[pattern_idx][event_id] = model
            self.list_reg_models [pattern_idx][event_id] = model
        """
        self.list_fcpm_models = {}
        self.list_reg_models = {}

        models_root = Path(models_root)

        patterns_ids = const.LIST_EVENTS[self.event_id]["patterns"]

        #   …/ahe_small/ahe.event/trained_models/
        tm_dir = models_root / "trained_models"

        for pattern_idx in patterns_ids:
            # נתוני התבנית
            state_ids, _labels, tail_vals = const.LIST_PATTERNS[pattern_idx]

            #  <len>-<ids>_999_<tail>
            encoded = (
                    f"{(len(state_ids)+1)}-"
                    + "_".join(map(str, state_ids))
                    + f"_{const.EVENT_INDEX}_"
                    + "_".join(map(str, tail_vals))
            )
            # דוגמה:  "3-45_43_999_0_0_0"

            # מעבר על הקבצים הרלוונטיים
            for fname in tm_dir.iterdir():
                if not fname.suffix == ".pkl" or encoded not in fname.name:
                    continue

                self.list_names_patterns[pattern_idx] = encoded

                if fname.name.endswith("-FCPM.pkl"):
                    self._load_model_to_dict(
                        self.list_fcpm_models, pattern_idx, fname
                    )
                elif fname.name.endswith("-TTE.pkl"):
                    self._load_model_to_dict(
                        self.list_reg_models, pattern_idx, fname
                    )

    def _load_model_to_dict(self,
                            model_dict: dict,
                            pattern_idx: int,

                            model_path: Path) -> None:
        """helper — טוען את ה-pkl פעם אחת ושומר במילון המקונן"""
        if pattern_idx not in model_dict:
            model_dict[pattern_idx] = {}

        with open(model_path, "rb") as f:
            model_dict[pattern_idx] = pickle.load(f)

    def extract_tirp_from_name(self):
        """
        Extracts STIs and TempRels from model names and builds a unique list of TIRPs.
        """
        data = []

        inverted_map = {v: k for k, v in const.RELATION_MAPPING[self.relation_mapping].items()}


        for pattern_id, patterns_dict in self.list_fcpm_models.items():
            list_relations = [inverted_map[int(p)] for p in const.LIST_PATTERNS[pattern_id][2]]
            data.append({
                const.INDEX_PATTERN_COL_NAME: pattern_id,
                const.PAT_STIS_COL_NAME: const.LIST_PATTERNS[pattern_id][0] + [const.EVENT_INDEX],
                const.PAT_TEMP_RELS_COL_NAME: list_relations
            })

        self.pattern_df = pd.DataFrame(data)
        self.list_patterns = read_patterns_dataframe(self.pattern_df, self.abstraction_parameters.states_table)

