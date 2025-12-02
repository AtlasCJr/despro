# GTW NAMA APPNYA

Despro is an IoT-based smart power-monitoring system built using ESP32, ACS712 current sensors, ZMPT voltage sensors, relays, and a React + Firebase web dashboard.

## What This Project Does

### **1. Embedded System (ESP32)**  
The ESP32 acts as the main controller of the entire system. It performs:

#### Sensor Reading  
- Reads **voltage** (ZMPT101B) and **current** (ACS712) at high frequency

#### Power Calculations  
The system computes:
- **Active Power**
- **Reactive Power**
- **Apparent Power**
- **Power Factor**
- **Frequency**
- **Harmonics**

#### Load Control  
- Supports **4–8 AC loads** through relay switching  
- Real-time switching via local logic or remote dashboard

#### Task Scheduling & Data Processing  
- Uses **FreeRTOS** for multitasking  
- Performs **batch averaging** for stable readings  
- Sends processed data to **Firestore every 60 seconds**

#### Offline Handling  
- Automatically stores queued data in **SPIFFS** when Wi-Fi is offline  
- Uploads stored data once connection returns

#### System Notifications  
The firmware automatically detects and reports critical states:
- High ESP32 temperature  
- Low heap memory  
- Wi-Fi reconnect / disconnect  
- Device reboot (with reset cause)

## ☁️ 2. Cloud Backend (Firebase Firestore)

Firestore serves as the real-time database and historical storage layer for the system.

### Data Architecture
Despro uses a multi-layer data model:

- **RL1** — Raw minute-level data  
- **RL2 / RL3** — Aggregated hourly and daily data  
- **PL1–PL5** — Higher-level processed data (weekly, monthly, yearly trends)

### Backend Responsibilities
Firestore stores:
- Real-time power data  
- Aggregated analytics  
- Notification logs  
- Component metadata (device info, configuration, status)  

The backend is optimized for:
- Fast writes from ESP32  
- Real-time UI updates  
- Scalable historical storage  

---

## 3. Web Dashboard (React + Firebase)

A modern control and monitoring dashboard built using **React + TypeScript**.

### Dashboard Features
- Real-time charts (voltage, current, power, PF, frequency)  
- Today / Weekly / Monthly / Yearly views  
- Component status cards  
- Notification center  
- Relay control interface  
- Cost estimation & energy analytics  
- Automatic refresh with Firestore listeners  

### Technologies Used
- React + Vite  
- Recharts  
- Firebase Web SDK  
- TypeScript  
- Custom hooks for Firestore data (useBundle, useComponentData, etc.)

---

## 4. Hardware Overview

The system consists of:

- **ESP32 DevKit** — Main microcontroller  
- **ACS712** — Current sensor (5A / 20A / 30A)  
- **ZMPT101B** — Voltage sensor  
- **Relay Module (4–8 channels)** — Load control  
- **HLK-PM05 / HLK-10M05** — AC–DC converter  
- **WAGO connectors** — Safe AC wiring  
- **ILI9341 Display (optional)** — Local UI  
- **SD Card Module (optional)** — Offline storage  
- Custom PCB (in development)

---

## 5. System Highlights

- Real-time power monitoring  
- Accurate signal processing  
- Offline fail-safe upload  
- FreeRTOS-based multitasking  
- Auto-recovery from connectivity loss  
- Modular firmware design  
- Scalable Firestore structure  
- Fully interactive web dashboard  
- Notification-driven monitoring  

---