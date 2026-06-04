import random


class DummyModel:
    def __init__(self, name):
        self.pattern_full_name = name

    def predict_proba(self, feature_matrix, n_steps, mode):
        return round(random.uniform(0, 1), 3)
