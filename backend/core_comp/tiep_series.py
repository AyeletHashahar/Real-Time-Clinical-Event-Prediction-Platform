import math

from core_comp.sti import STI
from core_comp.tiep import Tiep


class TiepSeries:
    """
    Lexicographical order symbolic time series endpoints (tiep)
    """

    def __init__(self, stis_dict: dict):
        self._tiep_list: list[Tiep] = self._create_sorted_tiep_series(stis_dict)
        self._check_input_validity()

    def _create_sorted_tiep_series(self, stis_dict) -> list[Tiep]:
        # this function creates sorted tiep series
        tiep_list = []
        for stis_list in stis_dict.values():
            for sti in stis_list:
                tiep_list.append(sti.get_start_tiep())
                tiep_list.append(sti.get_end_tiep())

        return self._sort_tiep_list(tiep_list=tiep_list)

    @staticmethod
    def _time_or_inf(value: float) -> float:
        """Return the timestamp or +inf if the value is NaN."""
        return value if not math.isnan(value) else float("inf")

    def _rebuild(self, stis_list: list[STI]) -> None:
        """Re‑create a sorted TIEP list from the current STI list."""
        self._tiep_list = self._create_sorted_tiep_series(stis_list)

    @staticmethod
    def sort_tiep(tiep: Tiep) -> tuple:
        """
        Primary   : timestamp  (NaN → +inf, so open STIs are last)
        Secondary : tiep_type  ('+' < '-' so START comes before END)
        Tertiary  : state id  (stable order for equal time & type)
        """
        ts = TiepSeries._time_or_inf(tiep.get_time())
        ttyp = 0 if tiep.is_start_type() else 1
        return (ts, ttyp, tiep.get_state_id())

    # keep the rest of the class unchanged
    def _sort_tiep_list(self, tiep_list: list[Tiep]) -> list[Tiep]:
        return sorted(tiep_list, key=self.sort_tiep)

    def get_tiep_list(self):
        return self._tiep_list

    def _check_input_validity(self):
        # this function check the validity of the input and assert in case of wrong input
        if not len(self._tiep_list) >= 0:
            assert "The STIs list should be greater than zero!"
