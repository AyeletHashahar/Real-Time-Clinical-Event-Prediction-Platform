import portion as interval
from const import StatesColumns, MethodsNames, DatasetColumns
from utils.dataframes_generator import DataframesGenerator
import pandas as pd
import numpy as np


class StateAbstraction:
    def __init__(self, states, ncr=False):
        if states is not None:
            if not self.is_valid_states(states, ncr):
                raise Exception('ERROR: States input is invalid')
            else:
                self.__states = states
        else:
            raise Exception('ERROR: Need States input to initialize StateAbstraction class')

    def get_states(self):
        return self.__states

    def set_states(self, states):
        self.__states = states

    def discretize_properties(self, prop_df: pd.DataFrame):
        """
        The function receives raw data in timestamp tc and preforms discretization using the state abstraction method.
        It classifies the raw data into bins according to states file. This is done by matching the propertyValue of
        the propertyID to the corresponding range in the file (between binLow and binHigh) and retrieving the stateID
        (abstractedValue).

        :param prop_df: Dataframe of temporalPropertyIDs in time stamp tc. The data frame contains TemporalPropertyID,
        timestamp, and TemporalPropertyValue.
        :return: Dataframe with abstractedValue (statesID) for each temporalPropertyID. The output data frame contains
        TemporalPropertyID, Timestamp, TemporalPropertyValue, and abstractedValue (stateID).
        """
        if prop_df.empty:
            return DataframesGenerator.generate_empty_discretization_property()

            # Merge each row of prop_df with all possible states for that property
        merged = prop_df.merge(self.__states, on=DatasetColumns.TemporalPropertyID)

        # Filter rows where the value falls within the corresponding bin
        filtered = merged[
            (merged[DatasetColumns.TemporalPropertyValue] >= merged[StatesColumns.BinLow]) &
            (merged[DatasetColumns.TemporalPropertyValue] < merged[StatesColumns.BinHigh])
            ]

        # Keep only relevant columns
        result_df = filtered[[
            DatasetColumns.EntityID,
            DatasetColumns.TemporalPropertyID,
            DatasetColumns.TimeStamp,
            DatasetColumns.TemporalPropertyValue,
            StatesColumns.StateID
        ]]

        return result_df.reset_index(drop=True)

    @staticmethod
    def is_valid_states(states, allow_non_continuous_range):
        is_valid = True
        # is_valid &= states[StatesColumns.StateID].is_unique
        # for name, group in states.groupby(by=DatasetColumns.TemporalPropertyID):
        #     is_valid &= group[StatesColumns.BinID].is_unique
        #     for index, row in group.iterrows():
        #         if index < len(group.index) - 1:
        #             non_overlaps = (interval.open(group[StatesColumns.BinLow][index], group[StatesColumns.BinHigh][index]) & interval.open(
        #                 group[StatesColumns.BinLow][index + 1], group[StatesColumns.BinHigh][index + 1])).empty
        #             is_valid &= non_overlaps
        #             if not is_valid:
        #                 break
        #             if allow_non_continuous_range:
        #                 continue
        #             continuous_range = not (
        #                     interval.closed(group[StatesColumns.BinLow][index], group[StatesColumns.BinHigh][index]) & interval.closed(
        #                 group[StatesColumns.BinLow][index + 1], group[StatesColumns.BinHigh][index + 1])).empty
        #             is_valid &= continuous_range
        #             if not is_valid:
        #                 break
        return is_valid
