import hashlib
import json

import numpy as np
from core_comp.sti import STI
from core_comp.tiep import Tiep
from core_comp.tirp import TIRP
import os
import pandas as pd
import const
from core_comp.sti_series import STISeries


def read_patterns_dataframe(patterns_df: pd.DataFrame, states_df) -> list[TIRP]:
    """
    this function read the patterns file and creates list of TIRP objects
    :param file_path: path of the file
    :return: list of TIRP objects
    """
    tirp_list = []
    for index, row in patterns_df.iterrows():
        sti_list = row[const.PAT_STIS_COL_NAME]
        rel_list = row[const.PAT_TEMP_RELS_COL_NAME]
        if len(sti_list) <= 1 or sti_list[-1] != const.EVENT_INDEX:
            # relevant only if the pattern ends with the event of interest
            continue
        else:
            tirp = TIRP(stis=sti_list, temp_rels=rel_list, states_table=states_df)
            for i in range(len(sti_list)-1):
                rel_with_event = tirp.get_temp_rel_by_sti_ids(i, len(sti_list) - 1)
                if rel_with_event not in {const.TEMP_REL_BEFORE, const.TEMP_REL_MEETS}:
                    print('Temporal relations with the event of interest must be before or meets')
                    continue
            tirp_list.append(tirp)
    return tirp_list


def read_sti_data_frame(sti_df: pd.DataFrame, entity_id) -> STISeries:
    """
    this function reads the STIs data and creates relevant objects.
    :param file_path: path of the file
    :return: STISeries: list of STI series
    """
    # sti_df = pd.read_csv(file_path, na_values=['None'])
    sti_df = sti_df[sti_df[const.STIColumns.EntityID] == entity_id]
    sti_df = sti_df.sort_values(by=[const.STIColumns.EntityID,
                                    const.STIColumns.StartTime,
                                    const.STIColumns.EndTime,
                                    const.STIColumns.StateID])

    # iterates over the series id in the dataframe
    stis_list = []
    state_inst_id = {}

    for index, row in sti_df.iterrows():
        # iterates over the rows in the dataframe
        state_id = int(row[const.STIColumns.StateID])
        temporal_property_id = int(row[const.STIColumns.TemporalPropertyID])
        start_time = int(row[const.STIColumns.StartTime])
        end_time = row[const.STIColumns.EndTime]  # Keep as float for NaN check

        if state_id not in state_inst_id:
            state_inst_id[state_id] = 1
        else:
            state_inst_id[state_id] += 1

        start_tiep = Tiep(time=start_time, tiep_type=const.START_TIEP,
                          state_id=state_id, state_inst_id=state_inst_id[state_id], property_id=temporal_property_id)

        if pd.notnull(end_time):
            end_time = int(end_time)
            end_tiep = Tiep(time=end_time, tiep_type=const.END_TIEP,
                            state_id=state_id, state_inst_id=state_inst_id[state_id], property_id=temporal_property_id)
            start_tiep.add_pair_tiep(tiep=end_tiep)
            end_tiep.add_pair_tiep(tiep=start_tiep)

            sti = STI(start_tiep=start_tiep, end_tiep=end_tiep)
        else:
            end_tiep = Tiep(time=np.nan, tiep_type=const.END_TIEP,
                            state_id=state_id, state_inst_id=state_inst_id[state_id], property_id=temporal_property_id)
            sti = STI(start_tiep=start_tiep, end_tiep=end_tiep)

        stis_list.append(sti)

        # create STI series and append to a list
    sti_series = STISeries(series_id=entity_id, stis_list=stis_list)

    return sti_series


def save_dataframe_to_csv(df, file_path):
    """
    Save the given DataFrame to a CSV file.

    Parameters:
    df (pd.DataFrame): The DataFrame to save.
    file_path (str): The path to the CSV file.
    """
    if not os.path.isfile(file_path):
        # If the file does not exist, write the DataFrame with the header
        df.to_csv(file_path, index=False)
    else:
        # If the file exists, append the DataFrame without writing the header
        df.to_csv(file_path, mode='a', header=False, index=False)


def check_series_and_get_data(file_path, entity_id, current_timestamp):
    """
    Check if there is data for the given EntityID and if the last TimeStamp is within the gap.
    If the condition is met, return the data for the EntityID.

    Parameters:
    file_path (str): The path to the CSV file.
    entity_id (int or float): The EntityID to check.
    gap (float): The maximum allowed gap for the last TimeStamp.

    Returns:
    pd.DataFrame or None: The data for the EntityID if conditions are met, else None.
    """
    try:
        # Read the CSV file
        df = pd.read_csv(file_path)

        # Filter the data for the given SeriesID
        entity_data = df[df[const.STIColumns.EntityID] == entity_id]

        if entity_data.empty:
            # print(f"No data found for SeriesID {series_id}")
            return None

        # Get the last TimeStamp for the SeriesID
        last_timestamp = entity_data[const.STIColumns.LastSampleTime].max()

        # Check if the last TimeStamp is within the gap
        if (current_timestamp - last_timestamp) <= const.GAP_TIME_ENTITY:
            return entity_data
        else:
            # print(f"The last TimeStamp for SeriesID {series_id} is beyond the gap")
            return None
    except Exception as e:
        print(f"An error occurred: {e}")
        return None


def read_entity_data(file_path):
    """
    Read the DataFrame from a CSV file and filter it by the given EntityID.

    Parameters:
    file_path (str): The path to the CSV file.
    entity_id (int or float): The EntityID to filter by.

    Returns:
    pd.DataFrame: The filtered DataFrame containing data for the given SeriesID.
    """
    try:
        # Read the CSV file into a DataFrame
        df = pd.read_csv(file_path)

        if df.empty:
            print(f"No data found")
            return None
        #TODO: change to version 1.1.5
        # filtered_df.drop(columns=['SeriesID'])
        # filtered_df = filtered_df.drop(columns=['SeriesID'])
        # ------------------------------
        return df
    except FileNotFoundError:
        print(f"File not found: {file_path}")
        return None
    except pd.errors.EmptyDataError:
        print(f"No data in file: {file_path}")
        return None
    except Exception as e:
        print(f"An error occurred: {e}")
        return None


def delete_entity_data(file_path, entity_id):
    """
    Delete data for a specific EntityID from a CSV file.

    Parameters:
    file_path (str): The path to the CSV file.
    entity_id (int or float): The EntityID to delete.

    Returns:
    bool: True if deletion was successful, False otherwise.
    """
    try:
        # Read the CSV file into a DataFrame
        df = pd.read_csv(file_path)

        # Check if there is data for the given SeriesID
        if df[df[const.DatasetColumns.EntityID] == entity_id].empty:
            print(f"No data found for SeriesID {entity_id}")
            return False

        # Remove rows where SeriesID matches the given series_id
        df_filtered = df[df[const.DatasetColumns.EntityID] != entity_id]

        # Write the updated DataFrame back to the same CSV file (overwrite the file)
        df_filtered.to_csv(file_path, index=False)

        # print(f"Data for SeriesID {series_id} has been deleted.")
        return True

    except FileNotFoundError:
        print(f"File not found: {file_path}")
        return False
    except pd.errors.EmptyDataError:
        print(f"No data in file: {file_path}")
        return False
    except Exception as e:
        print(f"An error occurred: {e}")
        return False


def sti_series_to_dataframe(sti_series: STISeries, file_path) -> None:
    """
    This function takes an STISeries object, converts it to a DataFrame, and saves it to a file.
    :param sti_series: STISeries object to be converted
    :param file_path: Path where the resulting DataFrame will be saved (CSV format)
    :return: None
    """
    # Extracting data from STISeries
    data = []
    for sti in sti_series.get_stis():
        series_id = sti_series.get_series_id()
        property_id = sti.get_property_id()
        state_id = sti.get_state_id()
        start_time = sti.get_start_time()
        end_time = sti.get_end_time() if pd.notnull(sti.get_end_time()) else None
        last_sample_time = sti.get_last_sample_time()

        # Append the extracted data as a row
        data.append([series_id, property_id, state_id, start_time, end_time, last_sample_time])

    # Create DataFrame from the extracted data
    columns = [const.STIColumns.EntityID, const.STIColumns.TemporalPropertyID, const.STIColumns.StateID,
               const.STIColumns.StartTime, const.STIColumns.EndTime, const.STIColumns.LastSampleTime]
    sti_df = pd.DataFrame(data, columns=columns)

    # Save the DataFrame to a CSV file
    sti_df.to_csv(file_path, index=False)


import os, json, hashlib
from typing import Optional, Set, List

def save_data_buffer_to_file(data_buffer, entity_id, unique_key='timestamp'):
    """
    Append only *new* frames to <historical_path>/<entity_id>.jsonl
    A "duplicate" is defined primarily by the frame timestamp.
    - If the record has 'timestamp' at top-level → use it.
    - Else, if top-level has nested dicts (e.g. '0','1',...) that each have 'timestamp'
      and all timestamps are equal → use that common timestamp.
    - Else, fall back to a canonical JSON hash.

    Returns: number of lines appended.
    """
    dir_path = const.MODEL_CONFIG["historical_path"]
    path_historical_data = dir_path + f"{entity_id}.jsonl"

    def _canonical_hash(record: dict) -> str:
        canonical = json.dumps(record, sort_keys=True, separators=(",", ":"))
        return hashlib.sha1(canonical.encode("utf-8")).hexdigest()

    def _extract_timestamp_fingerprint(record: dict) -> Optional[str]:
        """
        Try to build a timestamp-based fingerprint:
        - Direct top-level timestamp
        - Or a single, consistent timestamp across nested event dicts
        Returns a string like 'ts:20' or None if not resolvable.
        """
        # 1) top-level
        if unique_key in record:
            return f"ts:{record[unique_key]}"

        # 2) nested (e.g., {"0": {...,"timestamp":20}, "1": {...,"timestamp":20}})
        ts_values = set()
        for v in record.values():
            if isinstance(v, dict) and unique_key in v:
                ts_values.add(v[unique_key])

        if len(ts_values) == 1:
            ts = next(iter(ts_values))
            return f"ts:{ts}"

        # otherwise unknown / inconsistent
        return None

    def _fingerprint(record: dict) -> Optional[str]:
        """
        Prefer a timestamp-based key; otherwise fall back to canonical JSON hash.
        Prefix with 'ts:' or 'hash:' so we never collide the two forms.
        """
        if not isinstance(record, dict):
            return None
        ts_fp = _extract_timestamp_fingerprint(record)
        if ts_fp is not None:
            return ts_fp
        return f"hash:{_canonical_hash(record)}"

    # ---- Build set of existing fingerprints from file (if exists) ----
    existing_keys: Set[str] = set()
    if os.path.exists(path_historical_data):
        with open(path_historical_data, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    rec = json.loads(line)
                except json.JSONDecodeError:
                    continue  # ignore malformed line
                k = _fingerprint(rec)
                if k is not None:
                    existing_keys.add(k)

    # ---- Process incoming buffer; skip duplicates by fingerprint ----
    batch_seen: Set[str] = set()
    lines_to_append: List[str] = []

    for rec in data_buffer:
        if not isinstance(rec, dict):
            continue
        k = _fingerprint(rec)
        if k is None:
            continue
        if k in existing_keys or k in batch_seen:
            # duplicate: already on disk or already in this batch
            continue
        batch_seen.add(k)
        # keep original formatting (or use canonical if you prefer)
        lines_to_append.append(json.dumps(rec, ensure_ascii=False))

    if not lines_to_append:
        return 0

    # ---- Append atomically-ish ----
    with open(path_historical_data, "a", encoding="utf-8") as f:
        for ln in lines_to_append:
            f.write(ln + "\n")

    return len(lines_to_append)
