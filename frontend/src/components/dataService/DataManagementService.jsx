// import API_BASE_URL from '../../config';

// class DataManagementService {
//     constructor() {
//       this.titles = {};
//       this.states = {};
//       this.patientInfo = {};
//       this.patternInfo = {};
//       this.graphCount = {};
//       this.temporalPropertyLabels = {};
//       this.temporalPropertyTypes = {};
//       this.events = null;
//       this.patterns = {};
//       this.eventPatterns = {};
//       this.stateToTemporalPropertyMap = {};
//       this.patternImportance = {};
//       this.allNormalBounds = null; 
//       this.normalBounds = {};
//     }

//     /** Return the list of temporal-property IDs that exist for this event */
//     /**  Query only the IDs list from /temporal-properties_ids  */
//     async fetchTemporalPropertyIds(eventId) {
//       if (!this.propertyIdList) this.propertyIdList = {};
//       if (this.propertyIdList[eventId] == null) {
//         const sessionId = sessionStorage.getItem("session_id");
//         try {
//           const res  = await fetch(`${API_BASE_URL}/temporal-properties_ids?session_id=${sessionId}&event_id=${eventId}`);
//           const json = await res.json();
//           this.propertyIdList[eventId] = json.success ? json.ids : [];
//         } catch (err) {
//           console.error("Cannot load IDs:", err);
//           this.propertyIdList[eventId] = [];
//         }
//       }
//       return this.propertyIdList[eventId];
//     }


//     async fetchTitle(temporalPropertyId, eventId) {
//       const cacheKey = `${eventId}-${temporalPropertyId}`;
//       if (!this.titles[cacheKey]) {
//         try {
//           const sessionId = sessionStorage.getItem('session_id');
//           const response = await fetch(`${API_BASE_URL}/title/${temporalPropertyId}?session_id=${sessionId}&event_id=${eventId}`);
//           if (!response.ok) {
//             throw new Error(`HTTP error! Status: ${response.status}`);
//           }
//           const data = await response.json();
//           this.titles[cacheKey] = data.title;
//         } catch (error) {
//           console.error('Error fetching title:', error);
//           this.titles[cacheKey] = `Property ${temporalPropertyId}`;
//         }
//       }
//       return this.titles[cacheKey];
//     }
  
//     async fetchStates(temporalPropertyId, eventId) {
//       const cacheKey = `${eventId}-${temporalPropertyId}`;
//       if (!this.states[cacheKey]) {
//         try {
//           const sessionId = sessionStorage.getItem('session_id');
//           const response = await fetch(`${API_BASE_URL}/states/${temporalPropertyId}?session_id=${sessionId}&event_id=${eventId}`);
//           if (!response.ok) {
//             throw new Error(`HTTP error! Status: ${response.status}`);
//           }
//           const data = await response.json();
//           this.states[cacheKey] = data.states;
//         } catch (error) {
//           console.error('Error fetching state labels:', error);
//           this.states[cacheKey] = [];
//         }
//       }
//       return this.states[cacheKey];
//     }

//     async fetchGraphCount(eventId) {
//       if (this.graphCount[eventId] == null) {
//         try {
//           const sessionId = sessionStorage.getItem('session_id');
//           const response = await fetch(`${API_BASE_URL}/temporal-properties-count?session_id=${sessionId}&event_id=${eventId}`);
//           if (!response.ok) {
//             throw new Error(`HTTP error! Status: ${response.status}`);
//           }
//           const data = await response.json();
//           this.graphCount[eventId] = data.count;
//         } catch (error) {
//           console.error('Error fetching graph count:', error);
//           this.graphCount[eventId] = 0;
//         }
//       }
//       return this.graphCount[eventId];
//     }

//     async fetchTemporalPropertyLabels(eventId) {
//       if (this.temporalPropertyLabels[eventId] == null) {
//         try {
//           const sessionId = sessionStorage.getItem('session_id');
//           const response = await fetch(`${API_BASE_URL}/label_temporal-properties?session_id=${sessionId}&event_id=${eventId}`);
//           if (!response.ok) {
//             throw new Error(`HTTP error! Status: ${response.status}`);
//           }
//           const data = await response.json();
//           this.temporalPropertyLabels[eventId] = data.labels;
//         } catch (error) {
//           console.error('Error fetching temporal property labels:', error);
//           this.temporalPropertyLabels[eventId] = {};
//         }
//       }
//       return this.temporalPropertyLabels[eventId];
//     }

//     async fetchAllEvents() {
//       if (this.events == null) {
//         try {
//           const sessionId = sessionStorage.getItem('session_id');
//           const response = await fetch(`${API_BASE_URL}/events?session_id=${sessionId}`);
//           if (!response.ok) {
//             throw new Error(`HTTP error! Status: ${response.status}`);
//           }
//           const data = await response.json();
//           this.events = data;
          
//           // Format events consistently
//           let eventsArray = [];
//           if (typeof data === 'object' && !Array.isArray(data)) {
//             eventsArray = Object.entries(data).map(([id, event]) => ({
//               ...event,
//               id: parseInt(id)
//             }));
//           } else if (Array.isArray(data)) {
//             eventsArray = data;
//           }
          
//          // console.log(eventsArray);
//           return eventsArray;
//         } catch (error) {
//           console.error('Error fetching events:', error);
//           this.events = {};
//           return [];
//         }
//       } else {
//         // Return formatted array from cached data
//         let eventsArray = [];
//         if (typeof this.events === 'object' && !Array.isArray(this.events)) {
//           eventsArray = Object.entries(this.events).map(([id, event]) => ({
//             ...event,
//             id: parseInt(id)
//           }));
//         } else if (Array.isArray(this.events)) {
//           eventsArray = this.events;
//         }
//         return eventsArray;
//       }
//     }

//     async fetchAllPatternsInfo() {
//       if (!Object.keys(this.patternInfo).length) {
//       try {
//         const sessionId = sessionStorage.getItem('session_id');
//           const response = await fetch(`${API_BASE_URL}/all_patterns_info?session_id=${sessionId}`);

//         if (!response.ok) {
//           throw new Error(`HTTP error! Status: ${response.status}`);
//         }

//         const data = await response.json();

//         this.patternInfo = data
//       } catch (error) {
//         console.error('Error fetching patient info:', error);
//         this.patternInfo = {};  // fallback to empty object
//         }
//       }
//       return this.patternInfo;
//     }

//     async fetchPatientInfo() {
//       if (!Object.keys(this.patientInfo).length) {
//       try {
//         const sessionId = sessionStorage.getItem('session_id');
//           const response = await fetch(`${API_BASE_URL}/demographic_data?session_id=${sessionId}`);

//         if (!response.ok) {
//           throw new Error(`HTTP error! Status: ${response.status}`);
//         }

//         const data = await response.json();

//         // Ensure response contains valid data
//         if (!data || !data.demographic_data || !Array.isArray(data.demographic_data) || data.demographic_data.length === 0) {
//           throw new Error("No patient data found.");
//         }

//         this.patientInfo = data.demographic_data[0]; // Extract first patient
//       } catch (error) {
//         console.error('Error fetching patient info:', error);
//         this.patientInfo = {};  // fallback to empty object
//         }
//       }
//       return this.patientInfo;
//     }

//     async fetchTemporalPropertyCutoffs(temporalPropertyId, eventId) {
//       try {
//         const sessionId = sessionStorage.getItem("session_id");
//         const url = `${API_BASE_URL}/temporal-properties_cutoffs?session_id=${sessionId}&temporal_property_id=${temporalPropertyId}&event_id=${eventId}`;
//         const res = await fetch(url);
//         if (!res.ok) throw new Error(`HTTP ${res.status}`);
//         const json = await res.json();

//         if (json.success && Array.isArray(json.cutoffs)) {
//           return json.cutoffs; // just return it directly
//         } else {
//           console.warn("Unexpected cutoffs format:", json);
//           return [];
//         }
//       } catch (err) {
//         console.error("Error fetching cutoffs:", err);
//         return [];
//       }
//     }



//     async fetchTemporalPropertyTypes(eventId) {
//       if (this.temporalPropertyTypes[eventId] == null) {
//         try {
//           const sessionId = sessionStorage.getItem('session_id');
//           const response = await fetch(`${API_BASE_URL}/types_temporal-properties?session_id=${sessionId}&event_id=${eventId}`);
//           if (!response.ok) {
//             throw new Error(`HTTP error! Status: ${response.status}`);
//           }
//           const data = await response.json();
//           this.temporalPropertyTypes[eventId] = data.Type;
//         } catch (error) {
//           console.error('Error fetching temporal property types:', error);
//           this.temporalPropertyTypes[eventId] = {};
//         }
//       }
//       return this.temporalPropertyTypes[eventId];
//     }

//     // New methods for centralized data fetching

//     async fetchAllPatterns(eventId) {
//       const cacheKey = eventId;
//       if (this.patterns[cacheKey] == null) {
//         try {
//           const sessionId = sessionStorage.getItem('session_id');
//           const response = await fetch(`${API_BASE_URL}/patterns?session_id=${sessionId}&event_id=${eventId}`);
//           //console.log('Im inaide fetchAllPatterns, for event id', eventId);
//           if (!response.ok) {
//             throw new Error(`HTTP error! Status: ${response.status}`);
//           }
//           const data = await response.json();
//           this.patterns[cacheKey] = data;
          
//           // Format as array for components that expect it
//           const patternsArray = Object.entries(data).map(([index, pattern]) => ({
//             index: parseInt(index),
//             patternData: pattern,
//           }));
          
//           return patternsArray;
//         } catch (error) {
//           console.error('Error fetching patterns:', error);
//           this.patterns[cacheKey] = {};
//           return [];
//         }
//       } else {
//         // Return formatted array from cached data
//         return Object.entries(this.patterns[cacheKey]).map(([index, pattern]) => ({
//           index: parseInt(index),
//           patternData: pattern,
//         }));
//       }
//     }

//     async fetchEventPatterns(eventId) {
//       if (!this.eventPatterns[eventId]) {
//         try {
//           const sessionId = sessionStorage.getItem('session_id');
//           const response = await fetch(`${API_BASE_URL}/events/${eventId}/patterns?session_id=${sessionId}`);
//           if (!response.ok) {
//             throw new Error(`HTTP error! Status: ${response.status}`);
//           }
//           const data = await response.json();
//           //console.log(`API response for event ${eventId}:`, data);
//           this.eventPatterns[eventId] = data;
          
//           // Format as array of objects for MainEventGraph
//           const patternsArray = Object.keys(data).map((patternId) => ({
//             id: parseInt(patternId, 10),
//             name: `Pattern ${patternId}`,
//           }));
          
//           return {
//             raw: data,
//             formatted: patternsArray
//           };
//         } catch (error) {
//           //console.error(`Error fetching patterns for event ${eventId}:`, error);
//           this.eventPatterns[eventId] = {};
//           return {
//             raw: {},
//             formatted: []
//           };
//         }
//       } else {
//         // Return both raw data and formatted array from cache
//         const patternsArray = Object.keys(this.eventPatterns[eventId]).map((patternId) => ({
//           id: parseInt(patternId, 10),
//           name: `Pattern ${patternId}`,
//         }));
        
//         return {
//           raw: this.eventPatterns[eventId],
//           formatted: patternsArray
//         };
//       }
//     }

//     async fetchStateToTemporalProperty(stateId, eventId) {
//       const cacheKey = `${eventId}-${stateId}`;
//       if (!this.stateToTemporalPropertyMap[cacheKey]) {
//         try {
//           const sessionId = sessionStorage.getItem('session_id');
//           const response = await fetch(`${API_BASE_URL}/stateid_to_tempprop/${stateId}?session_id=${sessionId}&event_id=${eventId}`);
//           const data = await response.json();
//           if (data.temporal_property_id) {
//             this.stateToTemporalPropertyMap[cacheKey] = data.temporal_property_id;
//           } else {
//             this.stateToTemporalPropertyMap[cacheKey] = null;
//           }
//         } catch (error) {
//           console.error(`Error fetching TemporalPropertyID for StateID ${stateId}:`, error);
//           this.stateToTemporalPropertyMap[cacheKey] = null;
//         }
//       }
//       return this.stateToTemporalPropertyMap[cacheKey];
//     }

//     async fetchRelatedTemporalPropertyIds(stateIds, eventId) {
//       const temporalPropertyIds = [];
//       for (const stateId of stateIds) {
//         const temporalPropertyId = await this.fetchStateToTemporalProperty(stateId, eventId);
//         if (temporalPropertyId !== null) {
//           temporalPropertyIds.push(temporalPropertyId);
//         }
//       }
//       return temporalPropertyIds;
//     }

//     // Method to fetch models and entities
//     async fetchEntitiesAndEvents() {
//       try {
//         const sessionId = sessionStorage.getItem("session_id");
//         const res = await fetch(`${API_BASE_URL}/available_models_and_entities`, {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({ session_id: sessionId ?? "" })
//         });

//         if (!res.ok) throw new Error(`HTTP ${res.status}`);

//         const data    = await res.json();                  // what the server sent
//         const payload = data.model_and_entities ?? data;   // unwrap if needed

//         return {
//           entities: payload.entities ?? [],
//           events:   payload.events   ?? {}
//         };
//       } catch (err) {
//         console.error("Failed to load entities/events:", err);
//         return { entities: [], events: {} };               // <-- never undefined
//       }
//     }


//     // Method to fetch current selection
//     async fetchCurrentSelection() {
//       try {
//         const sessionId = sessionStorage.getItem('session_id');
//         const response = await fetch(`${API_BASE_URL}/current_selection?session_id=${sessionId}`);
        
//         if (!response.ok) {
//           throw new Error(`Server responded with ${response.status}`);
//         }
        
//         return await response.json();
//       } catch (error) {
//         console.error('Failed to fetch current selection:', error);
//         return { entity_id: null, model_name: null };
//       }
//     }

//     // Method to select model and entity
//     // DataManagementService.js
//     async selectEntityAndEvents(entityId, listEvents) {
//       try {
//         const sessionId = sessionStorage.getItem("session_id");

//         const res = await fetch(`${API_BASE_URL}/select_entity_and_events`, {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({
//             session_id:  sessionId,
//             entity_id:   entityId,     // number
//             list_events: listEvents    // array of event-ids
//           })
//         });

//         if (!res.ok) {
//           const err = await res.json().catch(() => ({}));
//           throw new Error(err.error ?? `Server responded ${res.status}`);
//         }
//         return true;
//       } catch (err) {
//         console.error("Failed to select entity and events:", err);
//         throw err;
//       }
//     }


//     // Method to create a new session
//     async createSession() {
//       try {
//         const response = await fetch(`${API_BASE_URL}/create_session`, {
//           method: 'POST',
//         });
//         const data = await response.json();
//         sessionStorage.setItem('session_id', data.session_id);
//         console.log("Session created:", data.session_id);
//         return true;
//       } catch (error) {
//         console.error('Failed to create session:', error);
//         return false;
//       }
//     }

//     // Method to reset the model/session
//     async resetSession() {
//       try {
//         const sessionId = sessionStorage.getItem('session_id');
//         await fetch(`${API_BASE_URL}/reset_session?session_id=${sessionId}`, {
//           method: 'POST'
//         });
//         return true;
//       } catch (error) {
//         console.error('Failed to reset session:', error);
//         return false;
//       }
//     }
    
//     // Method to reset all cached data
//     resetAllData() {
//       // Reset all cached data
//       this.titles = {};
//       this.states = {};
//       this.patientInfo = {};
//       this.graphCount = {};
//       this.temporalPropertyLabels = {};
//       this.temporalPropertyTypes = {};
//       this.events = null;
//       this.patterns = {};
//       this.eventPatterns = {};
//       this.stateToTemporalPropertyMap = {};
//       this.patternImportance = {};
//       this.allNormalBounds = null;
//       this.normalBounds = {};
      
//       console.log('Reset all cached data in DataManagementService');
//     }


//     // Method to fetch all normal bounds at once
//     async fetchAllNormalBounds() {
//       if (this.allNormalBounds === null) {
//         try {
//           const sessionId = sessionStorage.getItem('session_id');
//           const response = await fetch(`${API_BASE_URL}/get_normal_bounds_for_TemporalPropertyID?session_id=${sessionId}`);
//           if (!response.ok) {
//             throw new Error(`HTTP error! Status: ${response.status}`);
//           }
//           const data = await response.json();
//           this.allNormalBounds = data;
          
//           // Also populate individual cache entries for faster subsequent access
//           Object.entries(data).forEach(([temporalPropertyId, bounds]) => {
//             this.normalBounds[temporalPropertyId] = {
//               LowNormalBound: bounds[0],
//               HighNormalBound: bounds[1]
//             };
//           });
//         } catch (error) {
//           console.error('Error fetching all normal bounds:', error);
//           this.allNormalBounds = {};
//         }
//       }
//     //  console.log('allNormalBounds', this.allNormalBounds);
//       return this.allNormalBounds;
//     }

//     // Method to fetch pattern info
//     async fetchPatternInfo(patternId, eventId) {
//       try {
//         const sessionId = sessionStorage.getItem('session_id');
//         const response = await fetch(`${API_BASE_URL}/pattern_info/${patternId}?session_id=${sessionId}&event_id=${eventId}`);
//         if (!response.ok) {
//           throw new Error(`HTTP error! Status: ${response.status}`);
//         }
//         return await response.json();
//       } catch (error) {
//         console.error('Error fetching pattern info:', error);
//         throw error;
//       }
//     }

//     /* ------------------------------------------------------------------ *
//    *  fetch only { patternId : importance } for a given event           *
//    * ------------------------------------------------------------------ */
//     async fetchPatternImportance(eventId) {
//       if (this.patternImportance[eventId] == null) {
//         try {
//           const sid = sessionStorage.getItem("session_id");
//           const res = await fetch(
//             `${API_BASE_URL}/patterns/importance?session_id=${sid}&event_id=${eventId}`
//           );
//           if (!res.ok) throw new Error(`HTTP ${res.status}`);
//           this.patternImportance[eventId] = await res.json();  // { "4":0.9, ... }
//         } catch (err) {
//           console.error("Error fetching importance:", err);
//           this.patternImportance[eventId] = {};
//         }
//       }
//       return this.patternImportance[eventId];
//     }

//     /* ------------------------------------------------------------------ *
//      *  fetch patterns **and** inject importance → [{index, patternData,  *
//      *                                              importance}]          *
//      * ------------------------------------------------------------------ */
//     async fetchPatternsWithImportance(eventId) {
//       const [patternsArr, impDict] = await Promise.all([
//         this.fetchAllPatterns(eventId),
//         this.fetchPatternImportance(eventId),
//       ]);

//       return patternsArr.map(p => ({
//         ...p,
//         importance: impDict[p.index] ?? 0,   // default 0
//       }));
//     }
  
//      // Get only the `entity_data` dict for one event (same structure across events)
//     // api/fetchEntityDataFromOneEvent.js
//     async fetchEntityDataFromOneEvent({ eventId = 0, endTime }) {
//       const sid = sessionStorage.getItem('session_id');
//       if (!sid) throw new Error('Missing session_id');
//       if (endTime == null) throw new Error('endTime is required');

//       const qs = new URLSearchParams({
//         session_id: sid,
//         end_time: String(endTime),
//         event_id: String(eventId ?? 0)
//       });

//       const res = await fetch(`${API_BASE_URL}/entity_data_from_one_event?${qs.toString()}`, {
//         headers: { Accept: 'application/json' }
//       });
//       const text = await res.text();

//       if (!res.ok) {
//         try {
//           const j = JSON.parse(text);
//           throw new Error(j?.error || `HTTP ${res.status}`);
//         } catch {
//           throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
//         }
//       }
//       try {

//         const json = JSON.parse(text);
//         if (!json || !Array.isArray(json.entity_data)) {
//           throw new Error('Bad payload shape: expected { entity_data: [] }');
//         }
//         return json.entity_data;
//       } catch {
//         throw new Error('Non-JSON response from /entity_data_from_one_event');
//       }
//     }

//     // Fetch detected patterns & probabilities for one event and end_time
//     async fetchDetectedPatternsAndProb(eventId, endTime) {
//       try {
//         const sid = sessionStorage.getItem('session_id');
//         if (!sid) throw new Error('Missing session_id');

//         const qs = new URLSearchParams({
//           session_id: sid,
//           event_id: String(eventId ?? 0),
//           end_time: String(endTime ?? 0),
//         });

//         const res = await fetch(`${API_BASE_URL}/detected_patterns_and_prob?${qs.toString()}`, {
//           headers: { Accept: 'application/json' }
//         });

//         if (!res.ok) {
//           const txt = await res.text();
//           // Try to pass through server error message if any
//           try { const j = JSON.parse(txt); throw new Error(j.error || `HTTP ${res.status}`); }
//           catch { throw new Error(`HTTP ${res.status}: ${txt.slice(0, 120)}`); }
//         }

//         const json = await res.json();
//         // Expected: { detected_patters: [...], patterns_prob: { "0": 0.26 }, event_prob: 0.x, TTE_event: N }
//         return {
//           detected_patters: Array.isArray(json.detected_patters) ? json.detected_patters : [],
//           patterns_prob: (json.patterns_prob && typeof json.patterns_prob === 'object') ? json.patterns_prob : {},
//           event_prob: typeof json.event_prob === 'number' ? json.event_prob : 0,
//           TTE_event: typeof json.TTE_event === 'number' ? json.TTE_event : 0,
//         };
//       } catch (err) {
//         console.error('Error fetching detected patterns & prob:', err);
//         return { detected_patters: [], patterns_prob: {}, event_prob: 0, TTE_event: 0 };
//       }
//     }

//     async fetchEventProbability(eventId, endTime) {
//       const payload = await this.fetchDetectedPatternsAndProb(eventId, endTime);
//       return (typeof payload.event_prob === "number" && isFinite(payload.event_prob)) ? payload.event_prob : 0;
//     }

//     // Convenience: return probability (0..1) for a specific pattern index
//     async fetchPatternProbability(eventId, endTime, patternIndex) {
//       const payload = await this.fetchDetectedPatternsAndProb(eventId, endTime);
//       const key = String(patternIndex);
//       const p = payload.patterns_prob?.[key];
//       return (typeof p === 'number' && isFinite(p)) ? p : 0;
//     }



//     async getCurrentTime() {
//       const sessionId = sessionStorage.getItem('session_id');

//       const res = await fetch(`${API_BASE_URL}/get_current_time?session_id=${sessionId}`);
//       if (!res.ok) {
//         const err = await res.json().catch(() => ({}));
//         throw new Error(err.error || 'Failed to load current time');
//       }
//       return res.json(); // { event_id, entity_data }
//     }
  
//   }

  


  
//   export default new DataManagementService();

import API_BASE_URL from '../../config';

class DataManagementService {
    constructor() {
      this.titles = {};
      this.states = {};
      this.patientInfo = {};
      this.patternInfo = {};
      this.graphCount = {};
      this.temporalPropertyLabels = {};
      this.temporalPropertyTypes = {};
      this.events = null;
      this.patterns = {};
      this.eventPatterns = {};
      this.stateToTemporalPropertyMap = {};
      this.patternImportance = {};
      this.allNormalBounds = null; 
      this.normalBounds = {};
    }

    /** Return the list of temporal-property IDs that exist for this event */
    /**  Query only the IDs list from /temporal-properties_ids  */
    async fetchTemporalPropertyIds(eventId) {
      if (!this.propertyIdList) this.propertyIdList = {};
      if (this.propertyIdList[eventId] == null) {
        const sessionId = sessionStorage.getItem("session_id");
        try {
          const res  = await fetch(`${API_BASE_URL}/temporal-properties_ids?session_id=${sessionId}&event_id=${eventId}`);
          const json = await res.json();
          this.propertyIdList[eventId] = json.success ? json.ids : [];
        } catch (err) {
          console.error("Cannot load IDs:", err);
          this.propertyIdList[eventId] = [];
        }
      }
      return this.propertyIdList[eventId];
    }


    async fetchTitle(temporalPropertyId, eventId) {
      const cacheKey = `${eventId}-${temporalPropertyId}`;
      if (!this.titles[cacheKey]) {
        try {
          const sessionId = sessionStorage.getItem('session_id');
          const response = await fetch(`${API_BASE_URL}/title/${temporalPropertyId}?session_id=${sessionId}&event_id=${eventId}`);
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          const data = await response.json();
          this.titles[cacheKey] = data.title;
        } catch (error) {
          console.error('Error fetching title:', error);
          this.titles[cacheKey] = `Property ${temporalPropertyId}`;
        }
      }
      return this.titles[cacheKey];
    }
  
    async fetchStates(temporalPropertyId, eventId) {
      const cacheKey = `${eventId}-${temporalPropertyId}`;
      if (!this.states[cacheKey]) {
        try {
          const sessionId = sessionStorage.getItem('session_id');
          const response = await fetch(`${API_BASE_URL}/states/${temporalPropertyId}?session_id=${sessionId}&event_id=${eventId}`);
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          const data = await response.json();
          this.states[cacheKey] = data.states;
        } catch (error) {
          console.error('Error fetching state labels:', error);
          this.states[cacheKey] = [];
        }
      }
      return this.states[cacheKey];
    }

    async fetchGraphCount(eventId) {
      if (this.graphCount[eventId] == null) {
        try {
          const sessionId = sessionStorage.getItem('session_id');
          const response = await fetch(`${API_BASE_URL}/temporal-properties-count?session_id=${sessionId}&event_id=${eventId}`);
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          const data = await response.json();
          this.graphCount[eventId] = data.count;
        } catch (error) {
          console.error('Error fetching graph count:', error);
          this.graphCount[eventId] = 0;
        }
      }
      return this.graphCount[eventId];
    }

    async fetchTemporalPropertyLabels(eventId) {
      if (this.temporalPropertyLabels[eventId] == null) {
        try {
          const sessionId = sessionStorage.getItem('session_id');
          const response = await fetch(`${API_BASE_URL}/label_temporal-properties?session_id=${sessionId}&event_id=${eventId}`);
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          const data = await response.json();
          this.temporalPropertyLabels[eventId] = data.labels;
        } catch (error) {
          console.error('Error fetching temporal property labels:', error);
          this.temporalPropertyLabels[eventId] = {};
        }
      }
      return this.temporalPropertyLabels[eventId];
    }

    async fetchAllEvents() {
      if (this.events == null) {
        try {
          const sessionId = sessionStorage.getItem('session_id');
          const response = await fetch(`${API_BASE_URL}/events?session_id=${sessionId}`);
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          const data = await response.json();
          this.events = data;
          
          // Format events consistently
          let eventsArray = [];
          if (typeof data === 'object' && !Array.isArray(data)) {
            eventsArray = Object.entries(data).map(([id, event]) => ({
              ...event,
              id: parseInt(id)
            }));
          } else if (Array.isArray(data)) {
            eventsArray = data;
          }
          
         // console.log(eventsArray);
          return eventsArray;
        } catch (error) {
          console.error('Error fetching events:', error);
          this.events = {};
          return [];
        }
      } else {
        // Return formatted array from cached data
        let eventsArray = [];
        if (typeof this.events === 'object' && !Array.isArray(this.events)) {
          eventsArray = Object.entries(this.events).map(([id, event]) => ({
            ...event,
            id: parseInt(id)
          }));
        } else if (Array.isArray(this.events)) {
          eventsArray = this.events;
        }
        return eventsArray;
      }
    }

    async fetchAllPatternsInfo() {
      if (!Object.keys(this.patternInfo).length) {
      try {
        const sessionId = sessionStorage.getItem('session_id');
          const response = await fetch(`${API_BASE_URL}/all_patterns_info?session_id=${sessionId}`);

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        this.patternInfo = data
      } catch (error) {
        console.error('Error fetching patient info:', error);
        this.patternInfo = {};  // fallback to empty object
        }
      }
      return this.patternInfo;
    }

    async fetchPatientInfo() {
      if (!Object.keys(this.patientInfo).length) {
      try {
        const sessionId = sessionStorage.getItem('session_id');
          const response = await fetch(`${API_BASE_URL}/demographic_data?session_id=${sessionId}`);

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        // Ensure response contains valid data
        if (!data || !data.demographic_data || !Array.isArray(data.demographic_data) || data.demographic_data.length === 0) {
          throw new Error("No patient data found.");
        }

        this.patientInfo = data.demographic_data[0]; // Extract first patient
      } catch (error) {
        console.error('Error fetching patient info:', error);
        this.patientInfo = {};  // fallback to empty object
        }
      }
      return this.patientInfo;
    }

    async fetchTemporalPropertyCutoffs(temporalPropertyId, eventId) {
      try {
        const sessionId = sessionStorage.getItem("session_id");
        const url = `${API_BASE_URL}/temporal-properties_cutoffs?session_id=${sessionId}&temporal_property_id=${temporalPropertyId}&event_id=${eventId}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        if (json.success && Array.isArray(json.cutoffs)) {
          console.log("cutoffs", json.cutoffs);
          return json.cutoffs; // just return it directly
        } else {
          console.warn("Unexpected cutoffs format:", json);
          return [];
        }
      } catch (err) {
        console.error("Error fetching cutoffs:", err);
        return [];
      }
    }



    async fetchTemporalPropertyTypes(eventId) {
      if (this.temporalPropertyTypes[eventId] == null) {
        try {
          const sessionId = sessionStorage.getItem('session_id');
          const response = await fetch(`${API_BASE_URL}/types_temporal-properties?session_id=${sessionId}&event_id=${eventId}`);
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          const data = await response.json();
          this.temporalPropertyTypes[eventId] = data.Type;
        } catch (error) {
          console.error('Error fetching temporal property types:', error);
          this.temporalPropertyTypes[eventId] = {};
        }
      }
      return this.temporalPropertyTypes[eventId];
    }

    // New methods for centralized data fetching

    async fetchAllPatterns(eventId) {
      const cacheKey = eventId;
      if (this.patterns[cacheKey] == null) {
        try {
          const sessionId = sessionStorage.getItem('session_id');
          const response = await fetch(`${API_BASE_URL}/patterns?session_id=${sessionId}&event_id=${eventId}`);
          //console.log('Im inaide fetchAllPatterns, for event id', eventId);
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          const data = await response.json();
          this.patterns[cacheKey] = data;
          
          // Format as array for components that expect it
          const patternsArray = Object.entries(data).map(([index, pattern]) => ({
            index: parseInt(index),
            patternData: pattern,
          }));
          
          return patternsArray;
        } catch (error) {
          console.error('Error fetching patterns:', error);
          this.patterns[cacheKey] = {};
          return [];
        }
      } else {
        // Return formatted array from cached data
        return Object.entries(this.patterns[cacheKey]).map(([index, pattern]) => ({
          index: parseInt(index),
          patternData: pattern,
        }));
      }
    }

    async fetchEventPatterns(eventId) {
      if (!this.eventPatterns[eventId]) {
        try {
          const sessionId = sessionStorage.getItem('session_id');
          const response = await fetch(`${API_BASE_URL}/events/${eventId}/patterns?session_id=${sessionId}`);
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          const data = await response.json();
          //console.log(`API response for event ${eventId}:`, data);
          this.eventPatterns[eventId] = data;
          
          // Format as array of objects for MainEventGraph
          const patternsArray = Object.keys(data).map((patternId) => ({
            id: parseInt(patternId, 10),
            name: `Pattern ${patternId}`,
          }));
          
          return {
            raw: data,
            formatted: patternsArray
          };
        } catch (error) {
          //console.error(`Error fetching patterns for event ${eventId}:`, error);
          this.eventPatterns[eventId] = {};
          return {
            raw: {},
            formatted: []
          };
        }
      } else {
        // Return both raw data and formatted array from cache
        const patternsArray = Object.keys(this.eventPatterns[eventId]).map((patternId) => ({
          id: parseInt(patternId, 10),
          name: `Pattern ${patternId}`,
        }));
        
        return {
          raw: this.eventPatterns[eventId],
          formatted: patternsArray
        };
      }
    }

    async fetchStateToTemporalProperty(stateId, eventId) {
      const cacheKey = `${eventId}-${stateId}`;
      if (!this.stateToTemporalPropertyMap[cacheKey]) {
        try {
          const sessionId = sessionStorage.getItem('session_id');
          const response = await fetch(`${API_BASE_URL}/stateid_to_tempprop/${stateId}?session_id=${sessionId}&event_id=${eventId}`);
          const data = await response.json();
          if (data.temporal_property_id) {
            this.stateToTemporalPropertyMap[cacheKey] = data.temporal_property_id;
          } else {
            this.stateToTemporalPropertyMap[cacheKey] = null;
          }
        } catch (error) {
          console.error(`Error fetching TemporalPropertyID for StateID ${stateId}:`, error);
          this.stateToTemporalPropertyMap[cacheKey] = null;
        }
      }
      return this.stateToTemporalPropertyMap[cacheKey];
    }

    async fetchRelatedTemporalPropertyIds(stateIds, eventId) {
      const temporalPropertyIds = [];
      for (const stateId of stateIds) {
        const temporalPropertyId = await this.fetchStateToTemporalProperty(stateId, eventId);
        if (temporalPropertyId !== null) {
          temporalPropertyIds.push(temporalPropertyId);
        }
      }
      return temporalPropertyIds;
    }

    // Method to fetch models and entities
    async fetchEntitiesAndEvents() {
      try {
        const sessionId = sessionStorage.getItem("session_id");
        const res = await fetch(`${API_BASE_URL}/available_models_and_entities`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId ?? "" })
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data    = await res.json();                  // what the server sent
        const payload = data.model_and_entities ?? data;   // unwrap if needed

        return {
          entities: payload.entities ?? [],
          events:   payload.events   ?? {}
        };
      } catch (err) {
        console.error("Failed to load entities/events:", err);
        return { entities: [], events: {} };               // <-- never undefined
      }
    }


    // Method to fetch current selection
    async fetchCurrentSelection() {
      try {
        const sessionId = sessionStorage.getItem('session_id');
        const response = await fetch(`${API_BASE_URL}/current_selection?session_id=${sessionId}`);
        
        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error('Failed to fetch current selection:', error);
        return { entity_id: null, model_name: null };
      }
    }

    // Method to select model and entity
    // DataManagementService.js
    async selectEntityAndEvents(entityId, listEvents) {
      try {
        const sessionId = sessionStorage.getItem("session_id");

        const res = await fetch(`${API_BASE_URL}/select_entity_and_events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id:  sessionId,
            entity_id:   entityId,     // number
            list_events: listEvents    // array of event-ids
          })
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? `Server responded ${res.status}`);
        }
        return true;
      } catch (err) {
        console.error("Failed to select entity and events:", err);
        throw err;
      }
    }


    // Method to create a new session
    async createSession() {
      try {
        const response = await fetch(`${API_BASE_URL}/create_session`, {
          method: 'POST',
        });
        const data = await response.json();
        sessionStorage.setItem('session_id', data.session_id);
        console.log("Session created:", data.session_id);
        return true;
      } catch (error) {
        console.error('Failed to create session:', error);
        return false;
      }
    }

    // Method to reset the model/session
    async resetSession() {
      try {
        const sessionId = sessionStorage.getItem('session_id');
        await fetch(`${API_BASE_URL}/reset_session?session_id=${sessionId}`, {
          method: 'POST'
        });
        return true;
      } catch (error) {
        console.error('Failed to reset session:', error);
        return false;
      }
    }
    
    // Method to reset all cached data
    resetAllData() {
      // Reset all cached data
      this.titles = {};
      this.states = {};
      this.patientInfo = {};
      this.graphCount = {};
      this.temporalPropertyLabels = {};
      this.temporalPropertyTypes = {};
      this.events = null;
      this.patterns = {};
      this.eventPatterns = {};
      this.stateToTemporalPropertyMap = {};
      this.patternImportance = {};
      this.allNormalBounds = null;
      this.normalBounds = {};
      
      console.log('Reset all cached data in DataManagementService');
    }


    // Method to fetch all normal bounds at once
    async fetchAllNormalBounds() {
      if (this.allNormalBounds === null) {
        try {
          const sessionId = sessionStorage.getItem('session_id');
          const response = await fetch(`${API_BASE_URL}/get_normal_bounds_for_TemporalPropertyID?session_id=${sessionId}`);
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          const data = await response.json();
          this.allNormalBounds = data;
          
          // Also populate individual cache entries for faster subsequent access
          Object.entries(data).forEach(([temporalPropertyId, bounds]) => {
            this.normalBounds[temporalPropertyId] = {
              LowNormalBound: bounds[0],
              HighNormalBound: bounds[1]
            };
          });
        } catch (error) {
          console.error('Error fetching all normal bounds:', error);
          this.allNormalBounds = {};
        }
      }
    //  console.log('allNormalBounds', this.allNormalBounds);
      return this.allNormalBounds;
    }

    // Method to fetch pattern info
    async fetchPatternInfo(patternId, eventId) {
      try {
        const sessionId = sessionStorage.getItem('session_id');
        const response = await fetch(`${API_BASE_URL}/pattern_info/${patternId}?session_id=${sessionId}&event_id=${eventId}`);
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return await response.json();
      } catch (error) {
        console.error('Error fetching pattern info:', error);
        throw error;
      }
    }

    /* ------------------------------------------------------------------ *
   *  fetch only { patternId : importance } for a given event           *
   * ------------------------------------------------------------------ */
    async fetchPatternImportance(eventId) {
      if (this.patternImportance[eventId] == null) {
        try {
          const sid = sessionStorage.getItem("session_id");
          const res = await fetch(
            `${API_BASE_URL}/patterns/importance?session_id=${sid}&event_id=${eventId}`
          );
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          this.patternImportance[eventId] = await res.json();  // { "4":0.9, ... }
        } catch (err) {
          console.error("Error fetching importance:", err);
          this.patternImportance[eventId] = {};
        }
      }
      return this.patternImportance[eventId];
    }

    /* ------------------------------------------------------------------ *
     *  fetch patterns **and** inject importance → [{index, patternData,  *
     *                                              importance}]          *
     * ------------------------------------------------------------------ */
    async fetchPatternsWithImportance(eventId) {
      const [patternsArr, impDict] = await Promise.all([
        this.fetchAllPatterns(eventId),
        this.fetchPatternImportance(eventId),
      ]);

      return patternsArr.map(p => ({
        ...p,
        importance: impDict[p.index] ?? 0,   // default 0
      }));
    }
  
     // Get only the `entity_data` dict for one event (same structure across events)
    // api/fetchEntityDataFromOneEvent.js
    async fetchEntityDataFromOneEvent({ eventId = 0, endTime }) {
      const sid = sessionStorage.getItem('session_id');
      if (!sid) throw new Error('Missing session_id');
      if (endTime == null) throw new Error('endTime is required');

      const qs = new URLSearchParams({
        session_id: sid,
        end_time: String(endTime),
        event_id: String(eventId ?? 0)
      });

      const res = await fetch(`${API_BASE_URL}/entity_data_from_one_event?${qs.toString()}`, {
        headers: { Accept: 'application/json' }
      });
      const text = await res.text();

      if (!res.ok) {
        try {
          const j = JSON.parse(text);
          throw new Error(j?.error || `HTTP ${res.status}`);
        } catch {
          throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
        }
      }
      try {

        const json = JSON.parse(text);
        if (!json || !Array.isArray(json.entity_data)) {
          throw new Error('Bad payload shape: expected { entity_data: [] }');
        }
        return json.entity_data;
      } catch {
        throw new Error('Non-JSON response from /entity_data_from_one_event');
      }
    }

    // DataManagementService.jsx
    async fetchDetectedPatternsAndProb(eventId, endTime) {
      try {
        const sid = sessionStorage.getItem('session_id');
        if (!sid) throw new Error('Missing session_id');

        const qs = new URLSearchParams({
          session_id: sid,
          event_id: String(eventId ?? 0),
          end_time: String(endTime ?? 0),
        });

        const res = await fetch(`${API_BASE_URL}/detected_patterns_and_prob?${qs.toString()}`, {
          headers: { Accept: 'application/json' }
        });

        if (!res.ok) {
          const txt = await res.text();
          try { const j = JSON.parse(txt); throw new Error(j.error || `HTTP ${res.status}`); }
          catch { throw new Error(`HTTP ${res.status}: ${txt.slice(0, 120)}`); }
        }

        const json = await res.json();

        // ---- NORMALIZATION ----
        // Server may return:
        // A) { detected_patters: { <patternIndex>: [instances] }, ... }
        // B) { detected_patters: [{ timestamp, detection_tirps: {...} }, ...] }
        // C) { detected_patters: { <ts>: { timestamp, detection_tirps: {...} }, ... } }
        const raw = json.detected_patters;
        let rows = [];

        const pickRow = (obj) => {
          if (!obj || typeof obj !== 'object') return null;
          const map =
            obj.detection_tirps ??
            obj.detected_tirps ??
            obj.detectionTirps ??
            null;
          if (map && typeof map === 'object') {
            // ensure we always have a timestamp for downstream
            const ts = Number.isFinite(Number(obj.timestamp)) ? Number(obj.timestamp) : Number(endTime ?? 0);
            return { timestamp: ts, detection_tirps: map };
          }
          return null;
        };

        if (Array.isArray(raw)) {
          // B) already an array of rows
          rows = raw.map(r => pickRow(r)).filter(Boolean);
        } else if (raw && typeof raw === 'object') {
          // A) or C)
          const maybeRow = pickRow(raw);
          if (maybeRow) {
            // A) direct detection_tirps map
            rows = [maybeRow];
          } else {
            // C) ts -> row mapping
            rows = Object.values(raw).map(pickRow).filter(Boolean);
            if (!rows.length) {
              // As a last resort assume A) again and wrap the whole object as detection_tirps
              rows = [{ timestamp: Number(endTime ?? 0), detection_tirps: raw }];
            }
          }
        } else {
          rows = [];
        }
        // ---- /NORMALIZATION ----

        const patterns_prob = (json.patterns_prob && typeof json.patterns_prob === 'object') ? json.patterns_prob : {};
        const event_prob = typeof json.event_prob === 'number' ? json.event_prob : 0;
        const TTE_event  = typeof json.TTE_event  === 'number' ? json.TTE_event  : 0;

        return { detected_patters: rows, patterns_prob, event_prob, TTE_event };
      } catch (err) {
        console.error('Error fetching detected patterns & prob:', err);
        return { detected_patters: [], patterns_prob: {}, event_prob: 0, TTE_event: 0 };
      }
    }


    async fetchEventProbability(eventId, endTime) {
      const payload = await this.fetchDetectedPatternsAndProb(eventId, endTime);
      return (typeof payload.event_prob === "number" && isFinite(payload.event_prob)) ? payload.event_prob : 0;
    }

    // Convenience: return probability (0..1) for a specific pattern index
    async fetchPatternProbability(eventId, endTime, patternIndex) {
      const payload = await this.fetchDetectedPatternsAndProb(eventId, endTime);
      const key = String(patternIndex);
      const p = payload.patterns_prob?.[key];
      return (typeof p === 'number' && isFinite(p)) ? p : 0;
    }



    async getCurrentTime() {
      const sessionId = sessionStorage.getItem('session_id');

      const res = await fetch(`${API_BASE_URL}/get_current_time?session_id=${sessionId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to load current time');
      }
      return res.json(); // { event_id, entity_data }
    }

    /** Get the list of dataset/model names (from /fetch_dataset_names) */
    async fetchDatasetNames() {
      try {
        const res = await fetch(`${API_BASE_URL}/fetch_dataset_names`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });

        // Some Flask setups return JSON lists directly; handle both list and object
        const text = await res.text();
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);

        let data;
        try { data = JSON.parse(text); } catch { data = null; }

        if (Array.isArray(data)) return data;                     // ['Falls','LCOS_onset', ...]
        if (data && Array.isArray(data.datasets)) return data.datasets;
        if (data && data.model_and_entities) return Object.keys(data.model_and_entities);

        // Fallback so UI remains usable
        return ['Falls', 'LCOS_onset'];
      } catch (err) {
        console.error('fetchDatasetNames failed:', err);
        return ['Falls', 'LCOS_onset'];
      }
    }

    /** Switch dataset on the server (wraps /reset_session?name_dataset=...) */
    async switchDataset(nameDataset) {
      if (!nameDataset) throw new Error('nameDataset is required');

      try {
        // ensure session exists
        let sid = sessionStorage.getItem('session_id');
        if (!sid) {
          const ok = await this.createSession();
          if (!ok) throw new Error('Failed to create session');
          sid = sessionStorage.getItem('session_id');
        }

        const url = new URL(`${API_BASE_URL}/reset_session`, window.location.origin);
        url.searchParams.set('session_id', sid);
        url.searchParams.set('name_dataset', nameDataset);

        const res = await fetch(url.toString(), { method: 'POST', headers: { Accept: 'application/json' } });
        const body = await res.text().catch(() => '');
        if (!res.ok) throw new Error(body || `HTTP ${res.status}`);

        // clear all caches so the app fully reloads with new data
        this.resetAllData();
        return true;
      } catch (err) {
        console.error('switchDataset failed:', err);
        throw err;
      }
    }


  }

  


  
  export default new DataManagementService();