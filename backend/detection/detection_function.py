import const
from core_comp.sti_series import STISeries
from core_comp.tiep import Tiep
from core_comp.tirp import TIRP
from detection.detected_prefix import DetectedPrefix
from typing import List, Tuple, Set
from core_comp.entity_data import EntityData

class Detection:
    def __init__(self,name_pattern, index_event_pattern, index_pattern, fcpm_model, reg_model: int, tirp_model: TIRP, detected_patterns: list[DetectedPrefix], max_gap: int=999,
                 window_size_detection: int=9999, strict_window_detection: bool=False, retroactive_state_closure: bool = False):
        self.name_pattern = name_pattern
        self.index_event_pattern = index_event_pattern
        self.index_pattern = index_pattern
        self.tirp_model = tirp_model
        self.fcpm_model = fcpm_model
        self.reg_model = reg_model
        self.detected_patterns = detected_patterns
        self.max_gap = max_gap
        self.window_size_detection = window_size_detection
        self.strict_window_detection = strict_window_detection
        self.retroactive_state_closure = retroactive_state_closure
        self.idx_instance = 0


    def set_max_gap(self, max_gap):
        self.max_gap = max_gap

    def set_window_size_detection(self, windows_size_detection):
        self.window_size_detection = windows_size_detection

    def set_strict_window_detection(self, strict_window_detection):
        self.strict_window_detection = strict_window_detection

    def continuous_detection(self, current_time: int, abstraction_data: EntityData, historical_patterns) -> dict:
        """Advance all existing prefixes and create new ones if applicable."""

        # Remove prefixes that are outside the window
        if self.strict_window_detection:
            self._prune_prefixes_strict(current_time)
        else:
            self._prune_prefixes_flexible()

        # 3) Update existing prefixes first, collecting which STI events we consume
        used_tieps_this_step: dict = {}
        historical_patterns = self._update_existing_prefixes(current_time, abstraction_data, used_tieps_this_step, historical_patterns)

        # 4) Spawn new prefixes from *unused* events
        historical_patterns = self._detect_new_prefixes(current_time=current_time, abstraction_data=abstraction_data, used_tieps=used_tieps_this_step, historical_patterns=historical_patterns)

        historical_patterns = self.check_duplicates_patterns(current_time, historical_patterns)

        return historical_patterns


    # ------------------------------------------------------------------
    # Prefix‑update helpers
    # ------------------------------------------------------------------
    def _update_existing_prefixes(
            self,
            current_time: int,
            abstraction_data: EntityData,
            used_tieps: dict,
            historical_patterns: dict,
    ) -> dict:
        """Try to advance each prefix or roll it back; mark consumed STI ids."""
        to_remove = []

        # Iterate over a *copy* because we may remove items while iterating
        for idx, prefix in enumerate(self.detected_patterns[:]):
            # ------------------------------------------------------------
            # Step 1 – rollback on unexpected END‑TIEP closing an open STI
            # ------------------------------------------------------------

            next_group = prefix.get_next_tiep_to_detect()
            for open_tiep, idx_in_prefix in prefix.get_open_sti():
                if not open_tiep.pair_tiep_in_next_tiep(next_group):
                    found, _ = self._find_tiep(current_time, open_tiep, abstraction_data, const.END_TIEP)
                    if found:
                        if idx_in_prefix != 0:
                            prefix.cut_prefix(idx_in_prefix)
                        if idx_in_prefix == 0 or self._check_maxgap(current_time, prefix):
                            to_remove.append(prefix)
                        break  # stop scanning open STIs for this prefix
            if prefix in to_remove:
                continue  # prefix already dead

            # ------------------------------------------------------------
            # Step 2 – evaluate the *next_group* (all‑or‑nothing, 3 cases)
            # ------------------------------------------------------------
            found_ids: List[int] = []  # STI ids we will consume if complete
            any_found = False  # at least one tiep of the group seen?
            group_complete = True  # optimistic – turned off on first miss

            for tiep in next_group:
                found, sti_id = self._find_tiep(current_time, tiep, abstraction_data, tiep.get_tiep_type())
                if found and (sti_id not in used_tieps.get(tiep.get_property_id(),
                                                           []) or tiep.get_tiep_type() == const.END_TIEP):
                    any_found = True
                    found_ids.append(sti_id)
                else:
                    group_complete = False

            # -------- CASE 1 : complete match – advance prefix ------------
            if group_complete:
                prefix.add_duration(1)
                prefix.add_tiep(next_group, 0, current_time)
                if used_tieps.get(tiep.get_property_id(), None) is None:
                    used_tieps[tiep.get_property_id()] = []
                used_tieps[tiep.get_property_id()].append(found_ids)
                continue

            # -------- CASE 2 : partial match – rollback one state ---------
            if any_found:
                idx_in_prefix = prefix.len_prefix() - 1
                if idx_in_prefix != 0:
                    prefix.cut_prefix(idx_in_prefix)
                if idx_in_prefix == 0 or self._check_maxgap(current_time, prefix):
                    to_remove.append(prefix)
                    continue
                prefix.add_duration(1)  # gap of 1 after rollback
                continue

            # -------- CASE 3 : no match at all – just wait ----------------
            prefix.add_duration(1)
            if self._check_maxgap(current_time, prefix):
                to_remove.append(prefix)

            # If the prefix is empty, we need to remove it
            self._detect_new_prefixes(current_time=current_time, abstraction_data=abstraction_data, used_tieps=used_tieps, historical_patterns=historical_patterns, prefix=prefix)

            # Remove invalidated prefixes
        if current_time == 54 and self.index_event_pattern == 5:
            i = 0
        for prefix in to_remove:
            # if idx < len(self.detected_patterns):
            counter = prefix.get_counter()
            historical_patterns["patterns"][self.index_pattern]["deleted"][counter] = current_time
            self.detected_patterns.remove(prefix)

        return historical_patterns



    # ------------------------------------------------------------------
    # New‑prefix creation
    # ------------------------------------------------------------------

    def _detect_new_prefixes(
            self,
            current_time: int,
            abstraction_data: EntityData,
            used_tieps: dict,
            historical_patterns: dict,
            prefix: DetectedPrefix = None,
    ) -> dict:

        if prefix is None:
            tieps = self.tirp_model.get_sorted_tieps()
            tieps_group = [(0, tieps[0])]
        else:
            tieps_group = prefix.get_closed_STI()

        group_complete = True  # optimistic – turned off on first miss

        # Gather all free occurrences of the *first* group at this timestamp
        first_matches: List[Tuple[int, int]] = []  # (sti_id, start_time)
        for idx, tieps in tieps_group:
            group_complete = True  # optimistic – turned off on first miss
            for tiep in tieps:
                found, sti_id = self._find_tiep(current_time, tiep, abstraction_data, const.START_TIEP)
                if not found: #or sti_id in used_tieps:
                    group_complete = False
                    continue  # cannot start anything right now
            if group_complete:
                first_matches.append((idx, sti_id, current_time))

        # If pattern length == 1 we could start immediately, but typically
        # you only start when the first group closes; we follow the original
        # semantics and start **now** as soon as first group exists.

        # Build the initial prefix (first group only)
        if prefix is None and group_complete:
            new_prefix = DetectedPrefix(
                idx_instance=self.idx_instance,
                prefix=[tieps_group[0][1]],
                duration=[1],
                pattern=self.tirp_model,
                tfs=[current_time],
                counter=historical_patterns["counter"]
            )
            self.idx_instance += 1
            self.detected_patterns.append(new_prefix)
            counter = historical_patterns["counter"]
            historical_patterns["patterns"][self.index_pattern]["existing"][counter] = current_time
            historical_patterns["counter"] += 1
        else:
            for idx_tieps, sti_id, _ in first_matches:
                new_duration = current_time - prefix.get_tfs()[idx_tieps - 1]
                new_prefix = DetectedPrefix(
                    idx_instance=self.idx_instance,
                    prefix=prefix.get_prefix()[:idx_tieps + 1],
                    duration=prefix.get_duration()[:idx_tieps - 1] + [new_duration, 1],
                    pattern=self.tirp_model,
                    tfs=prefix.get_tfs()[:idx_tieps] + [current_time],
                    counter=historical_patterns["counter"]
                )
                self.idx_instance += 1
                self.detected_patterns.append(new_prefix)
                # used_tieps.add(sti_id)
                counter = historical_patterns["counter"]
                historical_patterns["patterns"][self.index_pattern]["existing"][counter] = current_time
                historical_patterns["counter"] += 1

        return historical_patterns

    # ------------------------------------------------------------------
    # Window / gap helpers
    # ------------------------------------------------------------------

    def check_duplicates_patterns(self, current_time, historical_patterns: dict) -> dict:
        """
        Remove every duplicate prefix (same pattern + same timestamps) **once**.
        Works even if duplicates are not adjacent and does not mutate the list
        while iterating.
        """
        to_drop = []  # indices we will delete later
        n = len(self.detected_patterns)

        # --- compare every unordered pair (i < j) ---------------------------
        for i in range(n):
            if i in to_drop:  # i already marked as duplicate
                continue
            for j in range(i + 1, n):
                if self.detected_patterns[j] in to_drop:
                    continue
                if self.detected_patterns[i].if_the_same(self.detected_patterns[j]):
                    to_drop.append(self.detected_patterns[j])


                    # mark deletion time in the history dictionary
                    # counter = self.get_id_by_start_time(
                    #     historical_patterns["patterns"][self.index_pattern]["existing"],
                    #     current_time,
                    # )
                    # del historical_patterns["patterns"][self.index_pattern]["existing"][counter]
                    # historical_patterns["counter"] -= 1

        # --- physically delete duplicates (highest index first) -------------
        for prefix in to_drop:
            counter = prefix.get_counter()
            historical_patterns["patterns"][self.index_pattern]["deleted"][counter] = current_time
            self.detected_patterns.remove(prefix)

        # no need to touch historical_patterns["counter"]:
        # its value is a *running id generator*; past ids remain valid.

        return historical_patterns

    def _prune_prefixes_strict(self, current_time: int) -> None:
        # self.detected_patterns = [
        #     p for p in self.detected_patterns
        #     if p.get_tfs()[0] > current_time - self.window_size_detection
        # ]
        pass

    def _prune_prefixes_flexible(self) -> None:
        """Placeholder – user may implement their own soft window logic."""
        pass

    def _check_maxgap(self, current_time: int, prefix: DetectedPrefix) -> bool:
        first_end = prefix.get_first_end_tiep()
        if first_end is not None and prefix.open_prefix():
            if (current_time - first_end) > self.max_gap:
                return True
        return False

    # ------------------------------------------------------------------
    # STI lookup helper that also returns the unique STI index
    # ------------------------------------------------------------------
    def _find_tiep(
            self,
            current_time: int,
            tiep: Tiep,
            abstraction_data: EntityData,
            tiep_type: int,
    ):
        """Return (found?, sti_index).  We identify an STI by its index in open_STI."""
        if tiep_type == const.END_TIEP:
            last_sti = abstraction_data.STI_data.get_last_sti(tiep.get_property_id())
        else:
            last_sti = abstraction_data.STI_data.get_open_sti(tiep.get_property_id())
        if last_sti is None:
            return False, None
        if last_sti.get_state_id() == tiep.get_state_id():
            if last_sti.is_open_sti():
                if tiep_type == const.START_TIEP and last_sti.get_start_time() == current_time:
                    return True, abstraction_data.STI_data.get_prop_id_stis_list(tiep.get_property_id())
            else:
                if tiep_type == const.END_TIEP and last_sti.get_end_time() == current_time:
                    return True, abstraction_data.STI_data.get_prop_id_stis_list(tiep.get_property_id())
        if tiep_type == const.END_TIEP:
            if last_sti.get_state_id() != tiep.get_state_id():
                one_before = abstraction_data.STI_data.get_prop_id_one_before_last_sti(tiep.get_property_id())
                if one_before.get_state_id() == tiep.get_state_id() and one_before.get_end_time() == current_time:
                    return True, (abstraction_data.STI_data.get_prop_id_stis_list(tiep.get_property_id()) - 1)

        return False, None

    # ------------------------------------------------------------------
    # Stubs for features that were not provided in the snippet
    # ------------------------------------------------------------------
    def retroactive_update_detected_prefixes(self) -> None:
        """User‑provided implementation if needed."""
        pass

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

