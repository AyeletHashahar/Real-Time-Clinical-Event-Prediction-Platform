import pandas as pd
import numpy as np
import re
import ast
from typing import Any, Dict, Mapping
import const


# ---------- Core Helpers ----------

def get_information_on_pattern(pattern_name):
    path_info = const.MODEL_CONFIG["weights_file"]
    df = pd.read_csv(path_info)
    return df.set_index("TIRP_Representation").loc[pattern_name].squeeze()

def translet_to_lable(key, pattern_info, event_label: str = "event"):
    """
    Examples
    --------
    "(1+, 2-)"        -> "(name2-) - (name1+)"
    "(3-, 4+)"        -> "(name4+) - (name3-)"
    "(5+, 5-)"        -> "(name5-) - (name5+)"
    Any non-numeric token is left as-is.
    """
    numbers, labels, _ = pattern_info
    num2label = {str(n): lbl for n, lbl in zip(numbers, labels)}

    def convert(token: str) -> str:
        m = re.fullmatch(r"\s*(\d+)\s*([+\-]?)\s*", token)
        if not m:
            return token.strip()
        num, sign = m.groups()
        label = num2label.get(num, event_label)
        return f"{label}{sign}"

    # drop the outer parentheses        "(A, B)"  →  "A, B"
    inside = key.strip()[1:-1]
    parts  = [convert(t) for t in inside.split(",")]

    # if we have exactly two parts, reverse and format as requested
    if len(parts) == 2:
        left, right = parts         # left == part-0 , right == part-1
        return f"({right}) - ({left})"

    # fallback (unchanged behaviour for 1 item or >2 items)
    translated = ", ".join(parts)
    return f"({translated})"


def combined_means(
    cls0: dict[str, list[float]],
    cls1: dict[str, list[float]],
    pattern_info,
    event_name
) -> dict[str, dict[str, float]]:
    """
    Computes the mean of combined values from two dictionaries (cls0 and cls1),
    for each key present in cls0 or cls1. Returns a nested dictionary with the
    outer_key wrapping the results (if provided), or a flat dictionary otherwise.

    Args:
        cls0 (dict[str, list[float]]): First dictionary of lists of floats.
        cls1 (dict[str, list[float]]): Second dictionary of lists of floats.
        outer_key (str, optional): If provided, wraps the result in another dictionary under this key.

    Returns:
        dict[str, dict[str, float]] or dict[str, float]: Combined mean values.
    """
    result: dict[str, float] = {}

    all_keys = set(cls0) | set(cls1)
    for key in all_keys:
        combined = cls0.get(key, []) + cls1.get(key, [])
        str_key = translet_to_lable(key, pattern_info, event_name)
        result[str_key] = round(sum(combined) / len(combined), 3) if combined else None

    return result

from typing import Dict, Mapping


def str_to_metrics_dict(raw: str, *, keep_numpy: bool = True) -> Dict[str, Dict[str, Any]]:
    raw = raw.strip()

    if keep_numpy:
        safe_globals = {"__builtins__": {}, "np": np}
        return eval(raw, safe_globals)          # type: ignore [eval-usage]

    cleaned = re.sub(r"np\.float64\(([^)]+)\)", r"\1", raw)
    return ast.literal_eval(cleaned)

def _weighted_average_metrics(class_a: Mapping[str, Mapping[str, float]],
                              class_b: Mapping[str, Mapping[str, float]],
                              w_a: float,
                              w_b: float
                              ) -> Dict[str, Dict[str, float]]:

    w_sum = w_a + w_b
    w_a /= w_sum
    w_b /= w_sum

    combined: Dict[str, Dict[str, float]] = {}
    all_keys = set(class_a) | set(class_b)

    for key in all_keys:
        rec_a = class_a.get(key, {})
        rec_b = class_b.get(key, {})

        combined[key] = {}
        for metric in set(rec_a) | set(rec_b):
            val_a = rec_a.get(metric, 0.0)
            val_b = rec_b.get(metric, 0.0)
            combined[key][metric] = val_a * w_a + val_b * w_b

    return combined

def transition_key(raw: str, pattern_info) -> str:
    if "-" not in raw:
        return raw

    n_str, rest = raw.split("-", 1)
    try:
        n = int(n_str)
    except ValueError:
        return raw

    parts = rest.split("_")
    name_parts = []
    for part in parts:
        for idx in range(0, len(pattern_info[0])):
            if int(part) == pattern_info[0][idx]:
                name_parts.append(pattern_info[1][idx])
                break
    rhs = ", ".join(name_parts[:n])  # name1, name2, …, namen
    lhs = ", ".join(name_parts[:n - 1])  # name1, name2, …, namen-1

    # probability-style string
    return f"P({rhs} | {lhs})"


def _transition_probabilities(metrics: Mapping[str, Mapping[str, float]], pattern_info
                              ) -> Dict[str, float]:
    """VS_child / VS_parent """
    ordered = sorted(metrics, key=lambda k: int(k.split('-')[0]))
    trans: Dict[str, float] = {}

    for i in range(1, len(ordered) - 1):
        prev_vs = metrics[ordered[i - 1]]["VS"]
        curr_vs = metrics[ordered[i]]["VS"]
        trans[ordered[i]] = None if prev_vs == 0 else curr_vs / prev_vs

    finel_result = {transition_key(k, pattern_info): v for k, v in trans.items()}

    return finel_result


def weighted_transition_probabilities(class_a: Dict[str, Dict[str, float]],
                                      class_b: Dict[str, Dict[str, float]],
                                      weight_a: float = 1.0,
                                      weight_b: float = 1.0,
                                        pattern_info: Dict[str, Any] = None
                                      ) -> Dict[str, float]:
    combined = _weighted_average_metrics(class_a, class_b, weight_a, weight_b)
    return _transition_probabilities(combined, pattern_info)

def format_transition_prob_key(raw_key: str, code_map: dict[str, str]) -> str:
    # raw_key = 'P(Foley.Low, RR.Low | Foley.Low)'
    inside = raw_key[2:-1]  # 'Foley.Low, RR.Low | Foley.Low'
    next_part, prev_part = [s.strip() for s in inside.split("|")]

    # פונקציה עזר שממירה 'A, B, C' → ['A','B','C'] → ['I1','I2','I3']
    def to_codes_list(s: str) -> list[str]:
        return [ code_map[x.strip()] for x in s.split(",") ]

    next_codes = to_codes_list(next_part)
    prev_codes = to_codes_list(prev_part)

    return f"P({', '.join(next_codes)} | {', '.join(prev_codes)})"

def pattern_info_dict(session_id: str, pattern_id: int, event_id: int) -> dict | None:
    """
    Build a full pattern-info dictionary **without** touching Flask request/response.

    Returns:
        dict  –  ready for jsonify / direct use
        None  –  if pattern_id not found
    """
    # --- 1. Resolve the relevant dataframes ---------------------------------
    patterns_df = const.LIST_PATTERNS
    cutoffs_df  = const.SESSION_DATA[session_id]['predict_entity'][int(event_id)].get_states_df()

    pattern_info = patterns_df.get(pattern_id)
    if pattern_info is None:
        return None

    # --- 2. Build intervals + cut-offs --------------------------------------
    inverted_map = {v: k for k, v in const.RELATION_MAPPING[7].items()}
    intervals    = []

    for i, (label, state_id) in enumerate(zip(pattern_info[1], pattern_info[0])):
        slice_df = cutoffs_df[cutoffs_df[const.StatesColumns.StateID] == state_id]
        slice_df = (
            slice_df
            .replace([np.inf, -np.inf], None)  # ∞ → None
            .where(slice_df.notna(), None)  # NaN → None
            .astype(object)  # np.float64 → python float
        )
        slice_df[const.StatesColumns.Label]  = label

        intervals.append({
            "label":     label,
            "state_id":  state_id,
            "cutoffs":   slice_df.to_dict(orient="records"),
        })

    code_map = {
        iv["label"]: f"I{idx + 1}"
        for idx, iv in enumerate(intervals)
    }

    event_name = const.LIST_EVENTS[event_id]["name"]
    code_map[event_name] = "event"

    for iv in intervals:
        iv["code"] = code_map[iv["label"]]

    relations = {}

    list_rel = [inverted_map[int(p)] for p in pattern_info[2]]
    n_intervals = len(pattern_info[0])
    k = 0

    for j in range(1, n_intervals):
        for i in range(j):
            relations[f"{i}-{j}"] = list_rel[k]
            k += 1

    # --- 3. Stats & explanations --------------------------------------------
    pattern_name = const.SESSION_DATA[session_id]['predict_entity'][int(event_id)].model_parameters.list_names_patterns[pattern_id]
    pattern_details = get_information_on_pattern(pattern_name)
    confidences     = (pattern_details["Vertical_Support"] / const.DATA_DISTRIBUTIONS[2]).round(3)

    model      = const.SESSION_DATA[session_id]['predict_entity'][int(event_id)].model_parameters
    tiep_means = combined_means(model.list_fcpm_models[pattern_id].durations_cases,
                                model.list_fcpm_models[pattern_id].durations_controls,
                                pattern_info, const.LIST_EVENTS[event_id]["name"])

    formatted_tiep = {}
    for raw_tiep, dur in tiep_means.items():
        # raw_tiep = '(AKI_st1_ig=45_mg=360+) - (SpO2.High-)'
        left, right = raw_tiep.split(" - ")
        # החליפו label בקודים
        code_left = code_map[event_name] if "AKI_" in left else code_map[left.strip("()+-")]
        code_right = code_map[right.strip("()+-")]
        sign_left = "+" if "+" in left else "-"
        sign_right = "+" if "+" in right else "-"
        formatted_key = f"({code_left}{sign_left}) - ({code_right}{sign_right})"
        formatted_tiep[formatted_key] = dur

    tiep_means = formatted_tiep

    transition_probabilities = weighted_transition_probabilities(str_to_metrics_dict(pattern_details["Prefix_Metrics_Cls0"]), str_to_metrics_dict(pattern_details["Prefix_Metrics_Cls1"]), 0.8, 0.2, pattern_info)

    formatted_transitions = {
        format_transition_prob_key(k, code_map): v
        for k, v in transition_probabilities.items()
    }
    transition_probabilities = formatted_transitions

    # scientific explanations
    var_exp       = []
    var_exp_df    = pd.read_csv(const.MODEL_CONFIG["Variable_Explanations"])
    for lbl in pattern_info[1]:
        base = lbl.split('.')[0]
        row  = var_exp_df[var_exp_df[const.StatesColumns.Label] == base].iloc[0]
        var_exp.append({
            "label":       row["FullName"],
            "type":        row[const.StatesColumns.Type],
            "explanation": row[const.StatesColumns.ScientificExplanation],
        })

    avg_dist = const.DATA_DISTRIBUTIONS[0]
    std_dist = const.DATA_DISTRIBUTIONS[1]

    state_metrics = []
    for iv in intervals:
        sid = iv["state_id"]
        state_metrics.append({
            "code": iv["code"],
            "mu": float(avg_dist.get(sid, 0)),
            "sigma": float(std_dist.get(sid, 0)),
        })

    cutoffs_table = []
    for iv in intervals:
        cf = iv["cutoffs"][0]
        low = cf["BinLow"] or None # possibly None
        high = cf["BinHigh"] or None # possibly None
        cutoffs_table.append({
            "code": iv["code"],
            "low": low if low is not None else None,
            "high": high if high is not None else None
        })

    # --- 4. Final dict -------------------------------------------------------
    return {
        "event_id": event_id,
        "pattern_id": pattern_id,
        "code_map": code_map,
        "intervals":            intervals,
        "relations":            relations,
        "event": {"name": event_name, "code": "event"},
        "state_metrics": state_metrics,
        "cutoffs":       cutoffs_table,
        "Vertical_Support":     float(pattern_details["Vertical_Support"]) / const.DATA_DISTRIBUTIONS[2],
        "Mean_Horizontal_Support": float(pattern_details["Mean_Horizontal_Support"]),
        "Mean_Mean_Duration":   float(pattern_details["Mean_Mean_Duration"]),
        "confidences":          float(confidences),
        "tieps_avg_duration":   tiep_means,
        "Variable_Explanations": var_exp,
        "transition_probabilities": transition_probabilities
    }
