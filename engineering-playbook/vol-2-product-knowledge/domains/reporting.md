# Reporting

## Purpose

Reporting in Aurigo Maintain serves three distinct masters: federal regulators who require compliance documentation in specific formats, agency executives who need portfolio intelligence for strategic decisions, and field analysts who need raw data for their own GIS tools and spreadsheet models. A reporting engine that serves all three without compromise requires architectural discipline separating the data access layer, the formatting layer, and the delivery layer.

This document covers the full reporting capability: standard reports, async generation for large datasets, export formats, scheduled delivery, regulatory compliance, the custom report builder, and data warehouse integration.

---

## Business Value

Government agencies have reporting obligations that are non-negotiable. The FHWA requires a TAMP every four years. FHWA National Bridge Inspection Standards require annual condition reporting. FAA requires pavement condition reporting for airports receiving AIP grants. Failing to produce these reports puts federal funding at risk.

Before Maintain, producing regulatory reports was a consultant-intensive manual process costing $50,000 to $200,000 per cycle. Maintain automates the data gathering and structure, reducing the consultant role to narrative review and final certification. Agencies report 70% cost reduction in TAMP preparation when using Maintain reporting capabilities.

Beyond regulatory compliance, self-service reporting eliminates the IT bottleneck for ad-hoc data requests. When an asset manager wants to know the inspection completion rate for a specific district, they get it in 60 seconds from the report builder instead of submitting a ticket and waiting two weeks.

---

## Standard Reports

Maintain ships with a library of pre-built standard reports. These are fixed-format reports that can be parameterized (date range, asset class, district) but not structurally modified. They represent the most common reporting needs across all agency types.

### TAMP (Transportation Asset Management Plan)

The TAMP report is the most complex report in the system. It produces a complete, FHWA-formatted document covering:

- Executive Summary: portfolio size, condition overview, investment summary
- Asset Inventory and Condition: counts, condition distribution, trend analysis by asset class
- Life Cycle Planning: deterioration models, maintenance strategies, life extension calculations
- Financial Plan: capital needs projection, budget plan, funding gap analysis
- Performance Gap Analysis: current performance vs. targets, projected performance with and without proposed investment
- Appendices: methodology, data sources, model calibration documentation

The TAMP report is generated as a PDF (government submission format) and as a Word-compatible document (for agency staff to edit before submission). It is typically 50 to 150 pages depending on portfolio size.

Generation time: asynchronous (15 to 45 minutes for a large portfolio). Progress indicator shown; email notification when complete.

### Asset Condition Summary

A tabular summary of all managed assets with: asset ID, name, class, location, current condition score, condition rating (Good/Fair/Poor), last inspection date, next scheduled inspection date, RUL estimate. Filtered by asset class, district, condition range, or date range.

Format: PDF (formatted table) or Excel (for analysis). Generation time: synchronous for fewer than 500 assets; asynchronous for larger portfolios.

### Capital Needs 10-Year

The 10-year capital needs register: one row per project per year with asset reference, work type, estimated cost, priority score, risk score, ARV basis. Two views: optimized plan (budget-constrained) and unconstrained needs (all recommended work regardless of budget). The gap between the two is the funding shortfall.

Format: Excel (primary, analysts need to pivot and slice this data), PDF (for board presentations).

### Inspection Completion Report

Completion rate statistics: total assets inspected vs. total assets requiring inspection in the period, by asset class, by inspector, by district. Lists all overdue inspections with days overdue. Used for program management and inspector performance reviews.

Format: PDF, Excel. Scheduled delivery: monthly, automatically to program directors.

### Work Order Summary Report

All work orders in a period with status, asset reference, work type, estimated cost, actual cost, variance. Summary totals: total committed, total spent, total variance. Used for financial reconciliation and contractor performance reviews.

Format: Excel, PDF.

### Deterioration Trend Report

For each asset class: plots the condition score distribution over time (typically 5-year history). Shows whether the portfolio is improving, stable, or deteriorating as a trend. Includes model vs. actual comparison for anomaly detection audit.

Format: PDF (charts plus tables), Excel (underlying data).

---

## Report Generation Architecture

### Synchronous Reports

Small reports (fewer than 500 rows, no complex chart rendering) are generated synchronously. The API endpoint processes the request, generates the report, and returns the binary file in the HTTP response. Target: under 5 seconds.

Used for: filtered condition summaries, work order lists, single-asset reports.

### Asynchronous Reports

Large reports are generated asynchronously via an SQS job queue:

1. User requests report from UI
2. API validates parameters, creates a ReportJob record (status: Queued), returns job ID immediately
3. Message published to SQS report-generation queue
4. Report Worker picks up the message, sets status: Processing
5. Worker generates report (queries DB, renders template, produces binary output)
6. Worker uploads to S3 with a 7-day TTL, sets status: Complete, stores download URL
7. Worker publishes completion event to notification service
8. Notification service sends email and in-app notification with download link
9. User downloads from signed S3 URL

The download URL expires after 7 days. Re-generating the report after expiry requeues the job. Target processing time for large TAMP: under 45 minutes.

### Report Worker Infrastructure

Report workers run as ECS Fargate tasks, scaling based on SQS queue depth. Scaling policy: add one task per 5 messages in queue, minimum 1 task, maximum 10 tasks.

---

## Export Formats

### PDF

Generated using PuppeteerSharp headless Chrome rendering. PDF reports follow a consistent government-style template:
- Agency logo (tenant-configured) in header
- Report title, date range, generated timestamp in header
- Page numbers and report reference in footer
- Section bookmarks for navigation
- Table of contents for multi-section reports
- Color-safe charts embedded as vector graphics
- Print-optimized for US Letter and A4

### Excel

Generated using EPPlus. Excel exports include:
- Formatted data table on the main sheet
- A Metadata sheet with report parameters, generation date, tenant, and data version
- Conditional formatting to highlight Poor condition (red), Fair (yellow), Good (green)
- Auto-filter enabled on all columns
- Named tables for easy pivot table creation

Excel is the preferred format for analysts who will manipulate the data further.

### CSV

Raw tabular data with UTF-8 encoding, RFC 4180 compliant. No formatting. Designed for import into GIS platforms, other data systems, or Python/R analysis environments. Headers in the first row are in snake_case.

### GeoJSON

For reports that include spatial data (asset location, inspection route, affected network), a GeoJSON export is available. Each feature carries all report fields as properties. SRID is always WGS84 (EPSG:4326). GeoJSON is consumable by QGIS, ArcGIS, Mapbox, and any modern GIS tool.

---

## Scheduled Delivery

Reports can be configured for automatic scheduled generation and email delivery. Configuration per scheduled report:
- Report type and parameters (fixed at schedule creation)
- Schedule: weekly, monthly, or quarterly with configurable day and time
- Recipients: email addresses including external addresses for board members or consultants
- Format: PDF and/or Excel

Scheduled reports are stored in the ScheduledReport table. A cron worker runs every 15 minutes and checks for due schedules. Failed deliveries retry 3 times with exponential backoff; persistent failure triggers an alert to the tenant admin.

---

## Regulatory Compliance Reports

### FHWA TAMP (23 CFR Part 515)

Covered above. Required for state DOTs receiving NHPP funds every 4 years. Maintain produces the data sections; the narrative is AI-assisted (see AI domain document). The final certification and submission remain with the agency.

### FHWA NBI (National Bridge Inspection)

Annual condition report for bridges and tunnels. Maintain exports bridge condition data in the NBI-compatible format (NBI XML or comma-delimited format specified in the FHWA NBI coding guide). The export maps Maintain condition fields to NBI element codes.

### FAA Pavement Condition (AC 150/5380-6)

For airport-owning agencies, Maintain exports pavement condition data in the format required by the FAA PAVEAIR system. Generates the Pavement Condition Index (PCI) summary by area and zone.

### NERC Equipment Condition

For utility agencies subject to NERC reliability standards: equipment condition summary report in the format required for CIP reliability submissions.

### State DOT Custom Requirements

Several states have their own asset management reporting requirements layered on top of federal requirements. The custom report builder allows DOT-specific templates to be configured without code changes.

---

## Custom Report Builder

The custom report builder allows asset managers and analysts to create ad-hoc reports without involving IT or waiting for a standard report to be developed.

### Builder Capabilities

**Field Selection**
The user starts with a report entity (Asset, Inspection, Work Order, Capital Plan) and selects fields to include. Fields are presented in plain English. Multi-entity joins are handled by the builder.

**Filters**
Drag-and-drop filter conditions with compound AND/OR logic. Date range filters with relative options (Last 12 Months, This Fiscal Year, Custom Range).

**Visualization Type**
Users select from: Table, Bar Chart, Line Chart, Pie/Donut Chart, Map, or Summary Card. The builder validates field compatibility with the selected visualization type.

**Grouping and Aggregation**
Group by any categorical field. Aggregate numeric fields: sum, average, min, max, count.

**Saved Reports**
Custom reports are saved with a name, description, and access level (Private, Team, Organization). Saved reports appear in the report library alongside standard reports and can be scheduled for delivery.

**Report Preview**
A live preview renders while the user configures the report, showing the first 20 rows. The final run processes the full dataset.

---

## Data Warehouse Integration

For agencies with enterprise BI platforms, Maintain provides a read-only data API designed for BI tool integration.

### Connector Architecture

Maintain exposes an OData v4 endpoint at /api/v1/odata/ that is directly connectable from:
- Power BI (native OData connector)
- Tableau (web data connector)
- Qlik Sense (REST connector)
- Excel Power Query

The OData endpoint exposes read-only views of core entities: Assets, Inspections, ConditionRecords, CapitalPlanProjects, WorkOrders, RiskScores. All endpoints are tenant-scoped and require authentication with a dedicated API key separate from user JWT tokens.

### Incremental Refresh Support

For large datasets, the OData endpoint supports delta queries using UpdatedAt filtering, enabling BI tools to fetch only changes since the last refresh rather than re-fetching the full dataset.

---

## Future Evolution

**Report Sharing and External Publishing**
Publish a report as a secure public link with an expiry date, shareable with a state transportation official, board member, or community member without requiring a Maintain login.

**Narrative Report Builder**
Combine data visualizations with AI-generated narrative paragraphs to produce complete, printable reports for board presentations.

**Cross-Tenant Benchmarking Reports**
For agencies that opt into the benchmarking program: standardized comparison reports showing the agency KPIs against anonymized peer group medians.

**Real-Time Streaming Reports**
For operational dashboards requiring second-by-second updates, streaming reports using server-sent events replace the polling model.
