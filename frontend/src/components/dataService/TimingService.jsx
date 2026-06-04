/**
 * Centralized timing service to ensure all graph components progress in perfect synchronization
 * This service manages a single source of truth for the current timestamp and notifies all 
 * subscribed components when time advances.
 */
class TimingService {
  constructor() {
    // Current timestamp in milliseconds
    this.currentTimestamp = 0;
    
    // Timestamp when data was last received from backend
    this.lastDataReceivedTimestamp = 0;
    
    // Listeners that get called when time advances
    this.timeAdvanceListeners = [];
    
    // Interval reference for tick-forward mechanism
    this.intervalId = null;
    
    // Flag to control timing updates
    this.isRunning = false;
    
    // Debug flag - can be enabled via window.enableTimingDebug = true
    this.debugEnabled = false;
  }

  /**
   * Initialize the timing service with the current timestamp
   * @param {number} timestamp - Initial timestamp in milliseconds
   */
  initialize(timestamp = 0) {
    this.currentTimestamp = timestamp;
    this.lastDataReceivedTimestamp = timestamp;
    this.startTickForward();
  }

  /**
   * Update the current timestamp when new data is received
   * @param {number} timestamp - New timestamp in milliseconds
   */
  updateTimestamp(timestamp) {
    const timestampMs = timestamp * 1000; // Convert seconds to milliseconds
    this.lastDataReceivedTimestamp = timestampMs;
    this.currentTimestamp = timestampMs;
    
    // Notify all listeners of the new timestamp
    this.notifyTimeAdvance(this.currentTimestamp);
  }

  /**
   * Get the current timestamp
   * @returns {number} Current timestamp in milliseconds
   */
  getCurrentTimestamp() {
    return this.currentTimestamp;
  }

  /**
   * Start the tick-forward mechanism that advances time even when no new data arrives
   */
  startTickForward() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    
    this.isRunning = true;
    
    this.intervalId = setInterval(() => {
      const now = this.currentTimestamp;
      
      // Only advance time if we've received data recently (within 1 second)
      if (now !== null && (now - this.lastDataReceivedTimestamp) < 1000) {
        this.currentTimestamp += 1000; // Advance by 1 second
        this.notifyTimeAdvance(this.currentTimestamp);
      } else {
        // Stop advancing if no recent data
        this.stopTickForward();
      }
    }, 1000); // Advance every second
  }

  /**
   * Stop the tick-forward mechanism
   */
  stopTickForward() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }

  /**
   * Reset the timing service (useful when switching models/entities)
   */
  reset() {
    this.stopTickForward();
    this.currentTimestamp = 0;
    this.lastDataReceivedTimestamp = 0;
    this.timeAdvanceListeners = [];
  }

  /**
   * Subscribe to time advance notifications
   * @param {Function} callback - Function to call when time advances (timestamp) => void
   * @returns {Function} Unsubscribe function
   */
  subscribeToTimeAdvance(callback) {
    this.timeAdvanceListeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.timeAdvanceListeners = this.timeAdvanceListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify all listeners that time has advanced
   * @param {number} timestamp - New timestamp in milliseconds
   */
  notifyTimeAdvance(timestamp) {
    // Check for debug flag from global window object
    this.debugEnabled = window.enableTimingDebug === true;
    
    if (this.debugEnabled) {
      console.log(`[TimingService] Time advanced to ${timestamp} (${new Date(timestamp).toISOString()}) - notifying ${this.timeAdvanceListeners.length} listeners`);
    }
    
    this.timeAdvanceListeners.forEach((callback, index) => {
      try {
        callback(timestamp);
        if (this.debugEnabled) {
          console.log(`[TimingService] Listener ${index} notified successfully`);
        }
      } catch (error) {
        console.error(`Error in time advance listener ${index}:`, error);
      }
    });
  }

  /**
   * Check if the timing service is currently running
   * @returns {boolean} True if running
   */
  isActive() {
    return this.isRunning;
  }

  /**
   * Get debug information about the timing service
   * @returns {object} Debug information
   */
  getDebugInfo() {
    return {
      currentTimestamp: this.currentTimestamp,
      lastDataReceivedTimestamp: this.lastDataReceivedTimestamp,
      isRunning: this.isRunning,
      listenerCount: this.timeAdvanceListeners.length,
      timeSinceLastData: this.currentTimestamp - this.lastDataReceivedTimestamp
    };
  }

  /**
   * Log synchronization status for debugging
   */
  logSyncStatus() {
    const info = this.getDebugInfo();
    console.log('[TimingService] Sync Status:', {
      currentTime: new Date(info.currentTimestamp).toISOString(),
      isRunning: info.isRunning,
      subscribers: info.listenerCount,
      timeSinceLastData: `${info.timeSinceLastData}ms`
    });
  }
}

export default new TimingService();
