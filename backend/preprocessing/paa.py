import numpy as np
import pandas as pd

from const import DatasetColumns


class PAA:
    """
        Given a dataset, performs Piecewise Aggregate Approximation, which is a method of lowering
        the resolution of the data in addition to reduce noise in it.
        The PAA is performed for each entity and for each property. The values in each window are accumulated,
        and the mean is calculated. Afterwards, all the accumulated values are discarded from the dataset,
        and a new row is placed at the **beginning** of the window with the mean value
    """

    def __init__(self, window_size: int = 1):
        if window_size < 1:
            raise ValueError("Window size must be >= 1")
        self.paa_window_size = window_size

    def incremental_paa(self, df_raw_data: pd.DataFrame, action: str) -> pd.DataFrame:
        """
        Apply PAA on a DataFrame grouped by entity and variable.

        Parameters:
        df_raw_data (pd.DataFrame): Raw data with time/value columns.
        action (str): Aggregation method ('mean', 'median', 'min', 'max').

        Returns:
        pd.DataFrame: Transformed data with PAA applied.
        """
        if df_raw_data.empty or self.paa_window_size == 1:
            return df_raw_data

        return self.perform_paa(df_raw_data, action)

    def perform_paa(self, df, action='mean'):
        """
        :param df: Dataframe
        :param window_size: int, the PAA window size
        :param action: str, the action to perform on the values in the window
        :return: Dataframe, the df after PAA
        """
        df = df.copy()

        # Assign timestamps to bins based on window size
        max_time = df[DatasetColumns.TimeStamp].max()
        bin_edges = np.arange(1, max_time + self.paa_window_size + 1, step=self.paa_window_size)
        df[DatasetColumns.TimeStamp] = pd.cut(
            df[DatasetColumns.TimeStamp],
            bins=bin_edges,
            include_lowest=True,
            right=False
        ).apply(lambda x: max(x.left, 0)).astype(float)

        # Aggregation function mapping
        agg_func = {
            'mean': 'mean',
            'median': 'median',
            'min': 'min',
            'max': 'max'
        }.get(action)

        if agg_func is None:
            raise ValueError(f"Unsupported PAA action: {action}")

        # Group and aggregate
        df = df.groupby(
            [DatasetColumns.EntityID, DatasetColumns.TemporalPropertyID, DatasetColumns.TimeStamp]
        )[DatasetColumns.TemporalPropertyValue].agg(agg_func).reset_index()

        # Modify the timestamp by dividing it by the window size
        if df[DatasetColumns.TimeStamp].iloc[0] != 1:
            df[DatasetColumns.TimeStamp] = np.ceil(df[DatasetColumns.TimeStamp] / self.paa_window_size)

        # re-arranging columns order
        df.columns = [
            DatasetColumns.EntityID,
            DatasetColumns.TemporalPropertyID,
            DatasetColumns.TimeStamp,
            DatasetColumns.TemporalPropertyValue
        ]

        return df
