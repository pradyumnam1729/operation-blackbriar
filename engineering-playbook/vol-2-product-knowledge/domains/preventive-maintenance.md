# Domain: Preventive Maintenance

## Purpose

Preventive maintenance (PM) programs define the scheduled, recurring maintenance activities that extend asset life, prevent premature failure, and maintain safe operating condition. Unlike reactive maintenance (which responds to failures) and capital investment (which replaces or rehabilitates assets), preventive maintenance is the ongoing operational investment that keeps assets performing within their designed parameters.

The PM domain in Aurigo Maintain has a specific scope: it connects PM program design to deterioration model calibration and capital planning. Aurigo does not compete with Maximo or Cityworks for PM execution (scheduling technicians, tracking parts, recording labor). The PM domain captures the completion of PM activities as condition signals that improve the deterioration model, and tracks PM compliance rates as a leading indicator of maintenance program health.

In Native mode (for customers without an existing EAM), Maintain can function as a complete PM execution system. In Integrated mode, PM data flows from the EAM into Maintain via integration.

## Business Value

**Deterioration model calibration:** The effectiveness of a PM program directly affects the deterioration rate of an asset. An asset receiving its prescribed PM on schedule deteriorates more slowly than an identical asset where PM is consistently deferred. Maintain tracks PM compliance by asset class and uses compliance rate as a variable in the deterioration model calibration. High-compliance assets use a lower deterioration rate; low-compliance assets use a higher rate.

**Capital planning optimization:** A well-executed PM program defers major capital replacement. Maintain quantifies this: for each asset class, the relationship between PM compliance rate and capital replacement year is modeled. Increasing PM compliance from 60% to 90% for a pavement class may extend the average replacement interval by 2 years, reducing the capital needs in the 5-10 year horizon by a calculable amount.

**Maintenance budget justification:** PM programs require budget — technician time, materials, equipment. The ROI of the PM budget is the capital cost avoided by extending asset life. Maintain calculates this explicitly, enabling maintenance managers to justify their PM budget with a quantified capital avoidance argument.

## Personas

**Maintenance Manager:** Designs and manages PM programs by asset class. Monitors PM compliance rates and investigates causes of non-compliance. Adjusts PM intervals based on Maintain's analysis of the relationship between PM compliance and deterioration rate.

**Reliability Engineer (Manufacturing):** Designs PM programs for production equipment. Analyzes the relationship between PM compliance and OEE. Optimizes PM intervals to balance maintenance cost against production uptime.

**Field Technician:** Executes PM work orders. Records completion, materials used, labor hours, and any defects observed during PM execution that trigger inspection or corrective action.

## User Stories

1. **As a Maintenance Manager**, I want to create a PM template for each asset class that specifies the PM type, frequency, labor requirements, and materials, so that PM work orders can be generated automatically on schedule.

2. **As a Maintenance Manager**, I want to see the PM compliance rate by asset class (percentage of scheduled PM work orders completed on time) so that I can identify asset classes where PM is being consistently deferred and investigate the root cause.

3. **As an Asset Manager**, I want to see how the PM compliance rate for each asset class correlates with the observed deterioration rate so that I can quantify the value of improving PM compliance.

4. **As a Reliability Engineer**, I want to configure the PM interval for each production equipment class and see the projected effect on MTBF and capital replacement year so that I can optimize the PM program for cost and reliability.

5. **As a Field Technician**, I want to record the completion of a PM work order from my mobile device, including any defects observed, so that the PM record is current and any defects are queued for follow-up.

6. **As a Maintenance Manager**, I want to see which assets are overdue for PM, by how many days, and who is responsible, so that I can prioritize the PM backlog.

## Business Rules

1. **PM interval enforcement:** PM work orders are generated automatically when the interval (calendar days or operating hours) since the last PM completion has elapsed. The generation tolerance is configurable (default: 10% of interval).

2. **PM completion data required:** A PM work order is not marked complete without at minimum: completion date, technician ID, and a condition observation (either "no defects" or a list of defects found).

3. **Defect escalation from PM:** Defects identified during PM execution that exceed a severity threshold automatically trigger a corrective work order. The trigger threshold (defect severity level) is configurable by PM type.

4. **PM compliance rate calculation:** Compliance rate is the percentage of PM work orders completed within the defined tolerance window. A PM due on March 1 with a 10% tolerance (±3 days for a monthly PM) is "on time" if completed between February 26 and March 4.

5. **PM history preservation:** PM completion records are preserved indefinitely. They are the training data for deterioration model calibration.

## Integration Points

- **EAM Systems:** In Integrated mode, PM work order completion data flows from the EAM via the maintenance integration. The PM domain in Maintain reads PM completion records; it does not duplicate PM scheduling (which remains in the EAM).
- **Work Orders Domain:** In Native mode, PM work orders are managed in the work orders domain. PM completion updates the deterioration model via the maintenance event record.
- **Capital Planning Domain:** PM compliance rate is a variable in the deterioration model configuration. The capital planning engine uses the configured deterioration rate (which reflects PM compliance) for each asset class.

## Future Evolution

- **Condition-based maintenance triggers:** PM intervals that adjust based on condition monitoring data (e.g., extend PM interval when asset is in good condition, shorten when deterioration accelerates)
- **AI-optimized PM intervals:** ML model that optimizes PM intervals by asset class based on the relationship between PM history and failure events in the customer's specific data
- **Predictive maintenance integration:** IoT sensor data feeds that trigger PM work orders based on real-time condition signals rather than calendar or operating hour intervals

---

*See also: [Maintenance Domain](maintenance.md) | [Work Orders Domain](work-orders.md) | [Inspections Domain](inspections.md)*
