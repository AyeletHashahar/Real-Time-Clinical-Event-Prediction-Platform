import copy

import pandas as pd
import const
from core_comp.sti import STI
from core_comp.tiep import Tiep
from core_comp.tiep_series import TiepSeries
from core_comp.time_point_series import TimePointSeries
import numpy as np

class STISeries:
    """
    Lexicographical order symbolic time series
    """

    def __init__(self, stis_dict: dict = None):
        if stis_dict is None:
            self._stis: dict = {}
        else:
            self._stis: dict = copy.deepcopy(stis_dict)
        self._tieps = None
        self._time_points = None
        self._update_structures_from_stis(stis_dict=stis_dict)

        self._check_input_validity()

    def _update_structures_from_stis(self, stis_dict: dict) -> None:
        self._tieps = TiepSeries(stis_dict=self._stis)
        self._time_points = TimePointSeries(tiep_series=self._tieps)

    def get_tieps_grouped(self) -> list[list[Tiep]]:
        """
        Return a *list of lists*.

        • Outer list  — ascending by timestamp
                        (`NaN` times are treated as +∞ → last group, but excluded).

        • Inner list  — *all* TIEPs that share that timestamp.
                        Within the inner list, START ('+') precedes END ('-')
                        so a complete (A+, A‑) pair appears in natural order.
        """
        from math import isnan, inf
        from itertools import groupby

        # --- step 1: sort like before -------------------------------------
        def key(tp: Tiep):
            ts = tp.get_time()
            ts = ts if not isnan(ts) else inf
            typ = 0 if tp.is_start_type() else 1  # '+' before '-'
            return (ts, typ, tp.get_state_id())

        tieps_sorted = sorted(self._tieps.get_tiep_list(), key=key)

        # --- step 2: group by *original* timestamp ------------------------
        grouped: list[list[Tiep]] = []
        for ts, grp in groupby(tieps_sorted, key=lambda tp: tp.get_time()):
            if ts is None or isnan(ts):
                continue  # skip NaN-timestamp group
            grouped.append(list(grp))

        return grouped

    def get_stis(self):
        return self._stis

    def get_prop_id_stis_list(self, prop_id):
        sti_list = self._stis.get(prop_id, None)
        if sti_list is None:
            return None
        return len(sti_list)

    def get_prop_id_last_sti(self, prop_id):
        list_sti = self._stis.get(prop_id, None)
        if list_sti is None or len(list_sti) == 0:
            return None
        return list_sti[-1]  # return the last STI in the list

    def get_prop_id_one_before_last_sti(self, prop_id):
        list_sti = self._stis.get(prop_id, None)
        if list_sti is None or len(list_sti) < 2:
            return None
        return list_sti[-2]

    def set_stis(self, stis):
        self._update_structures_from_stis(stis_dict=stis)

    def get_number_sti_list(self) -> int:
        num = 0
        for stis_list in self._stis.values():
            num += len(stis_list)
        return num

    def get_sti_list_until_timestamp(self, time_stamp) -> dict:
        # this function returns the list of STIs until the given time stamp
        stis_dict = {}
        for property_id, stis_list in self._stis.items():
            list = []
            for sti in stis_list:
                end_time = sti.get_end_time()
                start_time = sti.get_start_time()

                if pd.notna(end_time) and end_time <= time_stamp:
                    list.append(sti)
                elif start_time <= time_stamp:
                    open_end = Tiep(time=np.nan, tiep_type=const.END_TIEP,
                                    state_id=sti.get_symbol_id(),
                                    state_inst_id=sti.get_symbol_instance_id(),
                                    property_id=sti.get_var_id())
                    list.append(STI(start_tiep=sti.get_start_tiep(), end_tiep=open_end))
                else:
                    break
            stis_dict[property_id] = list
        return stis_dict

    def get_tieps(self):
        return self._tieps

    def get_time_points(self):
        return self._time_points

    def get_last_sti(self, prop_id: int):
        last_sti = self.get_prop_id_last_sti(prop_id)
        if last_sti is not None:#and pd.isna(last_sti.get_end_time()):
            return last_sti
        return None
    def get_open_sti(self, prop_id: int):
        last_sti = self.get_prop_id_last_sti(prop_id)
        if last_sti is not None and pd.isna(last_sti.get_end_time()):
            return last_sti
        return None

    def add_open_sti(self, start_time, prop_id, state_id):
        start_tiep = Tiep(time=start_time, tiep_type=const.START_TIEP,
                          state_id=state_id, state_inst_id=1, property_id=prop_id)
        end_tiep = Tiep(time=np.nan, tiep_type=const.END_TIEP,
                        state_id=state_id, state_inst_id=1, property_id=prop_id)
        open_sti = STI(start_tiep=start_tiep, end_tiep=end_tiep)
        if self._stis.get(prop_id) is None:
            self._stis[prop_id] = []
        self._stis[prop_id].append(open_sti)
        self._update_structures_from_stis(stis_dict=self._stis)

    def get_time_points_at(self, until_time: int) -> TimePointSeries:
        # returns only time points that before the given time
        tps = self._time_points.get_time_point_series()
        time_point_series_at = TimePointSeries()
        for tp in tps:
            if tp.get_time() < until_time:
                time_point_series_at.add_time_point(time_point=tp)
        return time_point_series_at

    def is_state_in_series(self, state_id) -> bool:
        # return whether an state id is included in the series
        list_prop_id = self._stis.get(state_id, None)
        if list_prop_id is None or len(list_prop_id) == 0:
            return False
        return True


    def _check_input_validity(self):
            # this function check the validity of the input and assert in case of wrong input
            if not len(self._stis) >= 0:
                assert "The STIs list should be greater than zero!"
