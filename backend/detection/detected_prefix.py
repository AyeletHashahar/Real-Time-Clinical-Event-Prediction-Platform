import math

import pandas as pd
import const
from core_comp.sti_series import STISeries
from core_comp.tiep import Tiep
from core_comp.tirp import TIRP


class DetectedPrefix:
    def __init__(self, idx_instance, prefix: list[[Tiep]], duration: list[int], pattern: TIRP, tfs: list[int], counter: int):
        self.idx_instance = idx_instance
        self.prefix = prefix
        self.duration = duration
        self.pattern = pattern
        self.TFS = tfs
        self.counter = counter


    def get_counter(self):
        """
        Get the time when the prefix was detected
        """
        return self.counter

    def if_the_same(self, other_prefix):
        """
        Check if the prefix is the same as the given prefix
        """
        if len(self.prefix) == len(other_prefix.get_prefix()):
            other = other_prefix.get_prefix_details(1)
            if other == self.get_prefix_details(1):
                return True
        return False

    def add_tiep(self, tiep: list[Tiep], duration: int, timestamp):
        """
        Add a new tiep to the prefix and its duration to the duration list
        """
        self.prefix.append(tiep)
        self.duration.append(int(duration))
        self.TFS.append(int(timestamp))

    def add_duration(self, duration: int):
        """
        Add duration to the last element of the duration list
        """
        self.duration[-1] += duration

    def get_next_tiep_to_detect(self):
        """
        Get the next tiep to detect in the prefix list
        """
        list_tiep = self.pattern.get_sorted_tieps()
        return list_tiep[len(self.prefix)]

    def get_open_sti(self):
        """
        Get the open STI in the prefix list and return it as a list of tuples (start tiep that represent the
        open sti, index of the tiep in the prefix list)
        """
        open_sti = []
        for idx, item in enumerate(self.prefix):
            for tiep in item:
                if tiep.is_start_type():
                    open_sti.append((tiep, idx))
                if tiep.is_end_type():
                    for open_tiep in open_sti:
                        if open_tiep[0].get_state_id() == tiep.get_state_id():
                            open_sti.remove((open_tiep[0], open_tiep[1]))
        return open_sti

    def get_first_end_tiep(self):
        """
        Get the time that the first end tiep appeared in the prefix list
        """
        for idx, item in enumerate(self.prefix):
            for tiep in item:
                if tiep.is_end_type():
                    return self.TFS[idx]

    def open_prefix(self):
        """
        Check if we found all the instance of the pattern
        """
        if len(self.prefix)-1 == len(self.pattern.get_sorted_tieps())-1:
            return False
        return True

    def get_last_duration(self):
        """
        Get the last duration in the duration list
        """
        return self.duration[-1]

    def gat_index_tiep(self, tiep: list[Tiep]):
        """
        Get the index of the tiep in the prefix list
        """
        return self.prefix.index(tiep)

    def if_there_is_open_sti(self):
        """
        Check if there is an open sti in the prefix list
        """
        if len(self.get_open_sti()) > 0:
            return True
        return False

    def if_this_full_pattern(self):
        """
        Check if this prefix is a full pattern
        """
        if len(self.prefix) == (len(self.pattern.get_sorted_tieps())-2):
            return True
        return False

    def len_prefix(self):
        return len(self.prefix)

    def get_pattern(self):
        return self.pattern

    def get_prefix(self):
        return self.prefix

    def get_duration(self):
        return self.duration

    def get_tfs(self):
        return self.TFS

    def get_closed_STI(self) -> list[list["Tiep"]]:
        """
        Return the sub-lists (groups) in *prefix* whose start-TIEPs are all
        closed by a matching end-TIEP later in the prefix (skip the first group),
        BUT drop any such group if it is inside another interval that started
        earlier and ends later (i.e., fully covered).

        Examples (S='+', E='-'):
          [A+, B+, B-]                         → [B+]
          [A+, B+, C+, C-]                     → [C+]
          [A+, B+, A-, C+]                     → []
          [A+, (B+, C+), B-]                   → []
          [A+, (B+, C+), C-, B-]               → [(B+, C+)]
          [A+, (B+, C+), B-, C-]               → [(B+, C+)]
          [A+, (B+, C+), (B-, C-)]             → [(B+, C+)]
          [A+, B+, B-]                         → [B+]
          [A+, B+, B-, A-]                     → []
          [C+, A+, B+, B-, A-]                 → []
          [C+, C-, D+, D-, A+, B+, B-, A-]     → [D-]
          [A+, B+, B-, C+, C-, A-]             → []
          [A+, B+, C+, C-, (B-, A-)]             → []
        """
        prefix = self.prefix  # list[list[Tiep]]

        # 1) Map: state_id -> list of END positions
        end_positions: dict[str, list[int]] = {}
        for idx, group in enumerate(prefix):
            for tp in group:
                if tp.is_end_type():
                    end_positions.setdefault(tp.get_state_id(), []).append(idx)

        def first_end_after(sid: str, start_idx: int) -> int | None:
            """Return the first END index for sid occurring > start_idx, else None."""
            for pos in end_positions.get(sid, []):
                if pos > start_idx:
                    return pos
            return None

        # Helper: is the group at `idx` fully covered by some outer interval?
        # Covered = there exists a state_id that is open before idx (more STARTs than ENDs)
        #           AND its END is strictly after the group's own end index.
        def is_blocked(idx: int, candidate_end_idx: int) -> bool:
            open_counts: dict[str, int] = {}
            # count net opens strictly before idx
            for i in range(idx):
                for tp in prefix[i]:
                    sid = tp.get_state_id()
                    if tp.is_start_type():
                        open_counts[sid] = open_counts.get(sid, 0) + 1
                    elif tp.is_end_type():
                        if open_counts.get(sid, 0) > 0:
                            open_counts[sid] -= 1

            # any currently open sid whose next END is after the candidate group's end?
            for sid, cnt in open_counts.items():
                if cnt > 0:
                    # next end after idx
                    nxt = first_end_after(sid, idx)
                    if nxt is not None and nxt >= candidate_end_idx:
                        return True
            return False

        closed_groups: list[list["Tiep"]] = []

        # 2) Evaluate each group (skip first)
        for idx, group in enumerate(prefix):
            if idx == 0:
                continue

            # take only STARTs of this group
            starts = [tp for tp in group if tp.is_start_type()]
            if not starts:
                continue

            # each start must have an END later than idx, and we compute the group's end
            end_indices: list[int] = []
            all_closed_later = True
            for tp in starts:
                sid = tp.get_state_id()
                end_idx = first_end_after(sid, idx)
                if end_idx is None:
                    all_closed_later = False
                    break
                end_indices.append(end_idx)

            if not all_closed_later:
                continue

            # group's "end" = the latest of its constituent first-ends
            candidate_end_idx = max(end_indices)

            # NEW: drop if fully covered by an outer interval
            if is_blocked(idx, candidate_end_idx):
                continue

            closed_groups.append((idx, group))

        return closed_groups

    def create_feature_matrix(self, instance_id: int, current_time: int):
        """
        Dynamically create a feature matrix row for the current prefix and pattern.
        """
        # Initialize the row with entity info
        feature_row = {
            'instance_ID': instance_id,
            'instance_start_time': self.TFS[0],
            'current_time': current_time
        }

        # Get all TIEPs from the pattern
        list_tiep = self.pattern.get_sorted_tieps()

        # For every state (TIEP pair), construct a pattern name dynamically
        for idx_tiep in range(len(list_tiep) - 2):
            if len(list_tiep[idx_tiep]) > 1:
                for i in range(len(list_tiep[idx_tiep])-1):
                    if (len(list_tiep[idx_tiep]) - 1) - i == 1:
                        # We in the last tiep of the list
                        state_a_1 = list_tiep[idx_tiep][i].get_state_id()
                        state_a_type_1 = list_tiep[idx_tiep][i].get_tiep_type()
                        state_b_1 = list_tiep[idx_tiep][i + 1].get_state_id()
                        state_b_type_1 = list_tiep[idx_tiep][i + 1].get_tiep_type()
                        state_a_2 = list_tiep[idx_tiep][i + 1].get_state_id()
                        state_a_type_2 = list_tiep[idx_tiep][i + 1].get_tiep_type()
                        state_b_2 = list_tiep[idx_tiep + 1][0].get_state_id()
                        state_b_type_2 = list_tiep[idx_tiep + 1][0].get_tiep_type()
                    else:
                        state_a_1 = list_tiep[idx_tiep][i].get_state_id()
                        state_a_type_1 = list_tiep[idx_tiep][i].get_tiep_type()
                        state_b_1 = list_tiep[idx_tiep][i + 1].get_state_id()
                        state_b_type_1 = list_tiep[idx_tiep][i + 1].get_tiep_type()
                        state_a_2 = list_tiep[idx_tiep][i + 1].get_state_id()
                        state_a_type_2 = list_tiep[idx_tiep][i + 1].get_tiep_type()
                        state_b_2 = list_tiep[idx_tiep][i+2].get_state_id()
                        state_b_type_2 = list_tiep[idx_tiep][i+2].get_tiep_type()

                    pattern_name_m = f"({state_a_1}{state_a_type_1}, {state_b_1}{state_b_type_1})"
                    pattern_name = f"({state_a_2}{state_a_type_2}, {state_b_2}{state_b_type_2})"

                    # Add dynamic binary and duration columns initialized to 0
                    feature_row[f"{pattern_name_m}_Binary"] = 0
                    feature_row[f"{pattern_name_m}_Duration"] = 0
                    # Add dynamic binary and duration columns initialized to 0
                    feature_row[f"{pattern_name}_Binary"] = 0
                    feature_row[f"{pattern_name}_Duration"] = 0
            else:
                state_a = list_tiep[idx_tiep][0].get_state_id()
                state_a_type = list_tiep[idx_tiep][0].get_tiep_type()
                state_b = list_tiep[idx_tiep + 1][0].get_state_id()
                state_b_type = list_tiep[idx_tiep + 1][0].get_tiep_type()

                pattern_name = f"({state_a}{state_a_type}, {state_b}{state_b_type})"

                # Add dynamic binary and duration columns initialized to 0
                feature_row[f"{pattern_name}_Binary"] = 0
                feature_row[f"{pattern_name}_Duration"] = 0

            if idx_tiep < len(self.prefix):
                # If this state is in the prefix, set its duration
                feature_row[f"{pattern_name}_Binary"] = 1
                feature_row[f"{pattern_name}_Duration"] = self.duration[idx_tiep]

        return pd.DataFrame([feature_row])

    def get_prefix_str(self) -> str:
        """
        Get the prefix as a string
        """
        tiep_str = ''
        for i, tps in enumerate(self.prefix):
            if len(tps) > 1:
                tiep_str += '('
            for tp in tps:
                tiep_str += f'{tp.get_tiep_type()}{tp.get_state_id()}'
            if len(tps) > 1:
                tiep_str += ')'
            if i != len(self.prefix) - 1:
                tiep_str += const.REL_TIEP
        return tiep_str

    def cut_prefix(self, idx):
        self.prefix = self.prefix[:idx]
        self.TFS = self.TFS[:idx]
        dur = 0
        for index in range(idx, len(self.duration)):
            dur += self.duration[index]
        self.duration = self.duration[:idx]
        self.duration.append(dur+1)

    def rollback_prefix(self, idx, new_time):
        self.prefix = self.prefix[:idx+1]
        self.TFS = self.TFS[:idx+1]
        self.duration = self.duration[:idx+1]
        self.duration[-1] = new_time - self.TFS[-1]

    def get_prefix_details(self, paa_window=1):
        details = []
        for i, tieps in enumerate(self.prefix):
            for tiep in tieps:
                details.append((tiep.get_tiep_type(), tiep.get_state_id(), self.TFS[i]*paa_window))
        return details

    def check_validity(self):
        """
        Check if the prefix is valid
        """
        list_tieps = self.pattern.get_sorted_tieps()
        for idx, tieps in enumerate(self.prefix):
            for inter_idx, tiep in enumerate(tieps):
                if not tiep.equals(list_tieps[idx][inter_idx]):
                    return False
        return True

    def advance_with_history(self, prefix_data: STISeries) -> bool:
        """
        Replay historical TIEPs (after the last TIEP of this prefix) and let
        the prefix grow or roll back as needed.

        Returns
        -------
        False  – prefix is still valid
        True   – prefix became invalid and should be removed by caller
        """
        pattern_groups = self.pattern.get_sorted_tieps()
        idx_next = len(self.prefix)  # first group we still need

        if idx_next >= len(pattern_groups) - 2:  # already complete
            return False

        # timeline of events grouped by timestamp
        history = prefix_data.get_tieps_grouped()
        last_ts = self.TFS[-1]

        # ------------------------------------------------------------
        # iterate only over slices that happen *after* the last TIEP
        # ------------------------------------------------------------
        ts = self.TFS[-1]
        for slice_tieps in history:
            ts = slice_tieps[0].get_time()
            if ts <= last_ts or math.isnan(ts):
                continue

            next_group = pattern_groups[idx_next]

            # --------------------------------------------------------
            # 1)   does this slice contain the whole next_group ?
            # --------------------------------------------------------
            slice_sig = {(tp.get_state_id(), tp.get_tiep_type()) for tp in slice_tieps}
            need_sig = {(tp.get_state_id(), tp.get_tiep_type()) for tp in next_group}

            if need_sig.issubset(slice_sig):  # ✓ advance
                self.duration[-1] = ts - self.TFS[-1]
                self.add_tiep(next_group, 0, ts)
                idx_next += 1
                if idx_next >= len(pattern_groups) - 2:  # pattern completed
                    return False
                continue

            # --------------------------------------------------------
            # 2)   unexpected END – need rollback
            # --------------------------------------------------------
            open_map = {tp.get_state_id(): idx
                        for tp, idx in self.get_open_sti()}  # state_id -> idx

            for tp in slice_tieps:
                if tp.is_end_type() and tp.get_state_id() in open_map:
                    cut_at = open_map[tp.get_state_id()]

                    if cut_at == 0:  # first group – prefix invalid
                        return True

                    self.cut_prefix(cut_at)  # rollback
                    idx_next = len(self.prefix)
                    last_ts = self.TFS[-1]
                    break  # evaluate same slice again with shorter prefix

        self.duration[-1] = ts - self.TFS[-1]
        return False  # still valid