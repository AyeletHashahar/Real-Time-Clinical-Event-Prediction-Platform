# Real-Time Clinical Event Prediction Platform

## Overview

A real-time machine learning platform for continuous prediction of clinical events in Intensive Care Unit (ICU) patients.

The system combines temporal abstraction, probabilistic modeling, temporal pattern mining and real-time prediction to support clinical decision-making.

Developed as part of an M.Sc. thesis at Ben-Gurion University under the Complex Data Analytics Lab (CDALab).

---

## Key Features

- Real-time clinical event prediction
- Continuous temporal abstraction
- Temporal pattern (TIRP) detection
- Probabilistic risk estimation
- Interactive clinical dashboard
- Historical patient investigation tools
- End-to-end ML pipeline

---

## System Architecture

![Architecture](docs/images/architecture.png)

The platform consists of:

1. Data ingestion layer
2. Temporal abstraction engine
3. Pattern detection module
4. Prediction engine
5. Flask backend services
6. React-based clinical dashboard

---

## Dashboard

![Dashboard](docs/images/dashboard.png)

Interactive dashboard presenting:

- Patient information
- Event probabilities
- Time-to-event estimation
- Temporal pattern visualization

---

## Real-Time Prediction

![Prediction](docs/images/realtime-prediction.png)

Continuous prediction updates are generated as new patient measurements arrive.

The system performs:

- temporal abstraction
- TIRP detection
- probabilistic prediction

without requiring full recomputation of historical data.

---

## Pattern Detection

![Patterns](docs/images/patterns.png)

Detected temporal patterns are continuously monitored and incorporated into prediction scores.

---

## Technology Stack

### Backend

- Python
- Flask
- Pandas
- NumPy

### Machine Learning

- Probabilistic Modeling
- Temporal Pattern Mining
- Real-Time Event Prediction
- Time-Series Analysis

### Frontend

- React
- JavaScript
- REST APIs

---

## Research Context

This project was developed as part of an M.Sc. thesis in Information Systems Engineering at Ben-Gurion University.

Research focus:

- Continuous Event Prediction
- Temporal Data Mining
- Healthcare Analytics
- Clinical Decision Support Systems

---

## Repository Structure

```text
backend/
frontend/
docs/
```

---

## Future Work

- Additional clinical datasets
- Advanced uncertainty modeling
- Explainable AI modules
- Multi-event prediction support
