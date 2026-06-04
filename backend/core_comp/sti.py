import numpy as np

from core_comp.tiep import Tiep


class STI:
    """
    This class represents the symbolic time intervals that comprised of start and end tieps
    """

    def __init__(self, start_tiep: Tiep, end_tiep: Tiep):
        self._start_tiep: Tiep = start_tiep
        self._end_tiep: Tiep = end_tiep
        self._last_sample_time: int = self.get_start_time()
        self._check_input_validity()

    def get_start_tiep(self) -> Tiep:
        return self._start_tiep

    def get_end_tiep(self) -> Tiep:
        return self._end_tiep

    def get_start_time(self) -> int:
        return self._start_tiep.get_time()

    def get_end_time(self) -> int:
        return self._end_tiep.get_time()

    def set_end_time(self, end_time: int):
        """
        Set the end time of the STI to the provided end time and update the end tiep time accordingly
        """
        self._end_tiep.set_time(end_time)
        self._end_tiep.add_pair_tiep(self._start_tiep)
        self._start_tiep.add_pair_tiep(self._end_tiep)

    def get_last_sample_time(self) -> int:
        return self._last_sample_time

    def set_last_sample_time(self, timestamp):
        self._last_sample_time = timestamp

    def is_open_sti(self) -> bool:
        return np.isnan(self._end_tiep.get_time())

    def close_sti(self, current_time: int, retroactive_state_closure = False):
        """
        Close the STI by setting the end time of the end tiep to the current time or the last sample time + 1 if
        retroactive_state_closure is True
        """
        if retroactive_state_closure:
            self.set_end_time(self._last_sample_time+1)
        else:
            self.set_end_time(current_time)

    def get_state_id(self) -> int:
        # Both start and end tiep have the same state
        return self._start_tiep.get_state_id()

    def if_was_retroactive_fixes(self, current_time):
        """
        Check if that be a retroactive_fixes on the sti,
        Check if the current time is the same as the end tiep time.
        """
        if current_time == self._end_tiep.get_time():
            return False
        return True

    def get_property_id(self) -> int:
        # Both start and end tiep have the same property id
        return self._start_tiep.get_property_id()

    def get_state_instance_id(self) -> int:
        # Both start and end tiep have the same state instance index
        return self._start_tiep.get_state_instance_id()

    def get_sti_tuple(self):
        start_time = self.get_start_time()
        end_time = self.get_end_time()
        property_id = str(self.get_property_id())
        state_id = str(self.get_state_id())

        return (property_id, state_id, start_time, end_time)

    def _check_input_validity(self):
        # This function check the validity of the input and assert in case of wrong input
        if not self._start_tiep.is_start_type():
            assert "The provided start tiep has an incorrect type!"
        elif not self._end_tiep.is_end_type():
            assert "The provided end tiep has an incorrect type!"
        elif not self._start_tiep.get_time() < self._end_tiep.get_time():
            assert "The start tiep should start earlier to the end tiep"
        elif not self._start_tiep.get_state_id() == self._end_tiep.get_state_id():
            assert "The tieps should have the same states"
        elif not self._start_tiep.get_state_instance_id() == self._end_tiep.get_state_instance_id():
            assert "The tieps should have the same state indexes"

