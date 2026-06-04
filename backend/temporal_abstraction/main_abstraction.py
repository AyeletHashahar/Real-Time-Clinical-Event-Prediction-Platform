import pandas as pd
from const import DatasetColumns, StatesColumns, MethodsNames
from core_comp.sti_series import STISeries
from input.read_write_files import read_entity_data
from temporal_abstraction.gradient_abstraction import GradientAbstraction
from temporal_abstraction.state_abstraction import StateAbstraction


class TemporalAbstraction:
    def __init__(self, discretization_method, path_states_table, delta_T, list_interpolation_gap, retroactive_state_closure):
        self.discretization_method = discretization_method
        self.states_table = read_entity_data(path_states_table)
        self.delta_T = delta_T
        self.list_interpolation_gap = list_interpolation_gap
        self.retroactive_state_closure = retroactive_state_closure

    def discretization_data(self, current_data, raw_data):
        """
        :param method: represent which discretization method to use.
        :param state_data: state data table.
        :param current_data: the rew data of the current time stamp.
        :param delta_t: if the method is gradient, the value in how much time stamp we go back to calculate the slope,
        else is None.
        :return: tha data after discretization according to the method.
        """
        if self.discretization_method == MethodsNames.Gradient:
            if self.delta_T is None:
                raise Exception('ERROR: Delta T input is invalid')
            else:
                gradient = GradientAbstraction(self.delta_T, self.states_table)
                result = gradient.discretize_properties(current_data, raw_data)

        elif self.discretization_method == MethodsNames.KnowledgeBased:
            knowledge_based = StateAbstraction(self.states_table)
            result = knowledge_based.discretize_properties(current_data)
        return result

    def abstraction(self, current_time, new_data, entity_data, list_detection, historical_patterns):
        """
        :param new_data: represent the raw data of the entity in the current time
        :param discretization_method: discretization method
        :param state_data: state sata table.
        :param max_gap: int, the maximum gap between two samples of the same abstractedValue to be in the same STI.
        :param delta_t: if the method is gradient, the value in how much time stamp we go back to calculate the slope,
        else is None.
        :return: tha current prefix after abstraction of the new data.
        """
        discretization_data = self.discretization_data(new_data, entity_data.raw_data)
        # Save the new data in the object
        entity_data.raw_data = pd.concat([entity_data.raw_data, discretization_data], ignore_index=True)



        # Concatenate the new data to the prefix data
        entity_data.STI_data, list_detection, historical_patterns, intervals_to_fix = self.concatenate_new_states(current_time,
                                                                                                discretization_data,
                                                                                                entity_data.STI_data,
                                                                                                list_detection, historical_patterns)
        return entity_data, list_detection, historical_patterns, intervals_to_fix

    def concatenate_new_states(self, current_timestamp, discretization_data, prefix_data: STISeries, list_detection, historical_patterns):
        """
        The function receives points in timestamp tc after discretization and the prefix of the entity that is revealed
        until timestamp tc (prefix in timestamp tc-1). It concatenated the points at timestamp tc to the prefix of the
        entity. The result is the updated prefix of the entity in timestamp tc.

        There are two cases:
            1.	When the samples are continuous:
                Each STI remains unfinished until another abstractedValue appears.
                If a different abstractedValue appears:
                    •	close the previous STI with the end time of this current timestamp.
                    •	Open a new unfinished STI.
                If the new sample has the same abstractedValue, the STI remains unfinished.
            2.	When the samples are not continuous:
                Each STI remains unfinished until another abstractedValue appears or until a maximum gap passes,
                indicating a significant amount of time since the last sample with the same abstractedValue.
                If a new sample with the same abstractedValue is received, the STI remains unfinished.
                If either of the following occurs:
                    •	Another abstractedValue appears:
                        o	Close the previous STI with the end time of this current timestamp.
                        o	Open a new unfinished STI.
                    •	The maximum gap passes:
                        o	Close the unfinished STI with the end time of this current timestamp.

        :param new_states: Dataframe of point in timestamp tc after discretization. the sdata frame consists of four
                            columns: propertyID, Timestamp, TemporalPropertyValue, and abstractedValue (stateID).
        :param prefix_data: Dataframe of the prefix of the entity that is revealed until timestamp tc-1. The dataframe
                            consists of five columns: propertyID, timestamp, startTime, endTime, and LastSampleTime.
        :param max_gap: int, the maximum gap between two samples of the same abstractedValue to be in the same STI.
        :return: Dataframe, updated prefix of the entity in timestamp tc. The dataframe consists of five columns:
                propertyID, timestamp, startTime, endTime, and LastSampleTime.
        """
        intervals_to_fix = {}
        retroactively_fixed_stis = []  # List to collect all fixed STIs

        # For each propertyID in rawDataTable
        for _, raw_row in discretization_data.iterrows():
            prop_id = raw_row[DatasetColumns.TemporalPropertyID]
            timestamp = raw_row[DatasetColumns.TimeStamp]
            state_id = raw_row[StatesColumns.StateID]

            # Find existing unfinished STI for the same propertyID in prefixDataTable
            last_sti = prefix_data.get_prop_id_last_sti(prop_id)
            if last_sti is not None and last_sti.is_open_sti():
                if last_sti.get_state_id() == state_id:
                    last_sti.set_last_sample_time(timestamp)
                    continue
                else:
                    last_sti.close_sti(timestamp, self.retroactive_state_closure)
                    if self.retroactive_state_closure and last_sti.if_was_retroactive_fixes(current_timestamp):
                        intervals_to_fix[int(prop_id)] = [int(last_sti.get_end_time()), int(current_timestamp)]
                        retroactively_fixed_stis.append(last_sti)

            prefix_data.add_open_sti(current_timestamp, prop_id, state_id)

        for prop_id, lst_stis in prefix_data.get_stis().items():
            last_sti = lst_stis[-1]
            if last_sti.is_open_sti():
                last_sample_time = last_sti.get_last_sample_time()

                if not isinstance(self.list_interpolation_gap, list):
                    interpolation_gap = self.list_interpolation_gap
                else:
                    interpolation_gap = self.list_interpolation_gap[last_sti.get_property_id()]

                if (current_timestamp - last_sample_time) >= interpolation_gap:
                    last_sti.close_sti(current_timestamp, self.retroactive_state_closure)
                    if self.retroactive_state_closure and last_sti.if_was_retroactive_fixes(current_timestamp):
                        intervals_to_fix[int(prop_id)] = [int(last_sti.get_end_time()), int(current_timestamp)]
                        retroactively_fixed_stis.append(last_sti)

        # Only now apply retroactive detection update once for all affected STIs
        for sti in retroactively_fixed_stis:
            list_detection, historical_patterns = self.retroactive_update_detected_prefixes(current_timestamp, sti,
                                                                                            list_detection, prefix_data,
                                                                                            historical_patterns)

        return prefix_data, list_detection, historical_patterns, intervals_to_fix

    def retroactive_update_detected_prefixes(self, current_time, retroactive_sti, list_detection, prefix_data, historical_patterns):
        for idx_pattern, detection in list_detection.items():
            # Step 1: Only proceed if the TIRP includes this state_id
            # Get STI state_id
            sti_state_id = retroactive_sti.get_state_id()
            if sti_state_id in detection.tirp_model.get_stis():
                for detected_pattern in detection.detected_patterns:
                    # Get prefix details: list of (tiep_type, state_id, time)
                    prefix_details = detected_pattern.get_prefix_details()
                    sti_start_time = retroactive_sti.get_start_time()  # multiply if needed

                    # Check if the same state_id and time exist in the prefix
                    for idx, data in enumerate(prefix_details):
                        if data[1] == sti_state_id and data[2] == sti_start_time:
                            # Insert logic to update/reset something here
                            detected_pattern.rollback_prefix(idx, retroactive_sti.get_end_time())
                            """
                                go over the data and check i have a diffrent prefix? yes i do for exmple:
                                looking for (A b B)
                                  Before the fixes                     After the fixes
                                ----------A----------      -->       ----A----
                                         ----B----                             ----B----
                                                     tc                                 tc
                            """
                            remove = detected_pattern.advance_with_history(prefix_data)

                            if remove:
                                counter = self.get_id_by_start_time(
                                    historical_patterns["patterns"][detection.index_pattern]["existing"], detected_pattern.get_tfs()[0])
                                historical_patterns["patterns"][detection.index_pattern]["deleted"][counter] = current_time
                                detection.detected_patterns.remove(detected_pattern)

                # TODO: add logit that find if we have new instach of the patter after the prefix.

        return list_detection, historical_patterns

    def get_id_by_start_time(self, d: dict[int, int], target_time: int):
        """
        Retrieve the ID associated with a given start time from a dictionary.

        This method searches through the dictionary `d` in reverse order to find the first
        occurrence of the `target_time` and returns the corresponding ID.

        Parameters:
        d (dict[int, int]): A dictionary where keys are IDs and values are start times.
        target_time (int): The start time to search for in the dictionary.

        Returns:
        int or None: The ID associated with the `target_time` if found, otherwise None.
        """
        for id_, start_time in reversed(d.items()):  # ← walk backwards
            if start_time == target_time:
                return id_
        return None