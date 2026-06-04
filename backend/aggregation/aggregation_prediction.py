# from prediction.pred_at_time import PredAtTime
#
#
# class Aggregation:
#     def __init__(self, data, agg_func, current_timestamp):
#         """
#         data: { 'index Event1': {'index TIRP1': {'idx_prefix1': pred_at_time1,
#                                                     'idx_prefix2': pred_at_time2},
#                                                 {'idx_prefix1': pred_at_time1,
#                                                     'idx_prefix2': pred_at_time2}
#                                                 }
#         """
#         self.current_time: int = current_timestamp
#         self.data = data
#         self.agg_func = agg_func
#         self._weights: list = []
#
#         self._create_weights_list()
#
#     def aggregate_all(self):
#         """
#         Returns:
#             prediction: PredAtTime
#             patterns_prob: {tirp_idx: PredAtTime}
#         """
#         prediction = None
#         lst_prob_event = []
#         lst_tte_event = []
#
#         patterns_prob = {}
#
#         all_prefix_ids = []
#
#         for idx_tirp, prefix_data in self.data.items():
#             lst_prob_tirp = []
#             lst_tte_tirp = []
#             prefix_ids = []
#
#             for idx_prefix, pred in prefix_data.items():
#                 lst_prob_tirp.append(pred.get_pred_prob())
#                 lst_tte_tirp.append(pred.get_est_tte())
#                 lst_prob_event.append(pred.get_pred_prob())
#                 lst_tte_event.append(pred.get_est_tte())
#                 prefix_ids.append(idx_prefix)
#                 all_prefix_ids.append((idx_tirp, idx_prefix))
#
#             patterns_prob[idx_tirp] = self._agg_values(
#                 lst_prob_tirp, lst_tte_tirp, idx_tirp, prefix_ids
#             ).get_pred_prob()
#
#             # group all prefix_ids from all tirps under this event
#             flat_prefix_ids = [p for _, p in all_prefix_ids]
#             prediction = self._agg_values(
#                 lst_prob_event, lst_tte_event, prefix_ids=flat_prefix_ids
#             )
#
#         return prediction, patterns_prob
#
#     def _create_weights_list(self):
#         self._weights = {}
#         self._weights = {}
#         for idx_tirp, tirp_data in self.data.items():
#             self._weights[idx_tirp] = {}
#             for idx_prefix, _ in tirp_data.items():
#                 self._weights[idx_tirp][idx_prefix] = 1  # default weight
#
#     def _get_weights(self, idx_tirp=None, prefix_ids=None):
#         if prefix_ids is None:
#             return []
#
#         if idx_tirp is not None:
#             return [self._weights[idx_tirp][p_id] for p_id in prefix_ids]
#         else:
#             # event-level aggregation: collect weights from all patterns
#             weights = []
#             for tirp_dict in self._weights.values():
#                 for p_id in tirp_dict:
#                     weights.append(tirp_dict[p_id])
#             return weights
#
#     def _agg_values(self, lst_prob, lst_tte, idx_tirp=None, prefix_ids=None) -> PredAtTime:
#         if not lst_prob:
#             return PredAtTime(curr_time=self.current_time, pred_prob=0, est_tte=0)
#
#         weights = self._get_weights(idx_tirp, prefix_ids)
#         total_weight = sum(weights)
#
#         pred_prob = sum(p * w for p, w in zip(lst_prob, weights)) / total_weight
#         est_tte = sum(t * w for t, w in zip(lst_tte, weights)) / total_weight
#
#         return PredAtTime(curr_time=self.current_time, pred_prob=pred_prob, est_tte=est_tte)


# -------------------------------------------------------------------------------------------------
import os
import numpy as np
import pandas as pd
from prediction.pred_at_time import PredAtTime
import const


class Aggregation:
    def __init__(self, data: dict,
                 method_name: str = "avg",
                 current_timestamp: int = 0,
                 top_percentage: float = 0.1,
                 weights_file: str | None = None,
                 names_patterns: dict | None = None):
        """
        data
            {tirp_idx: {prefix_idx: PredAtTime, …}, …}
        method_name
            one of SUPPORTED_METHODS
        top_percentage
            relevant only when method_name == "avg_top_percentage"
        weights_file
            CSV with 'TIRP_Representation' + weight columns.
            Required for *_weighted_avg methods.
        """
        if method_name not in const.SUPPORTED_METHODS:
            raise ValueError(f"{method_name=} not in {const.SUPPORTED_METHODS}")
        if method_name == "avg_top_percentage" and not (0 < top_percentage <= 1):
            raise ValueError("'top_percentage' must be in (0,1]")

        self.method_name = method_name
        self.top_pct = top_percentage
        self.current_time = current_timestamp
        self.data = data
        self.names_patterns = names_patterns

        # ---------- optional weights table ----------
        if weights_file is None:
            self.weights_df = None
        elif isinstance(weights_file, pd.DataFrame):
            self.weights_df = weights_file.copy()
        elif isinstance(weights_file, str) and os.path.exists(weights_file):
            self.weights_df = pd.read_csv(weights_file)
        else:
            raise FileNotFoundError("weights_file not found or invalid type")

        if self.weights_df is not None:
            w_col = const.WEIGHT_COL.get(method_name)
            if w_col and w_col not in self.weights_df.columns:
                raise ValueError(f"weight column '{w_col}' missing in weights DF")

        # build per-prefix weights
        self._weights: dict = {}
        self._create_weights_list()


    def aggregate_all(self):
        """
        Returns
        -------
        prediction : PredAtTime              # event-level aggregation
        patterns_prob : dict[tirp_idx] -> float
        """
        prediction          = None
        lst_prob_event, lst_tte_event = [], []
        patterns_prob       = {}
        all_prefix_ids      = []

        for idx_tirp, prefix_data in self.data.items():
            lst_prob_tirp, lst_tte_tirp, prefix_ids = [], [], []

            for idx_prefix, pred in prefix_data.items():
                lst_prob_tirp.append(pred.get_pred_prob())
                lst_tte_tirp.append(pred.get_est_tte()[0])
                lst_prob_event.append(pred.get_pred_prob())
                lst_tte_event.append(pred.get_est_tte()[0])
                prefix_ids.append(idx_prefix)
                all_prefix_ids.append((idx_tirp, idx_prefix))

            patterns_prob[idx_tirp] = self._agg_values(
                lst_prob_tirp, lst_tte_tirp, idx_tirp, prefix_ids
            ).get_pred_prob()

        flat_prefix_ids = [p for _, p in all_prefix_ids]
        prediction = self._agg_values(
            lst_prob_event, lst_tte_event, prefix_ids=flat_prefix_ids
        )
        return prediction, patterns_prob

    # ------------------------------------------------------------------
    # internal helpers
    # ------------------------------------------------------------------
    def _create_weights_list(self):
        w_col = const.WEIGHT_COL.get(self.method_name)

        for tirp_idx, tirp_data in self.data.items():
            self._weights[tirp_idx] = {}
            # default
            tirp_weight = 1.0

            if self.weights_df is not None and w_col:
                if 0 <= tirp_idx < len(self.weights_df):
                    name_pattern = self.names_patterns[tirp_idx]
                    val = self.weights_df.loc[self.weights_df["TIRP_Representation"] == name_pattern, w_col].iloc[0]
                    tirp_weight = 0 if pd.isna(val) else float(val)

            for prefix_idx in tirp_data:
                self._weights[tirp_idx][prefix_idx] = tirp_weight

    def _get_weights(self, idx_tirp=None, prefix_ids=None):
        if prefix_ids is None:
            return []
        if idx_tirp is not None:
            return [self._weights[idx_tirp][p] for p in prefix_ids]
        # event level – flatten
        return [self._weights[t][p] for t in self._weights for p in self._weights[t]]

    # ---------- core aggregation for scalars ----------
    def _aggregate_value(self, values, weights):
        if not values:
            return 0.0
        v = np.array(values, dtype=float)
        w = np.array(weights if weights else [1] * len(values), dtype=float)

        # drop NaNs while keeping alignment
        mask = ~np.isnan(v)
        v, w = v[mask], w[mask]
        if v.size == 0:
            return 0.0

        m = self.method_name
        if m in {"avg", "VS_weighted_avg", "HS_weighted_avg", "MMD_weighted_avg"}:
            if w.sum() == 0:
                return v.mean()
            return np.average(v, weights=w)
        if m == "max":
            return v.max()
        if m == "min":
            return v.min()
        if m == "avg_top_percentage":
            k = max(1, int(np.ceil(len(v) * self.top_pct)))
            return np.partition(v, -k)[-k:].mean()
        raise ValueError(f"unhandled method {m}")

    def _agg_values(self, lst_prob, lst_tte,
                    idx_tirp=None, prefix_ids=None) -> PredAtTime:
        if not lst_prob:
            return PredAtTime(self.current_time, 0, 0)

        weights = self._get_weights(idx_tirp, prefix_ids)
        pred_prob = self._aggregate_value(lst_prob, weights)
        est_tte   = self._aggregate_value(lst_tte,  weights)
        return PredAtTime(curr_time=self.current_time,
                          pred_prob=pred_prob,
                          est_tte=est_tte)