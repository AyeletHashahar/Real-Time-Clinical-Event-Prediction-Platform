import pandas as pd
from const import DatasetColumns
from core_comp.sti_series import STISeries


class EntityData:
    def __init__(self, prefix_data: pd.DataFrame = None):
        """
        raw_data: save the previse raw data.
        STI_data: represent the prefix data.
        """
        self.raw_data = pd.DataFrame(columns=[DatasetColumns.EntityID, DatasetColumns.TemporalPropertyID,
                                              DatasetColumns.TimeStamp, DatasetColumns.TemporalPropertyValue])
        # for cases that we want to start the prefix data with some data
        self.STI_data = STISeries()

