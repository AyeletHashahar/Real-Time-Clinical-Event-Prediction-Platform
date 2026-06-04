import portion as interval
from const import StatesColumns, MethodsNames, DatasetColumns
from utils.dataframes_generator import DataframesGenerator
import pandas as pd
import numpy as np

class GradientAbstraction:
    def __init__(self, window_size, states, ncr=False):
        self.__window_size = window_size

        if states is None:
            raise Exception('ERROR: Need States input to initialize GradientAbstraction class')
        if not self.is_valid_states(states, ncr):
            raise Exception('ERROR: States input is invalid')

        self.__states = states

    def get_states(self):
        return self.__states

    def set_states(self, states):
        self.__states = states

    def calc_derivative_of_sample(self, df, sample):
        df = df[df[DatasetColumns.TemporalPropertyID] == sample[DatasetColumns.TemporalPropertyID]]
        df = df.sort_values(by=DatasetColumns.TimeStamp)

        t = sample[DatasetColumns.TimeStamp]
        samples_in_window = df[(df[DatasetColumns.TimeStamp] <= t) &
                               (df[DatasetColumns.TimeStamp] >= t - self.__window_size)]

        if len(samples_in_window) < self.__window_size:
            return None

        x = samples_in_window[DatasetColumns.TimeStamp].values
        y = samples_in_window[DatasetColumns.TemporalPropertyValue].values
        n = len(y)

        mean_x, mean_y = np.mean(x), np.mean(y)
        ss_xy = np.sum(x * y) - mean_x * sum(y) - mean_y * sum(x) + n * mean_x * mean_y
        ss_xx = np.sum(x * x) - 2 * mean_x * np.sum(x) + n * mean_x * mean_x

        if ss_xx != 0:
            b1 = ss_xy / ss_xx
            return np.degrees(np.arctan(b1))
        return None

    def discretize_properties(self, current_prop_df: pd.DataFrame, previes_prop_df: pd.DataFrame) -> pd.DataFrame:
        if current_prop_df.empty:
            return DataframesGenerator.generate_empty_discretization_property()

        results = []

        for _, row in current_prop_df.iterrows():
            prop_id = row[DatasetColumns.TemporalPropertyID]
            slope = self.calc_derivative_of_sample(previes_prop_df, row)

            if slope is None:
                continue

            # Cache the relevant states for this property
            prop_states = self.__states[self.__states[StatesColumns.TemporalPropertyID] == prop_id]
            match = prop_states[
                (prop_states[StatesColumns.BinLow] <= slope) &
                (prop_states[StatesColumns.BinHigh] > slope)
            ]

            if not match.empty:
                results.append({
                    DatasetColumns.EntityID: row[DatasetColumns.EntityID],
                    DatasetColumns.TemporalPropertyID: prop_id,
                    DatasetColumns.TimeStamp: row[DatasetColumns.TimeStamp],
                    DatasetColumns.TemporalPropertyValue: row[DatasetColumns.TemporalPropertyValue],
                    StatesColumns.StateID: match.iloc[0][StatesColumns.StateID]
                })

        return pd.DataFrame(results)

    @staticmethod
    def is_valid_states(states, allow_non_continuous_range):
        is_valid = states[StatesColumns.StateID].is_unique
        for _, group in states.groupby(DatasetColumns.TemporalPropertyID):
            is_valid &= group[StatesColumns.BinID].is_unique
            for i in range(len(group) - 1):
                low1, high1 = group.iloc[i][[StatesColumns.BinLow, StatesColumns.BinHigh]]
                low2, high2 = group.iloc[i + 1][[StatesColumns.BinLow, StatesColumns.BinHigh]]
                if not (interval.open(low1, high1) & interval.open(low2, high2)).empty:
                    return False
                if not allow_non_continuous_range:
                    if (interval.closed(low1, high1) & interval.closed(low2, high2)).empty:
                        return False
        return is_valid
