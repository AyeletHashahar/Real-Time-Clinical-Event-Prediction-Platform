export const toServerFlag = (value) => value === true || value === 1;

export const normalizeProbability = (prediction) => {
  if (typeof prediction === 'number' && Number.isFinite(prediction)) {
    return prediction;
  }

  if (prediction && typeof prediction === 'object' && !Array.isArray(prediction)) {
    for (const key of ['prediction', 'probability', 'prob', 'value']) {
      const candidate = prediction[key];
      if (typeof candidate === 'number' && Number.isFinite(candidate)) {
        return candidate;
      }
    }
  }

  return null;
};

export const formatProbability = (probability) => {
  if (typeof probability !== 'number' || !Number.isFinite(probability)) {
    return '0.0%';
  }

  return `${(probability * 100).toFixed(1)}%`;
};
