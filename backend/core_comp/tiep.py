import const


class Tiep:
    """
    This class represents the time interval endpoint that comprised of time, type, state id, and the symbol instance id
    """

    def __init__(self, time: int, tiep_type: str, state_id: int, state_inst_id: int, property_id: int,
                 tiep_inst_id: int = -1, dummy: bool = False):
        """
        :param time: the time of occurrence
        :param tiep_type: starting or ending endpoint
        :param state_id: the state id
        :param state_inst_id: the occurrence index of the same tiep in the series
        :param property_id: the property id
        :param dummy: whether this object represents a dummy tiep (True) or real instances (False).
        """
        self._time: int = time
        self._tiep_type: str = tiep_type
        self._state_id: int = state_id
        self._property_id: int = property_id
        self._state_inst_id: int = state_inst_id  # each instance of this tiep should get the STI id
        self._tiep_inst_id: int = tiep_inst_id  # each instance of this tiep should get different id
        self._pair_tiep = None
        self._dummy: bool = dummy
        self._check_input_validity()

    def add_pair_tiep(self, tiep):
        self._pair_tiep: Tiep = tiep

    def get_pair_tiep(self):
        return self._pair_tiep

    def set_time(self, time):
        self._time = time


    def get_time(self) -> int:
        return self._time

    def get_tiep_type(self) -> str:
        return self._tiep_type

    def get_state_id(self) -> int:
        return self._state_id

    def get_property_id(self) -> int:
        return self._property_id

    def get_state_instance_id(self) -> int:
        return self._state_inst_id

    def get_tiep_instance_id(self) -> int:
        return self._tiep_inst_id

    def is_start_type(self) -> bool:
        # returns True if this is starting tiep
        return self._tiep_type == const.START_TIEP

    def is_end_type(self) -> bool:
        # returns True if this is ending tiep
        return self._tiep_type == const.END_TIEP

    def equals(self, other, strict: bool = False) -> bool:
        same = self._tiep_type == other.get_tiep_type() and self._state_id == other.get_state_id()
        if strict:
            same = same and self._state_inst_id == other.get_state_instance_id() and self._property_id == other.get_property_id()
        return same

    def pair_tiep_in_next_tiep(self, next_tiep) -> bool:
        for tiep in next_tiep:
            if tiep.is_end_type() and tiep.get_state_id() == self.get_state_id():
                return True
            else:
                i=0
        return False

    def is_in_next_tiep(self, next_tiep) -> bool:
        # this function checks if the current tiep is included in the next tiep
        for tiep in next_tiep:
            if self.equals(tiep):
                return True
        return False


    def _check_input_validity(self):
        # this function check the validity of the input and assert in case of wrong input
        if not self._dummy and not self._time >= 0:
            assert "The provided time should be greater than zero!"
        elif self._tiep_type not in {const.START_TIEP, const.END_TIEP}:
            assert "The provided type should be '+' or '-'!"
        elif not self._state_id >= 0:
            assert "The state id should be greater than zero!"
        elif not self._dummy and not self._property_id >= 0:
            assert "The property id should be greater than zero!"
        elif not self._state_inst_id >= 0:
            assert "The state instance id should be greater than zero!"
