/**
 * Utility for formatting x-axis labels based on the dataset.
 * When dataset is "Falls", shows TS (timestamp index) instead of MM:SS time format.
 */

/**
 * Get the x-axis label formatter configuration for Highcharts
 * @returns {Object} Highcharts labels configuration
 */
export function getXAxisLabelsConfig() {
  // Always use a formatter that checks the dataset dynamically
  return {
    formatter: function() {
      const datasetName = sessionStorage.getItem("dataset_name");
      const isFallsDataset = datasetName === "Falls";
      
      if (isFallsDataset) {
        // For Falls dataset: show TS (timestamp index)
        const ts = Math.round(this.value / 1000);
        return `${ts}`;
      } else {
        // For other datasets: show MM:SS format
        const s = Math.round(this.value / 1000);
        const mm = String(Math.floor(s / 60)).padStart(2, "0");
        const ss = String(s % 60).padStart(2, "0");
        return `${mm}:${ss}`;
      }
    },
    style: { fontSize: "12px" }
  };
}

/**
 * Get a custom formatter function for x-axis labels (for charts using formatter directly)
 * @param {number} value - The x-axis value in milliseconds
 * @returns {string} Formatted label
 */
export function formatXAxisLabel(value) {
  const datasetName = sessionStorage.getItem("dataset_name");
  const isFallsDataset = datasetName === "Falls";

  if (isFallsDataset) {
    // For Falls dataset: show TS (timestamp index)
    const ts = Math.round(value / 1000);
    return `${ts}`;
  } else {
    // For other datasets: show MM:SS format
    const s = Math.round(value / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }
}

