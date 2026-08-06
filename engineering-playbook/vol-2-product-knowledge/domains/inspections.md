# Domain: Inspections

## Purpose

Inspection data is the primary source of condition information in the Aurigo platform. Every deterioration model, every capital needs calculation, every risk score, and every TAMP report depends on current, accurate, standardized condition inspection data. The inspection domain exists to make it as easy as possible for field inspectors to record high-quality condition data and as easy as possible for engineers to review, approve, and use that data.

The inspection domain must accommodate a wide range of inspection types, methodologies, and rating scales — from a field inspector doing a visual walk-through of culverts to a certified bridge inspector conducting a National Bridge Inspection Standards (NBIS) level inspection. It must work on mobile devices in areas with no connectivity. It must support photo and video evidence. And increasingly, it must support AI-assisted defect detection that helps inspectors identify and classify defects faster and more consistently.

## Business Value

**Condition data currency:** The value of every AI-based capital planning recommendation is directly proportional to the freshness and accuracy of the inspection data. Stale inspection data (a 5-year-old condition rating on a bridge) produces unreliable deterioration model outputs. Current inspection data (within the required inspection cycle) produces reliable outputs. The inspection domain makes it easy to keep condition data current.

**Regulatory compliance:** For public agencies, inspection compliance is a regulatory requirement. NHS bridges must be inspected on a 24-month cycle per NBIS. FAA requires airports to inspect pavement on defined schedules. FTA requires transit agencies to inspect vehicle and facility condition. The inspection domain tracks compliance against required inspection cycles and flags assets that are approaching or overdue.

**Defensible condition data:** When an agency presents condition data to FHWA, the state legislature, or a court, the data must be defensible. Defensibility requires: standardized rating scales, documented inspector credentials, time-stamped records with GPS confirmation, and photographic evidence. The inspection domain captures all of these elements automatically.

## Inspection Types

### Routine / Drive-by Inspection

A periodic visual inspection conducted by maintenance staff during normal operations. The purpose is not to record a formal condition rating but to identify defects that require immediate attention or scheduling for detailed inspection. Routine inspections are logged in Maintain as observation records; they may update the condition score if the observation reveals a significant change.

**Frequency:** Typically monthly to quarterly, depending on asset class and condition.
**Who conducts:** Maintenance staff, road patrol, field technicians.
**What is recorded:** General condition observation, identified defects with location, photos, recommended action (none, schedule inspection, emergency response).

### Detailed / Level 2 Inspection

A formal condition assessment using the applicable rating scale for the asset class. The detailed inspection produces a numerical condition score that is used in the deterioration model and capital needs calculation.

**Frequency:** Annual to biennial, per the required inspection cycle for the asset class.
**Who conducts:** Trained inspectors with asset-class credentials (bridge inspection certification for bridges, pavement survey technician training for pavement, etc.).
**What is recorded:** Complete condition ratings for all elements of the rating scale, defect inventory with quantity and severity, photos of each rated element, recommendations.

### NBIS Bridge Inspection

A federally mandated inspection conducted by certified bridge inspection teams under the National Bridge Inspection Standards. NBIS inspections require Team Leaders with FHWA-recognized qualifications, specific documentation, and review by a qualified engineer.

**Frequency:** Maximum 24 months; fracture-critical bridges require annual inspection; underwater components have additional requirements.
**Who conducts:** NBIS-certified Team Leader plus inspection team.
**What is recorded:** All NBI condition items (1-9 scale for deck, superstructure, substructure, channel, culvert), sufficiency rating calculation, underwater inspection results, special inspection recommendations, Team Leader certification.

### Emergency / Event-Driven Inspection

Triggered by an event: flooding, traffic incident, reported distress, or proximity to a construction project. Records the condition immediately after the event and recommends whether normal use can continue or restrictions are required.

**Frequency:** As needed.
**Who conducts:** First available qualified inspector; for bridges, NBIS certification required if full NBI re-rating is conducted.
**What is recorded:** Date and time of event, event type, condition findings, before/after photos, operational recommendation (no restriction, load restriction, closure).

## Condition Rating Scales

The inspection domain supports multiple rating scales, with normalization to the internal 0-5 scale for consistency:

| Rating Scale | Range | Used For | Normalized Formula |
|-------------|-------|----------|-------------------|
| Aurigo Internal | 0-5 | General civil assets | Direct (no conversion) |
| NBI (National Bridge Inspection) | 0-9 per element | Bridges | NBI_score × (5/9) |
| Sufficiency Rating | 0-100 | Bridge overall | SR × (5/100) |
| PASER | 1-10 | Local pavement | (PASER - 1) × (5/9) |
| IRI (International Roughness Index) | 0+ (lower = better) | Highway pavement | 5 - min(IRI/200, 5) |
| PCI (Pavement Condition Index) | 0-100 | Airport/urban pavement | PCI × (5/100) |
| PACP | 0-5 per defect code | Wastewater pipes | Direct equivalent |

The normalized score is used for internal calculations (deterioration model, risk score, capital needs). The original scale value is always stored and displayed in the UI, so engineers see the familiar scale for their asset class.

## Mobile Inspection Workflow

The mobile inspection experience is the most user-facing capability in the inspection domain. A poor mobile experience means inspectors don't use the tool, which means inspections are recorded on paper and entered later (or not at all). A good mobile experience increases adoption, improves data freshness, and reduces transcription errors.

**Offline-first architecture:** The mobile inspection form must work completely offline. Inspectors frequently work in areas with no cellular coverage — remote bridges, rural culverts, underground pipes. All inspection data (including photos) is stored locally and synced when connectivity returns.

**Workflow:**
1. Inspector opens the inspection queue on their device (downloaded during the morning when connectivity was available)
2. Travels to the first asset; GPS location is compared to the asset's recorded location to confirm identity
3. Opens the inspection form for the asset class
4. Records condition ratings by element, using the applicable rating scale
5. Photographs defects (photos are automatically tagged with asset ID, inspector ID, timestamp, GPS coordinates)
6. Adds text notes and recommended actions
7. Marks inspection as complete (saves locally)
8. Moves to next asset
9. At end of day (or when connectivity restored), taps "Sync" — all queued inspections and photos upload
10. Sync confirmation shows records uploaded, any upload errors, and records pending supervisor review

**AI-assisted defect detection:**
The mobile app includes an optional AI model that analyzes photos taken during inspection and suggests defect classifications. When the inspector photographs a pavement surface, the AI identifies crack patterns (alligator cracking, transverse cracking, rutting) and suggests the PASER rating based on the visible condition. The inspector can accept or override the AI suggestion. All AI suggestions are logged with the inspector's action (accepted/overridden) for model improvement.

## Inspector Credentials and Certification

The inspection domain tracks inspector credentials for compliance purposes:

- **NBIS Certification:** Required for bridge inspection Team Leaders. Certification includes the certifying body, certification date, and expiration date. The system warns when a Team Leader's certification is within 90 days of expiration.
- **Training records:** For agencies that use role-based inspection authorization, the system tracks completed training courses and certification expiration for each inspector role.
- **Inspection history:** Every inspection record is linked to the inspector (user ID). Inspection history is used for FHWA audit purposes.

## User Stories

1. **As a Field Inspector**, I want to record a culvert inspection from my phone without internet connection, including photos and GPS location, so that I can complete inspections in remote areas without returning to the office.

2. **As a Bridge Inspection Team Leader**, I want to record all NBI condition items for a bridge, with element-level photos, and submit the record for my supervisor's review and approval so that the inspection meets NBIS documentation requirements.

3. **As an Inspection Supervisor**, I want to review submitted inspection records and approve or return them for revision so that only reviewed, approved records are used for capital planning and TAMP compliance.

4. **As an Asset Manager**, I want to see which assets are overdue for inspection (past the required inspection cycle) so that I can prioritize the inspection schedule to address compliance gaps.

5. **As a Field Inspector**, I want the AI to suggest defect classifications based on my photos so that condition recording is faster and more consistent across inspectors.

6. **As an Asset Manager**, I want to compare condition scores across multiple inspections for the same asset over time so that I can see the deterioration trend and validate the deterioration model.

7. **As an Inspection Coordinator**, I want to assign assets to inspectors for the upcoming inspection cycle and track completion status so that I know when the cycle is complete.

8. **As a State DOT Asset Manager**, I want to export the inspection records for all NHS bridges in the past 24 months in the NBI-compatible format so that I can submit the annual NBI data file to FHWA.

## Business Rules

1. **NBIS inspection cycle enforcement:** NHS bridges that have not had an approved inspection within 24 months (12 months for fracture-critical bridges) are flagged as "Inspection Overdue" and appear as red on the network map.

2. **Inspector credential validation:** For inspection types that require specific credentials (NBIS certification, licensed engineer), the system validates that the recording inspector holds the required credential before allowing the inspection to be submitted.

3. **Inspection cannot be backdated more than 90 days without approval:** Inspections recorded with a date more than 90 days in the past require supervisor approval and a documented reason for the delayed entry.

4. **Condition score change threshold triggers review:** If a new inspection records a condition score that is more than 1.0 points lower than the prior approved inspection (indicating rapid deterioration), the inspection is automatically flagged for supervisor review before it is used in the deterioration model.

5. **Photos required for below-threshold condition:** For assets where the condition score is below the alert threshold, at least one photo is required per rating element rated below 3. This provides the evidence base for capital investment decisions.

6. **Supervisor approval required for NBIS:** NBIS bridge inspections cannot be used for NBI reporting or TAMP compliance until they are approved by the qualified engineer review. The supervisor approval is stored with the inspection record.

7. **Inspection records are immutable after approval:** Once an inspection is approved, the condition score and rating data cannot be changed. Corrections require creating a new inspection record with a note referencing the correction.

## Integration Points

- **Asset Management Domain:** Inspections are linked to assets. A new approved inspection updates the asset's current condition score and condition date.
- **Deterioration Model:** Approved inspections are the primary training data for the deterioration model. The model is recalibrated when the number of new inspections since the last calibration crosses a threshold.
- **Mobile Domain:** The offline inspection workflow is implemented in the mobile PWA. The sync mechanism transfers inspection records and photos to the Maintain backend.
- **AI Domain:** The AI-assisted defect detection model in the mobile app is an AI domain capability; the inspection domain calls the AI API and records the suggestion and the inspector's response.

## Future Evolution

- **Drone inspection integration:** High-resolution drone imagery processed by AI defect detection model, generating inspection records for inaccessible or large-area assets
- **LiDAR point cloud condition assessment:** 3D scan data from mobile LiDAR used to assess pavement rutting and surface defects at the network level
- **Real-time video inspection:** Integration with sewer inspection camera systems (CCTV) for automated PACP coding from video
- **Wearable integration:** Smart glasses that display asset information and allow voice-recorded inspection notes, keeping the inspector's hands free

---

## Per-Asset-Class 0–5 Rating Scale Definitions

The Aurigo internal 0–5 scale is the normalization target across all rating systems. Below are the precise definitions per asset class. These are used in the mobile UI's "quick rating" mode, in the deterioration model's default thresholds, and in the API contract for condition ingestion.

### Bridge (normalized from NBI Items 58/59/60)

| Score | Label | NBI equivalent | Description |
|-------|-------|----------------|-------------|
| 5.0 | Excellent | 9 | Newly constructed / no defects |
| 4.0 | Good | 7–8 | Some minor deterioration; no impact on function |
| 3.0 | Fair | 5–6 | Minor to moderate deterioration; monitor closely |
| 2.0 | Poor | 3–4 | Advanced deterioration; primary structural elements affected; **structurally deficient threshold** |
| 1.0 | Serious | 2 | Section loss, deterioration, or spalling seriously affecting primary structural components |
| 0.0 | Failed / Critical | 0–1 | Failure imminent; corrective action required |

### Highway Pavement (normalized from IRI + cracking)

| Score | Label | IRI equivalent (in/mi) | Description |
|-------|-------|------------------------|-------------|
| 5.0 | New | < 60 | Newly paved; smooth ride, no cracking |
| 4.0 | Good | 60–95 | Ride quality high; light cracking only |
| 3.0 | Fair | 95–170 | Noticeable ride degradation; longitudinal + transverse cracking |
| 2.0 | Poor | 170–250 | Rough ride; alligator cracking; rutting > 0.4 in |
| 1.0 | Very Poor | 250–400 | Reconstruction candidate |
| 0.0 | Failed | > 400 | Impassable; emergency repair |

### Local Pavement (from PASER 1–10)

| Score | PASER | Description |
|-------|-------|-------------|
| 5.0 | 10 | Excellent — brand new |
| 4.0 | 8–9 | Very Good / Good — sealed cracks; minor issues |
| 3.0 | 6–7 | Fair — general cracking; distortion |
| 2.0 | 4–5 | Poor to Very Poor — patching; alligator cracking |
| 1.0 | 2–3 | Very Poor to Failed — general failures |
| 0.0 | 1 | Failed — reconstruction required |

### Culvert (visual, 5-point)

| Score | Description |
|-------|-------------|
| 5.0 | New / no defects |
| 4.0 | Minor sedimentation or debris; no structural concerns |
| 3.0 | Moderate sediment; minor structural distress (deformation < 10%) |
| 2.0 | Significant blockage OR structural deformation 10–25%; leaking joints |
| 1.0 | Major deformation > 25%; roadway distress above; overtopping frequent |
| 0.0 | Failed — collapse in progress or high flood risk |

### Sign (based on retroreflectivity + physical)

| Score | Retro (cd/lux/m²) | Description |
|-------|-------------------|-------------|
| 5.0 | > 250 | New; retroreflectivity full |
| 4.0 | 150–250 | Good; slight fading |
| 3.0 | 100–150 | Fair; approach FHWA minimum retro |
| 2.0 | Below FHWA minimum | Non-compliant per MUTCD; requires replacement |
| 1.0 | Bent/damaged, retro compromised | Immediate replacement |
| 0.0 | Missing or destroyed | Emergency replacement |

### Signal (age + component condition)

| Score | Description |
|-------|-------------|
| 5.0 | New controller, LEDs, detection all < 5 years |
| 4.0 | Controller 5–10 years; components serviceable |
| 3.0 | Controller 10–15 years; ITS integration limited |
| 2.0 | Controller 15+ years; ATC standard incompatible |
| 1.0 | Controller obsolete; parts unavailable |
| 0.0 | Failed; safety concern |

### Water Main (age + material + failure history)

| Score | Description |
|-------|-------------|
| 5.0 | < 25% of design life; no leaks; corrosion protection intact |
| 4.0 | 25–50% design life; no leak history; minor tuberculation |
| 3.0 | 50–75% design life OR 1 leak history in trailing 5 yr |
| 2.0 | 75–100% design life OR 2 leak history in trailing 5 yr |
| 1.0 | Past design life; multiple leaks; consider replacement |
| 0.0 | Failed — active leak requiring emergency repair |

### Wastewater Main (PACP-derived)

| Score | PACP peak score | Description |
|-------|-----------------|-------------|
| 5.0 | 1 | Minor observations only |
| 4.0 | 2 | Cosmetic defects; no structural issue |
| 3.0 | 3 | Moderate; monitor |
| 2.0 | 4 | Severe; likely to fail 5–10 years |
| 1.0 | 5 | Immediate failure risk |
| 0.0 | Collapsed / offline | Emergency work |

### Data Center Generator (operating-hour + Weibull)

| Score | Description |
|-------|-------------|
| 5.0 | New — < 500 hours OR just overhauled |
| 4.0 | Normal wear; < 60% of overhaul interval; passing load tests |
| 3.0 | Approaching overhaul (60–90%); load test margin low |
| 2.0 | Past overhaul interval OR failing load test criteria |
| 1.0 | Critical — starting reliability degraded |
| 0.0 | Failed to start on test; do-not-dispatch |

### UPS Battery String (float voltage + capacity)

| Score | Description |
|-------|-------------|
| 5.0 | New; capacity 100%; float voltage nominal |
| 4.0 | Capacity 90–100%; float voltage within 2% of nominal |
| 3.0 | Capacity 80–90%; monitor closely |
| 2.0 | Capacity 70–80% — replacement window opens |
| 1.0 | Capacity < 70% — immediate replacement scheduled |
| 0.0 | Failed capacity test — offline pending replacement |

### Production Equipment (OEE-derived)

| Score | OEE trailing 90-day | Description |
|-------|---------------------|-------------|
| 5.0 | > 85% | Best-in-class |
| 4.0 | 75–85% | Good |
| 3.0 | 65–75% | Average |
| 2.0 | 50–65% | Poor — investigate |
| 1.0 | 35–50% | Very poor — capital case |
| 0.0 | < 35% | Failed — economic replacement |

### Life Sciences Manufacturing Equipment (qualification-linked)

| Score | Description |
|-------|-------------|
| 5.0 | Fully qualified; within trend on process capability metrics |
| 4.0 | Fully qualified; minor variance; monitor |
| 3.0 | Fully qualified but periodic review due within 30 days |
| 2.0 | Requalification triggered; asset flagged |
| 1.0 | Deviation report open; production suspended |
| 0.0 | Failed OQ/PQ; asset out of service |

---

## Standard Compliance Reference

| Standard | Full name | Where used | Aurigo module |
|----------|-----------|-----------|---------------|
| NBI | National Bridge Inventory (FHWA) | Federal bridge inspection | `NbiInspectionSchema` |
| NBIS | National Bridge Inspection Standards (23 CFR § 650) | Bridge inspection process | `NbisComplianceCheck` |
| PASER | Pavement Surface Evaluation and Rating (Wisconsin TIC) | Local agency pavement | `PaserRating` |
| IRI | International Roughness Index (ASTM E1926) | Highway pavement | `IriMeasurement` |
| PCI | Pavement Condition Index (ASTM D6433) | Airport / municipal pavement | `PciRating` |
| PACP | Pipeline Assessment and Certification Program (NASSCO) | Wastewater CCTV | `PacpDefectCoding` |
| MACP | Manhole Assessment and Certification Program (NASSCO) | Manholes | `MacpAssessment` |
| LACP | Lateral Assessment and Certification Program (NASSCO) | Lateral pipes | `LacpAssessment` |
| AASHTO PMS | AASHTO Guide for Pavement Management Systems | Broad pavement | `AashtoPmsMapping` |
| MUTCD | Manual on Uniform Traffic Control Devices | Signs, markings, signals | `MutcdRetroreflectivityCheck` |
| PONTIS | Bridge element-level condition (element states 1–4) | State DOT bridges | `PontisElementRating` |
| BMS | Bridge Management System element condition | Various DOTs | `BmsElementRating` |
| PMS | Pavement Management System | State pavement | `PmsIntegration` |

Every rating scale in the mobile app must include a link to its authoritative source document. This is required for FHWA and FAA audit purposes.

---

*See also: [Asset Management Domain](asset-management.md) | [Mobile Domain](mobile.md) | [AI Domain](ai.md)*
