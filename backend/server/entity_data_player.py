import pandas as pd
import os
import const
from prediction.predict_entity import PredictEntity

class EntityDataPlayer:
    def __init__(self, csv_path, entity_id=None):
        self.csv_path = csv_path
        self.entity_id = entity_id
        self.entity_data = None
        self.entity_sti_data = None
        self.max_timestamp = None

    def set_entity_id(self, entity_id):
        """Sets the entity ID and reloads the series data."""
        self.entity_id = entity_id
        self.load_series_data()

    def load_series_data(self):
        """Loads the data from the CSV file for the specified series ID."""
        if not os.path.exists(self.csv_path):
            raise FileNotFoundError(f"CSV file not found at {self.csv_path}")

        if self.entity_id is None:
            raise ValueError("Entity ID must be set before loading data.")

        df = pd.read_csv(self.csv_path)
        self.entity_data = df[df[const.DatasetColumns.EntityID] == float(self.entity_id)]
        if self.entity_data.empty:
            raise ValueError(f"No data found for SeriesID: {self.entity_id}")

        self.max_timestamp = int(self.entity_data[const.DatasetColumns.TimeStamp].max())


    def process_next_point(self, predict_entity:list[PredictEntity], timestamp_index):
        """Sends data every second, regardless of processing time, allowing the model to handle missing data."""
        if timestamp_index >= self.max_timestamp:
            return None # {"error": "No more data to process"}
        # Fetch data for the current timestamp, if any
        current_data = self.entity_data[self.entity_data[const.DatasetColumns.TimeStamp] == timestamp_index]
        current_data = current_data.to_dict(orient='records')

        # Send the data to the prediction engine, even if current_data is empty
        processed_data = {}
        for event_id in const.LIST_EVENTS.keys():
            current_pe = predict_entity[int(event_id)]
            current_pe.continuous_models(timestamp_index, current_data)
            # Store the processed data in the buffer
            processed_data[str(event_id)] = current_pe.data_to_send

        return processed_data

