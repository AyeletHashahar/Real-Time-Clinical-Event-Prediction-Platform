import json
import os

import scipy.stats as ss


SESSION_DATA = {}
# The data should contain events with symbol and property id with the same value
EVENT_INDEX = 999
TAU_EXP = [2]
W_EXP = [10]

ENTITIES_LIST = [1,283595, 2, 3, 7, 16, 103,105, 108, 235603, 200261, 200119, 200676]#[101]##[200809 ,200991, 201095, 201072, 201483, 201492] # [200021, 200795, 200035, 200061, 200072, 200094] # 200138, 200150, 200165, 200169, 200172, 200174, 200183, 200200, 200208, 200267, 200292, 200311]

# # ------------------AKI_sti1_300525------------------

# # ------------------AKI_sti1_300525------------------

# ------------------Falls------------------

DICT_SETTING = {"AKI":
                    {
                        "NUM_RELATION": [7, 7, 7],
                        "WINDOW_SIZE_PAA": [1, 1, 1],
                        "PAA_ACTION": ['mean', 'mean', 'mean'],
                        "INTERPOLATION_GAP": [1, 1, 1] ,#[10]
                        "RETROACTIVE_STATE_CLOSURE": True,
                        "MAX_GAP": [100, 100, 100],
                        "DELTA_T": [3, 3, 3],
                        "WINDOW_SIZE_DETECTION": 999,
                        "STRICT_WINDOW_DETECTION": True,
                        "THRESHOLD": [0.5, 0.5, 0.5],
                        "TIME_DELAY": [2, 2, 2],
                        "AGGREGATION_FUNCTION": ["avg", "avg", "avg"],
                        "EVENT_INDICATOR": [[[999, 6, "<", 4]], [[2000, 6, "<", 4]], [[999, 6, "<", 4]]] # "temporal_property_id": 8, "threshold": 2.5, "operator": "<", "max_gap_time_stamps": 10
                    },
                    "Falls":
                    {
                        "NUM_RELATION": [7, 7, 7],
                        "WINDOW_SIZE_PAA": [1, 1, 1],
                        "PAA_ACTION": ['mean', 'mean', 'mean'],
                        "INTERPOLATION_GAP": [1, 1, 1] ,#[10]
                        "RETROACTIVE_STATE_CLOSURE": True,
                        "MAX_GAP": [100, 100, 100],
                        "DELTA_T": [3, 3, 3],
                        "WINDOW_SIZE_DETECTION": 999,
                        "STRICT_WINDOW_DETECTION": True,
                        "THRESHOLD": [0.5, 0.5, 0.5],
                        "TIME_DELAY": [2, 2, 2],
                        "AGGREGATION_FUNCTION": ["avg", "avg", "avg"],
                        "EVENT_INDICATOR": [[[101, 0, ">", 1]], [[100, 0, ">", 1]], [[101, 0, ">", 1]]] # "temporal_property_id": 8, "threshold": 2.5, "operator": "<", "max_gap_time_stamps": 10
                    },
                "LCOS_onset":
                    {
                        "NUM_RELATION": [7, 7],
                        "WINDOW_SIZE_PAA": [1, 1],
                        "PAA_ACTION": ['mean', 'mean'],
                        "INTERPOLATION_GAP": [5, 5], #[10]
                        "RETROACTIVE_STATE_CLOSURE": True,
                        "MAX_GAP": [360, 360],
                        "DELTA_T": [3, 3],
                        "WINDOW_SIZE_DETECTION": 999,
                        "STRICT_WINDOW_DETECTION": True,
                        "THRESHOLD": [0.5, 0.5],
                        "TIME_DELAY": [2, 2],
                        "AGGREGATION_FUNCTION": ["max", "max"],
                        "EVENT_INDICATOR": [[[8, 2.5, "<", 10]], [[8, 2.5, "<", 10]]] # "temporal_property_id": 8, "threshold": 2.5, "operator": "<", "max_gap_time_stamps": 10
                    }
                    
                }

# ------------------AKI_sti1_300525------------------

# ------------------ahe_small------------------
#
# NUM_RELATION = [7, 7, 7]
#
# WINDOW_SIZE_PAA = [1, 1, 1]
# PAA_ACTION = ['mean', 'mean', 'mean']
# INTERPOLATION_GAP = [10, 10, 1]
# RETROACTIVE_STATE_CLOSURE = True
# MAX_GAP = [360, 360, 360]
# DELTA_T = [3, 3, 3]
# WINDOW_SIZE_DETECTION = 999
# STRICT_WINDOW_DETECTION = True
# THRESHOLD = [0.5, 0.5, 0.5]
# TIME_DELAY = [2, 2, 2]
# AGGREGATION_FUNCTION = ['VS_weighted_avg', 'VS_weighted_avg', 'VS_weighted_avg']
# ------------------ahe_small------------------


# Models config
with open('input/model_config.json') as f:
    MODEL_PATHS = json.load(f)
    MODEL_CONFIG = MODEL_PATHS["LCOS_onset"]  # Change to your model name if needed

LIST_PATTERNS = {}
LIST_EVENTS = {}



# Temporal relations
RELATION_MAPPING = {
    3: {'b': 0,
        'o': 1,
        'c': 2},
    7: {'b': 0,
        'm': 1,
        'o': 2,
        'f': 3,
        'c': 4,
        's': 5,
        'e': 6},
}

# Temporal relations
TEMP_REL_BEFORE = 'b'
TEMP_REL_MEETS = 'm'
TEMP_REL_CONTAINS = 'c'
TEMP_REL_EQUALS = 'e'
TEMP_REL_FINISHED_BY = 'f'
TEMP_REL_OVERLAPS = 'o'
TEMP_REL_STARTS = 's'

# Tiep
START_TIEP = '+'
END_TIEP = '-'
REL_TIEP = '<'

# STI data column names
STI_DATA_ENTITY_ID_COL_NAME = 'EntityID'
STI_DATA_TEMPORAL_PROPERTY_ID_COL_NAME = 'TemporalPropertyID'
STI_DATA_STATE_ID_COL_NAME = 'StateID'
STI_DATA_START_TIME_COL_NAME = 'StartTime'
STI_DATA_END_TIME_COL_NAME = 'EndTime'

# Patterns column names
INDEX_PATTERN_COL_NAME = 'Index'
PAT_STIS_COL_NAME = 'STIs'
PAT_TEMP_RELS_COL_NAME = 'TempRels'

# Models available
MOD_CLS_FCPM_NAME = 'fcpm_'
MOD_CLS_REG_NAME = 'reg_'

# Aggregation function
SUPPORTED_METHODS = {
        "avg", "max", "min", "avg_top_percentage",
        "VS_weighted_avg", "HS_weighted_avg", "MMD_weighted_avg"
    }
WEIGHT_COL = {
    "VS_weighted_avg":  "Vertical_Support",
    "HS_weighted_avg":  "Mean_Horizontal_Support",
    "MMD_weighted_avg": "Mean_Mean_Duration"
}

DATA_DISTRIBUTIONS = {}
LIST_MODELS_ENTITIES = {}

MOD_CLS_FCPM_PARAMS = {
    'epsilon': 1,
    'uncertainty_prob': 0.5,
    'sample_to_gen': 10000,  # Number of samples to generate
    'distributions': [ss.expon, ss.weibull_min, ss.lognorm, ss.pareto, ss.halfnorm, ss.exponweib],
    'default_dist': ss.norm,
    'default_dist_param': (0.0, 1.0)
}

# ----------------- Constants for the server -----------------
GAP_TIME_ENTITY = 999

class DatasetColumns:
    EntityID = 'EntityID'
    TemporalPropertyID = 'TemporalPropertyID'
    TimeStamp = 'TimeStamp'
    TemporalPropertyValue = 'TemporalPropertyValue'


class EntityClassRelationsColumns:
    EntityID = DatasetColumns.EntityID
    GroupID = 'GroupID'


class StatesColumns:
    EntityID = DatasetColumns.EntityID
    StateID = 'StateID'
    TemporalPropertyID = DatasetColumns.TemporalPropertyID
    Label = 'Label'
    BinID = 'BinID'
    BinLabel = 'BinLabel'
    BinLow = 'BinLow'
    BinHigh = 'BinHigh'
    Type = 'Type'
    ScientificExplanation = 'ScientificExplanation'


class STIColumns:
    EntityID = DatasetColumns.EntityID
    TemporalPropertyID = DatasetColumns.TemporalPropertyID
    StateID = StatesColumns.StateID
    StartTime = 'StartTime'
    EndTime = 'EndTime'
    LastSampleTime = 'LastSampleTime'


class TimeIntervalsColumns:
    EntityID = DatasetColumns.EntityID
    TemporalPropertyID = DatasetColumns.TemporalPropertyID
    StateID = StatesColumns.StateID
    Start = 'Start'
    End = 'End'


class SymbolicTimeSeriesColumns:
    EntityID = DatasetColumns.EntityID
    TemporalPropertyID = DatasetColumns.TemporalPropertyID
    TimeStamp = DatasetColumns.TimeStamp
    StateID = StatesColumns.StateID


class PreprocessingParamsColumns:
    TemporalPropertyID = DatasetColumns.TemporalPropertyID
    PAAWindowSize = 'PAAWindowSize'
    StdCoef = 'StdCoefficient'
    MaxGap = 'MaxGap'


class TemporalAbstractionParamsColumns:
    TemporalPropertyID = DatasetColumns.TemporalPropertyID
    Method = 'Method'
    NbBins = 'NbBins'
    GradientWindowSize = 'GradientWindowSize'


class MethodsNames:
    Gradient = 'gradient'
    KnowledgeBased = 'knowledge-based'
    SAX = 'sax'
    KMeans = 'kmeans'
    EqualWidth = 'equal-width'
    EqualFrequency = 'equal-frequency'
    TD4CKullbackLeibler = 'td4c-skl'
    TD4CEntropy = 'td4c-entropy'
    TD4CEntropyIG = 'td4c-entropy-ig'
    TD4CCosine = 'td4c-cosine'
    TD4CDiffSum = 'td4c-diffsum'
    TD4CDiffMax = 'td4c-diffmax'
    Persist = 'persist'



