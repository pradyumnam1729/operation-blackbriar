# Primus Maintain — Private Asset Intelligence

## Purpose

Primus Maintain is the asset intelligence platform for private infrastructure owners. It is the system that tells a VP of Operations which production assets are approaching end of reliable life, a data center director which critical infrastructure components are highest risk, a utility asset manager which distribution equipment needs capital investment, and a life sciences compliance officer which equipment is due for requalification.

Like Masterworks Maintain, Primus Maintain is not a CMMS. It does not replace Maximo, Infor EAM, or SAP PM. It is the intelligence layer above those systems — providing the condition modeling, lifecycle analysis, and capital planning capabilities that existing EAMs cannot provide. The integration philosophy (read from existing systems, add the intelligence layer) applies equally in the private sector.

The vertical depth of Primus Maintain is its distinguishing feature. Different private sector industries have fundamentally different asset classes, different condition rating methodologies, different regulatory frameworks, and different financial drivers. Primus Maintain is configured with industry-specific asset class libraries, condition models, compliance templates, and capital planning frameworks.

---

## Manufacturing

### Asset Classes

| Asset Class Code | Asset Type | Key Attributes |
|-----------------|------------|----------------|
| MFG_EQUIP | Production Equipment (CNC, press, lathe, etc.) | Manufacturer, model, serial number, rated capacity, operating hours |
| MFG_CONV | Conveyors and material handling | Length, drive type, belt type, installed year |
| MFG_HVAC | Industrial HVAC | Capacity (tons), refrigerant type, age |
| MFG_COMP | Compressed air systems | Capacity (CFM), pressure rating, receiver volume |
| MFG_ELEC | Electrical distribution (switchgear, MCC, transformers) | Voltage rating, amperage, installed year |
| MFG_UTIL | Process utilities (boilers, chillers, cooling towers) | Capacity, fuel type, pressure rating |
| MFG_ROBOT | Robotic systems | Manufacturer, model, payload, installed year, programming version |
| MFG_INSP | Quality inspection equipment (CMMs, vision systems) | Calibration interval, last calibration date |

### Key Metrics

**OEE (Overall Equipment Effectiveness):** The composite measure of production equipment performance. OEE = Availability × Performance × Quality. Primus Maintain tracks the OEE components:
- **Availability:** The percentage of scheduled production time that the asset was actually available for production (unplanned downtime reduces availability)
- **Performance:** The percentage of the theoretical maximum throughput achieved when the asset is running
- **Quality:** The percentage of output that meets specification (rejects and rework reduce quality)

OEE trending over time is a leading indicator of asset health. An asset whose OEE has declined from 85% to 72% over two years is likely deteriorating in ways that will result in failure if capital intervention is not made.

**MTBF (Mean Time Between Failures):** The average operating time between unplanned failures. Primus Maintain calculates MTBF from maintenance event history (reactive maintenance events = failures). A declining MTBF trend indicates accelerating deterioration.

**MTTR (Mean Time to Repair):** The average time from failure detection to restoration of normal operation. An increasing MTTR trend may indicate spare parts availability issues, technician skill gaps, or increasing complexity of repairs (a sign of aging).

**Maintenance Cost per Unit:** Total maintenance cost (labor + parts) divided by production units. Increasing maintenance cost per unit is a direct indicator of economic end-of-life — when the maintenance cost of keeping an asset running exceeds the cost of replacement.

### Capital Planning for Manufacturing

The capital planning model for manufacturing is built around the concept of the **economic replacement age** — the point at which the total cost of operating an aging asset (escalating maintenance cost + increasing downtime cost) exceeds the total cost of replacing it (capital cost + installation + productivity loss during replacement).

Primus Maintain calculates the economic replacement age for each production asset using:
1. **Maintenance cost trend:** Fitted trend line through historical maintenance cost data
2. **Downtime cost:** Expected unplanned downtime hours × hourly production value
3. **Replacement cost:** Capital cost from the asset class unit cost library, or manual entry
4. **Replacement disruption cost:** Production downtime required for installation and commissioning × hourly production value

The model produces a year-by-year comparison of "keep vs. replace" and identifies the year at which replacement becomes economically superior to continued operation. This is the capital need year that flows into Primus Plan.

### Integration with MES and SCADA

For manufacturing customers with Manufacturing Execution Systems (MES) and SCADA systems, Primus Maintain reads:
- OEE data from MES (SAP MII, Wonderware, GE Proficy, Ignition)
- Alarm history from SCADA (high-frequency alarms as condition signals)
- Production counters (operating hours, cycle counts, units produced)

These data streams populate the asset condition time series without manual data entry, providing a richer condition picture than periodic manual inspection alone.

---

## Data Centers

Data center asset management is one of the highest-stakes applications of Primus Maintain. Critical infrastructure failures in data centers result in SLA breaches with financial and reputational consequences. The asset lifecycle model for data center infrastructure must be accurate, current, and predictive.

### Asset Class Library

| Asset Class Code | Asset Type | Typical Useful Life | Key Lifecycle Trigger |
|-----------------|------------|--------------------|-----------------------|
| DC_GEN | Diesel/gas generator | 20-30 years | Major overhaul at 15,000 hours; replacement at end of service life |
| DC_UPS | Uninterruptible Power Supply | 10-15 years | Battery replacement at 5-7 years based on float voltage; unit at 10-15 years |
| DC_BATT | UPS Battery Strings | 5-7 years | Float voltage monitoring; capacity test below 80% triggers replacement |
| DC_CRAC | Computer Room Air Conditioner | 10-15 years | Compressor overhaul at 80,000 hours; refrigerant system service life |
| DC_CRAH | Computer Room Air Handler | 15-20 years | Coil fouling, fan bearing wear, filter system |
| DC_CHLR | Centrifugal or screw chiller | 20-25 years | Compressor rebuild at 40,000 hours; refrigerant system |
| DC_CTWR | Cooling tower | 20-30 years | Fill media replacement at 15-20 years; structure and basin |
| DC_PDU | Power Distribution Unit | 15-20 years | Breaker age, bus duct insulation, metering |
| DC_XFMR | Dry-type transformer | 25-35 years | Insulation resistance trending, thermal scan |
| DC_ATS | Automatic Transfer Switch | 20-25 years | Contact wear, cycling count, operating time |
| DC_SWGR | Switchgear | 20-30 years | Contact wear, arc flash analysis, insulation |
| DC_FPS | Fire Protection System (FM200, Novec) | 10-15 years | Agent quantity (cylinder weight), nozzle condition, control panel |
| DC_TANK | Diesel fuel storage tank | 20-30 years | Lining condition, overfill protection, leak detection |
| DC_BESS | Battery Energy Storage System | 10-15 years | Capacity fade trend, cell voltage balance |

### Deterioration Models for Data Center Assets

Mechanical systems (generators, CRAC/CRAH, chillers, cooling towers) follow Weibull deterioration curves. Electrical systems (UPS, PDU, switchgear) have more complex lifecycle behavior: they may operate at full performance until near end of life, then fail more abruptly. Primus Maintain supports both models:

- **Weibull model:** Used for mechanical systems with wear-based deterioration. The Weibull shape parameter (β) and scale parameter (λ) are set based on the asset class library (manufacturer data and industry experience). β > 1 indicates increasing failure rate with age (the most common case for mechanical systems). β < 1 indicates decreasing failure rate (infant mortality, relevant for newly installed systems).

- **Operating hour model:** For assets with defined overhaul intervals (generators: 15,000 hours; CRAC compressors: 80,000 hours), Primus Maintain tracks cumulative operating hours and projects the overhaul date based on average run time per year.

- **Calendar model:** For assets with time-based replacement intervals (UPS batteries: 5-7 years from installation, regardless of operating hours), Primus Maintain tracks installation date and projects replacement date.

### Key Metrics for Data Centers

**PUE (Power Usage Effectiveness):** Total facility power / IT equipment power. A data center operating at Tier III standards targets PUE of 1.2-1.4. Deteriorating cooling infrastructure increases PUE. Primus Maintain tracks PUE trend as a leading indicator of cooling system health.

**Tier Rating Compliance:** Uptime Institute Tier ratings (I through IV) define redundancy requirements. Tier III requires N+1 redundancy for all critical systems; Tier IV requires 2N+1. Primus Maintain tracks the Tier rating of each critical system and flags when a scheduled maintenance outage would reduce redundancy below the Tier requirement.

**UPS Battery Float Voltage:** Battery float voltage (the voltage at which the battery system is maintained during non-discharge periods) is the primary health indicator for VRLA battery strings. Float voltage below the manufacturer's minimum threshold is an early warning of battery degradation that precedes capacity loss by 6-12 months. Primus Maintain can ingest float voltage telemetry from the UPS management system and trend it against the threshold.

### Capital Planning for Data Centers

Data center capital planning is driven by two forces: lifecycle replacement of critical systems at defined intervals, and capacity expansion driven by IT load growth. Primus Maintain produces a year-by-year capital needs schedule that includes both types of investment.

The capital needs report for a data center shows:
- Year-of-replacement for each asset class, based on the applicable lifecycle model
- Cost estimate based on the asset class unit cost library (updated quarterly from market pricing)
- Risk profile for deferral: what is the probability of a major failure if replacement is deferred by 1 year? 2 years? The risk model is Weibull-based for mechanical systems and capacity-fade-based for batteries.
- Redundancy impact: if the scheduled replacement is deferred, does it affect the Tier rating compliance?

### User Stories for Data Centers

1. **As a Data Center Director**, I want to see a 10-year capital replacement schedule for all critical infrastructure assets, with year-of-need projections and cost estimates, so that I can present a long-range capital plan to the board.

2. **As a Data Center Director**, I want to be alerted when any critical system's condition score drops below the threshold that indicates high failure risk so that I can take corrective action before an unplanned outage occurs.

3. **As a Data Center Operations Manager**, I want to see the generator operating hours for all generators in the facility and their projected time to the next scheduled major overhaul so that I can plan the overhaul schedule without production conflicts.

4. **As a Data Center Director**, I want to configure the UPS battery replacement model to use float voltage telemetry from our UPS management system so that the capital needs forecast for batteries is based on actual condition, not just age.

5. **As a VP of Finance at a colocation provider**, I want the Primus Plan capital needs forecast to feed into our annual capital budget process so that the data center capital program is built from asset condition data, not from informal estimates.

---

## Utilities

### Asset Classes

Electric and gas utilities manage a diverse and geographically distributed asset network. Primus Maintain for utilities covers:

- **Transmission assets:** Transmission lines, towers, insulators, conductors, substation equipment (transformers, circuit breakers, disconnects, capacitor banks, reactors)
- **Distribution assets:** Distribution lines (overhead and underground), poles, transformers, reclosers, regulators, meters
- **Generation assets:** Power plants (natural gas, coal, hydro, nuclear), renewable generation (wind turbines, solar panels, inverters)
- **Gas infrastructure:** Pipelines, compressor stations, pressure regulation, metering

### NERC CIP Compliance

NERC (North American Electric Reliability Corporation) CIP (Critical Infrastructure Protection) standards require utilities to protect bulk electric system (BES) assets from cybersecurity threats. CIP-014 specifically addresses physical security of transmission substations. Primus Maintain supports NERC CIP compliance documentation for BES assets.

### Rate Case Integration

Utilities are regulated monopolies in most states. Capital investment must be approved by state Public Utility Commissions (PUCs) through a rate case process. The utility demonstrates that capital investments are "prudent" — necessary, reasonably priced, and appropriately scheduled — and the PUC includes the approved capital in the rate base, which the utility recovers through customer rates.

Primus Maintain's condition data and capital needs analysis are directly applicable to rate case proceedings: the condition of the distribution system, the capital investment required to maintain reliability, and the risk of deferral are all quantifiable from Maintain's data. The capital needs report and risk analysis from Maintain can be directly incorporated into rate case testimony.

---

## Life Sciences

### Qualification Lifecycle Management

The pharmaceutical and life sciences industry is governed by FDA GMP regulations. Equipment used in drug manufacturing must be maintained in a "validated state" — meaning it has been qualified (IQ/OQ/PQ) and continues to operate within the parameters established during qualification.

Primus Maintain tracks the qualification status of every production system:

- **IQ (Installation Qualification):** Verified that the system was installed according to specifications. Status: Not Started, In Progress, Complete, Expired
- **OQ (Operational Qualification):** Verified that the system operates within specified ranges when operating within design parameters. Status tracks similarly.
- **PQ (Performance Qualification):** Verified that the system consistently performs within specifications under actual production conditions.
- **Ongoing Qualification / Periodic Review:** Many systems require periodic re-qualification review (annually or when a change is made). Primus Maintain tracks the periodic review schedule and sends alerts when reviews are due.

**Requalification triggers:** Certain maintenance events require requalification. When a maintenance technician records a maintenance event in Primus Maintain (or the event is imported from the CMMS), Maintain evaluates whether the event type triggers a requalification requirement. If yes, the asset's qualification status is automatically changed to "Pending Requalification" and an alert is sent to the qualification manager.

### Capital Planning for Life Sciences

Life sciences capital planning must account for:
- **Equipment replacement cost:** The cost of the new equipment
- **Installation and validation cost:** Often 50-100% of equipment cost
- **Change control and regulatory notification:** For significant changes to manufacturing processes, regulatory submissions may be required
- **Downtime during qualification:** Production capacity is reduced during OQ and PQ testing

Primus Plan for life sciences includes a qualification cost estimator that applies industry-standard validation cost factors by asset class, enabling accurate total project cost estimates that include the full cost of regulatory compliance.

---

## User Stories for Primus Maintain (Cross-Vertical)

1. **As a Manufacturing VP of Operations**, I want to see which production assets have declining OEE trends so that I can proactively investigate the root cause before the asset fails unexpectedly.

2. **As a Manufacturing Plant Manager**, I want to view the economic replacement analysis for our critical CNC machines — comparing the cost of continued operation (escalating maintenance + downtime) against the cost of replacement — so that I can support the capital budget request with a defensible financial case.

3. **As a Data Center Director**, I want to see the PUE trend for our facility over the past 24 months and receive an alert if PUE exceeds our target threshold so that I can investigate cooling system degradation before it becomes a capacity issue.

4. **As a Data Center Director**, I want the system to flag when any generator is within 500 hours of its scheduled major overhaul so that I can schedule the overhaul without conflicting with peak demand periods.

5. **As a Utility Asset Manager**, I want to see the age distribution of our overhead distribution transformers by vintage year and material type so that I can prioritize the replacement of the highest-risk aged units.

6. **As a Utility Capital Planning Manager**, I want the capital needs forecast from Primus Maintain to be formatted for inclusion in our rate case filing, with asset condition justification for each capital investment, so that we can defend our capital program to the PUC.

7. **As a Life Sciences Director of Quality Systems**, I want to see all manufacturing assets that are due for periodic qualification review in the next 90 days so that I can schedule the reviews without conflicts and maintain continuous compliance.

8. **As a Life Sciences Capital Projects Director**, I want each capital project in Primus Plan to include a qualification cost estimate based on the asset class and change type so that our total project cost estimates account for FDA compliance costs.

9. **As a Manufacturing Reliability Engineer**, I want to configure a custom Weibull deterioration model for our specific production equipment, fitted to our actual failure history, so that the capital needs forecast reflects our actual experience, not generic industry averages.

10. **As a Data Center VP of Operations**, I want to run a Tier rating impact analysis for any planned capital maintenance outage so that I can ensure our Tier III compliance is maintained throughout the work.

11. **As a VP of Operations**, I want to see the total maintenance cost per asset class over the past 5 years, trending year-over-year, so that I can identify which asset classes are consuming disproportionate maintenance resources and should be prioritized for capital replacement.

12. **As a Life Sciences QA Manager**, I want to be notified when a maintenance event is recorded that triggers a requalification requirement so that I can initiate the requalification protocol before the next production run.

13. **As a Manufacturing CFO**, I want the capital plan to show the NPV and payback period for each asset replacement proposal so that I can apply consistent financial screening criteria across all capital requests.

14. **As a Utility Reliability Engineer**, I want to see the failure history (reactive maintenance events) for each substation transformer, with the number of failures per year trending over time, so that I can identify transformers with accelerating failure rates for priority replacement.

15. **As a Data Center Director**, I want to generate a capital plan report formatted for board presentation that shows the 10-year replacement schedule with costs, the risk of deferral for each major system, and the total capital investment required to maintain Tier III compliance.

## Business Rules

1. **Tier rating compliance:** The system enforces that any scheduled maintenance activity that would reduce redundancy below the configured Tier rating is flagged as requiring a maintenance window plan (ensuring redundant systems are online before the work begins).

2. **Qualification status enforcement:** For life sciences tenants, assets in "Pending Requalification" status cannot be released for production use. The status must be resolved (requalification completed or change control waiver issued) before the asset is marked as production-available.

3. **OEE calculation standard:** OEE is calculated as Availability × Performance × Quality, where Availability is calculated from scheduled production time minus unplanned downtime events in the maintenance history. The calculation period defaults to the trailing 12 months, configurable per tenant.

4. **Economic replacement model auditability:** The economic replacement analysis is stored with all input values (maintenance cost history, production value, replacement cost, disruption cost) at the time of calculation. Users can view the inputs that generated a specific recommendation.

5. **Asset criticality rating:** Each asset is assigned a criticality rating (1-5, where 5 is safety-critical or production-critical with no redundancy). The criticality rating affects the risk score calculation and the capital prioritization algorithm. Safety-critical assets (criticality 5) have a lower acceptable condition threshold before capital recommendation is triggered.

## Future Evolution

- **IoT condition monitoring integration:** Real-time vibration, temperature, and oil quality sensor data for rotating equipment feeding the condition time series (predictive maintenance)
- **Digital twin:** 3D model integration for data center critical infrastructure, enabling visualization of asset location within the facility
- **AI failure prediction:** Machine learning model trained on failure history, maintenance records, and operational data to predict failure probability before it is detectable by periodic inspection
- **Peer benchmarking:** Anonymous aggregate benchmarking of asset condition and maintenance cost by industry vertical and asset class (opt-in by tenant)
- **Automated insurance reporting:** Asset condition and replacement value data formatted for property insurance renewal applications

---

*See also: [Primus Plan](plan.md) | [Primus Build](build.md) | [Asset Management Domain](../domains/asset-management.md) | [AI Domain](../domains/ai.md)*
