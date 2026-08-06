# Research Agenda — Aurigo Maintain

## Purpose

This document defines the active research questions Aurigo engineering should investigate over the next 3–5 years. These are not feature requests or product backlog items. They are open questions where the answer is not known, where Aurigo has a unique position to answer them better than anyone else, and where the answer — if found — would create substantial product or strategic value.

Each research area is described along the same framework: the research question, why it matters, the current state of the art, Aurigo's unique data advantage, the research approach, the success metric, and the time horizon.

Research investments do not require a large dedicated team. Most of these areas can be advanced by one or two engineers devoting 20% of their time to a focused investigation, using Aurigo's production data (with customer consent) as the substrate. When an area produces a promising result, it becomes a roadmap item. When an area proves intractable or low-value, it is closed with a findings note.

---

## Research Area 1: Foundation Models for Infrastructure

**Research Question:** Can a domain-specific foundation model pre-trained on infrastructure inspection data outperform general-purpose vision and language models on infrastructure condition assessment tasks?

**Why It Matters:** Current approaches to AI in infrastructure rely on fine-tuning general-purpose models (GPT-4V, CLIP, ViT) on labeled infrastructure data. General-purpose models are trained primarily on consumer images and text. Infrastructure inspection has a fundamentally different visual vocabulary: concrete spalling does not appear in ImageNet, NBI defect codes do not appear in Wikipedia, and bridge geometry is unlike anything in the LAION dataset. A model pre-trained specifically on infrastructure inspection images and reports might need far less labeled data to reach a given accuracy level — which would dramatically lower the cost and time required to add new asset classes to the AI pipeline.

**Current State of the Art:** The research literature has domain-specific vision models for medical imaging (RadDINO, BiomedCLIP) that significantly outperform general-purpose models on medical tasks with the same fine-tuning data. There is limited published work on infrastructure-specific foundation models. StructuralGPT (2024, Purdue) showed promising results on bridge inspection report generation but used a small labeled dataset. There is no publicly available large-scale infrastructure inspection foundation model.

**Aurigo's Unique Data Advantage:** Aurigo will accumulate inspection photos, defect annotations, condition ratings, and inspection narrative text from hundreds of agencies across millions of assets. This corpus is unique: it spans multiple asset classes, multiple climate zones, multiple inspection methodologies, and multiple inspector styles. No academic group has access to a dataset of this breadth and scale. The corpus, once sufficiently large, is the training data for an infrastructure foundation model.

**Research Approach:** Phase 1 — characterize the existing corpus (how many images? how many unique defect types? how is the corpus distributed across asset class, climate, condition level?). Phase 2 — establish a benchmark: define 5 representative evaluation tasks (defect classification, severity scoring, condition rating prediction from narrative, anomaly detection from time-series photos). Evaluate GPT-4V, CLIP-ViT, and the current Maintain fine-tuned models on these benchmarks. Phase 3 — pre-training experiment: using a subset of 1M+ images, pre-train a ViT (Vision Transformer) from scratch on the infrastructure corpus using masked image modeling (MAE). Fine-tune on each benchmark task and compare against the Phase 2 baselines. Publish results (positive or negative).

**Success Metric:** The infrastructure-specific foundation model achieves accuracy on the 5 benchmark tasks that is ≥ 10 percentage points better than the best fine-tuned general model, at the same fine-tuning data budget. If the improvement is less than 10pp, the research question is answered (general models are sufficient) and domain pre-training is not worth the cost at current data volumes.

**Time Horizon:** 2–3 years. Phase 1 can begin immediately. Phase 3 requires sufficient labeled data, which requires production deployment at scale. Earliest meaningful Phase 3 results: 18–24 months post-GA.

---

## Research Area 2: Graph Neural Networks for Cascading Infrastructure Risk

**Research Question:** Do Graph Neural Networks trained on road and bridge network topology improve risk ranking accuracy compared to independent asset risk models, measured against actual failure and emergency closure events?

**Why It Matters:** Infrastructure failures have network effects. A bridge closure diverts traffic to secondary routes, increasing load on those routes and accelerating their deterioration. An emergency road closure affects medical response times for surrounding communities. Risk models that treat assets independently miss these cascading effects and systematically underrank high-criticality assets. If GNNs can learn to propagate risk through the network topology, they would produce risk rankings that better align with the actual economic and safety consequences of failure — leading to better-prioritized capital plans.

**Current State of the Art:** GNNs for transportation network analysis are an active research area. Recent work (2023–2025) has used GNNs to model traffic flow, predict travel times, and detect anomalies in sensor networks. There is limited work on using GNNs specifically for infrastructure risk ranking. A 2024 paper from MIT Lincoln Laboratory used GNN-based risk propagation for power grid resilience, with promising results. Direct application to road and bridge networks is unexplored in the published literature.

**Aurigo's Unique Data Advantage:** The combination of geospatial asset records (roads and bridges with precise coordinates) and inspection condition data is the input required to build infrastructure network graphs. Aurigo has both. Adding publicly available road network topology (TIGER/Line from US Census Bureau) and traffic count data (FHWA HPMS) creates a rich graph substrate for GNN training. The validation signal — actual emergency closures and failure events — is available from state DOT open data portals and news archives.

**Research Approach:** Construct a road network graph for a pilot state DOT (Texas or Virginia, which have rich open data). Nodes: bridges and pavement segments with current condition and RUL as node features. Edges: road connectivity with traffic volume and route classification as edge features. Train a Graph Attention Network (GAT) or GraphSAGE model to predict a node's risk score, with the training signal derived from historical closure events. Compare the GNN risk rankings against: (1) Maintain's current independent risk score, (2) the traditional FHWA sufficiency rating. Use leave-one-year-out cross-validation to evaluate predictive accuracy.

**Success Metric:** GNN risk ranking correctly identifies 80% of assets that experienced emergency closures in the held-out year in the top 20% of the risk ranking, versus 60% for the independent risk model (baseline). If the improvement is less than 10 percentage points, the research question is answered and the additional complexity of GNNs is not justified for standard risk scoring.

**Time Horizon:** 18 months. Does not require production deployment — can be conducted on public DOT data. Engineering effort: one ML engineer, half time for 12 months.

---

## Research Area 3: Federated Learning Protocol Design

**Research Question:** What federated learning protocol minimizes model accuracy loss due to data heterogeneity while satisfying the privacy and regulatory constraints of US state government agencies?

**Why It Matters:** Federated learning is the mechanism for training globally improved models without centralizing sensitive government data. But standard federated averaging (FedAvg) performs poorly when client data is non-IID (non-independently and identically distributed). Infrastructure inspection data across agencies is highly non-IID: a northern climate zone DOT's pavement deterioration patterns are very different from a southern climate zone DOT's. Naive federated averaging over heterogeneous clients produces a global model that is worse for each individual client than a model trained on that client's data alone — which destroys the value proposition of federation.

**Current State of the Art:** Federated learning with non-IID data is an active area. FedProx, SCAFFOLD, FedNova, and clustered federated learning (CFL) have shown improvements over FedAvg on heterogeneous data. Personalized federated learning (pFL) maintains per-client model variants while benefiting from shared learning. The state-of-the-art for highly heterogeneous settings is FLUTE (Microsoft Research, 2022) and pFedMe. None of these have been evaluated specifically on infrastructure condition data.

**Aurigo's Unique Data Advantage:** Maintain can run controlled federated learning experiments using real customer data (with consent) across agencies with known metadata (climate zone, asset mix, inspection methodology). This enables evaluation of federated protocols in a realistic (not just academic) setting where data heterogeneity is real, known, and structured.

**Research Approach:** Simulate federated learning over a partition of the Maintain inspection dataset where partitions represent agencies. Implement and evaluate four protocols: FedAvg (baseline), FedProx (proximal regularization), Clustered Federated Learning (group agencies by climate zone), and pFedMe (personalized federated). Primary metric: condition prediction RMSE on each agency's held-out test set. Secondary metric: training rounds to convergence. Regulatory constraint simulation: vary the frequency and noise level of gradient sharing to simulate differential privacy guarantees and measure accuracy impact.

**Success Metric:** At least one non-FedAvg protocol achieves condition prediction RMSE within 5% of centralized training RMSE (the theoretical upper bound), while providing differential privacy guarantees sufficient to satisfy a representative state government privacy assessment. If no protocol achieves within 5% of centralized training, the research question is answered: federated learning is not sufficiently accurate for this use case at current data volumes, and Maintain should use anonymized central training with contractual controls instead.

**Time Horizon:** 2 years. This requires production data at sufficient scale — meaningful results are likely 12–18 months post-GA.

---

## Research Area 4: Causal AI for Maintenance Decisions

**Research Question:** Using observational inspection panel data, can Maintain estimate the causal effect of maintenance interventions (preventive maintenance, rehabilitation, replacement) on asset condition trajectories — and are those estimates stable enough to use in capital plan optimization?

**Why It Matters:** Capital plan optimization requires an estimate of how much life extension a given maintenance intervention provides. Currently, Maintain uses literature estimates (from FHWA and AASHTO research). Literature estimates are averages across thousands of projects in contexts that may not match a specific agency's assets, climate, or construction quality. If Maintain can estimate intervention effects from the agency's own data — a causal estimate that accounts for confounding — the capital plan optimizer becomes dramatically more accurate. The economic value of a 1-year improvement in the accuracy of useful life extension estimates, across a 100-asset portfolio, is millions of dollars in correctly timed interventions.

**Current State of the Art:** Causal inference from observational data in infrastructure management is nascent. A 2023 paper (Elsevier Infrastructure Management) used difference-in-differences to estimate the effect of preventive overlay on pavement life using MnDOT data. Results were promising but the dataset was small (N=142 treated segments). The general causal inference literature (Imbens and Rubin 2015, Pearl 2018) provides the methodological framework. Applying it to panel inspection data is straightforward in principle; the challenge is data quality (missing inspections, variable inspection intervals, imprecise treatment records).

**Aurigo's Unique Data Advantage:** Maintain collects inspection records with timestamps and EAM integration captures maintenance activity (work orders) from connected systems. This means Maintain can construct a treatment panel: for each asset, the observation sequence is {condition before treatment, treatment type, condition after treatment} with associated covariates. As inspection and EAM data accumulates, the sample size for causal analysis grows. Within 3–4 years of production deployment, Maintain should have sufficient panel data for well-powered causal estimates for common treatment types (preventive overlay, crack sealing, bridge deck repair).

**Research Approach:** Use doubly-robust causal inference (combining propensity score weighting and outcome regression for robustness to model misspecification). Construct a panel from Maintain data: the unit is an asset-inspection-cycle, the treatment is whether a maintenance intervention occurred between inspection cycles, and the outcome is the difference between expected condition (from the deterioration model) and observed condition after treatment. The causal estimate is the average treatment effect on the treated (ATT): how much did the treatment improve condition relative to what would have happened without it? Validate against the 10 published studies that have estimated similar effects using independent data.

**Success Metric:** Causal estimates are stable (confidence intervals do not change by more than 20% with the addition of 6 months of new data), directionally consistent with published literature, and statistically significant at p < 0.05 for at least three treatment types (preventive overlay, joint sealing, bridge deck repair). If estimates are unstable, the sample size is insufficient for causal inference and literature values should continue to be used.

**Time Horizon:** 2–4 years. Requires substantial production data with matched inspection and EAM records. Meaningful estimates are possible 18–24 months post-GA for agencies with 3+ years of data and connected EAM.

---

## Research Area 5: Natural Language to Capital Plan

**Research Question:** Can a planning agent accurately translate a policy statement expressed in natural language into a formal capital plan optimization problem — and produce a capital plan that a qualified engineer would accept without significant modification?

**Why It Matters:** The NL-to-capital-plan capability is the most powerful democratization of asset management: it would allow a county public works director, without a dedicated capital planning staff or consultant, to generate a capital plan that meets federal requirements. The economic opportunity is enormous — there are 3,000+ counties in the US, most without dedicated asset management staff. The technical challenge is the translation step: policy language is ambiguous, context-dependent, and often implicitly references regulatory requirements that must be made explicit.

**Current State of the Art:** Large language models can translate natural language to SQL (NL2SQL, BIRD benchmark), to code (Codex, GitHub Copilot), and to structured queries in domain-specific languages. These are semantically constrained domains (SQL has a well-defined grammar). Natural language to optimization problem (NL2OPT) is a harder problem: the output is not a query but a set of constraints and an objective function that must be computationally valid and semantically correct. Preliminary NL2OPT research (2024, NeurIPS workshop) shows that GPT-4 can correctly formulate 60–70% of optimization problems from natural language in well-constrained academic domains. Infrastructure capital planning is a more complex domain.

**Aurigo's Unique Data Advantage:** Maintain has the optimization engine and the domain knowledge (deterioration models, cost data, regulatory constraints). The research question is specifically about the translation layer — can an LLM bridge from policy language to the capital plan optimizer's input format? Aurigo can create a benchmark: collect 100 actual capital planning policy statements from state DOT capital program documents, manually translate them into formal optimization constraints, and evaluate whether the LLM translation matches the manual translation.

**Research Approach:** Build a benchmark of 100 capital planning policy statements with manually generated ground-truth constraint sets. Evaluate GPT-4o, Claude Opus, and a fine-tuned smaller model on the benchmark. Measure: constraint precision (are all generated constraints correct?), constraint recall (are all required constraints generated?), and plan quality (does the plan generated from the LLM constraints match the plan generated from the ground-truth constraints on key metrics: total cost, asset count treated, portfolio condition at year 10?). Iterate on prompt engineering and fine-tuning based on error analysis.

**Success Metric:** The planning agent correctly translates 80% of policy statements into constraint sets that produce capital plans within 5% of the ground-truth plan on the three key metrics. For the remaining 20%, the agent correctly identifies the ambiguity and asks a clarifying question that a domain expert would recognize as necessary. Autonomous plan generation (no clarification needed) reaches 80% accuracy; total accuracy (with one clarification round) reaches 95%.

**Time Horizon:** 1–2 years. Does not require production data at scale — can be benchmarked from public capital planning documents. A prototype is achievable in 6 months; production accuracy requires iteration.

---

## Research Area 6: Digital Twin Data Architecture

**Research Question:** What data architecture enables real-time state synchronization for infrastructure digital twins at a scale of 10,000 assets per agency, with sub-second update latency for sensor data, without compromising query performance for capital planning analytics?

**Why It Matters:** The digital twin (Innovation #1) requires continuous state updates from sensors, drone surveys, and manual inspections. The update frequency ranges from seconds (strain sensors on a monitored bridge) to annually (standard inspection cycle). The query patterns range from real-time dashboarding (current sensor readings, current alarm state) to long-horizon analytics (10-year capital plan, TAMP). No single database architecture handles all of these optimally — time-series databases are fast for sensor ingestion but poor for relational queries; PostgreSQL is excellent for relational analytics but cannot ingest high-frequency sensor data without write amplification.

**Current State of the Art:** The data architecture for IoT digital twins in manufacturing (GE Predix, Siemens MindSphere, PTC ThingWorx) uses a lambda architecture: real-time stream processing for current state, batch processing for historical analytics. Newer approaches (Kappa architecture, Delta architecture) use a unified event log for both streaming and batch. For infrastructure specifically, there is limited published research on the data architecture at scale. Industrial IoT architectures are the closest analogy but assume much higher sensor density than civil infrastructure will ever have.

**Aurigo's Unique Data Advantage:** Maintain already has the inspection record and condition data layer. The research question is specifically about extending the architecture to handle sensor time-series data without disrupting the existing analytics performance. Aurigo can prototype with a small SHM sensor dataset (even publicly available data from monitored bridges) and measure the impact on query performance before committing to an architecture.

**Research Approach:** Prototype three architectures for the time-series + relational hybrid problem: (1) Dual store: InfluxDB for sensor data + existing PostgreSQL for analytics, with an ETL job bridging them; (2) TimescaleDB: PostgreSQL extension that handles time-series data natively, potentially unifying the stores; (3) Apache IoTDB: purpose-built for industrial IoT with SQL interface. Benchmark each architecture on: ingest throughput (target: 10K readings/second per agency), query latency for real-time sensor reading (target: < 100ms P99), and query latency for historical analytics (target: < 2s P99 for a 10-year capital plan query over 100K assets).

**Success Metric:** One architecture meets all three performance targets simultaneously at the target scale (10K assets, 10M sensor readings/day). If no architecture meets all three, identify the architectural trade-off and recommend a decision (which target to relax and by how much).

**Time Horizon:** 12–18 months for prototype and benchmarking. Architecture selection can inform the Phase 3 (Prescriptive AI) roadmap without waiting for full results.

---

## Research Area 7: Computer Vision for Infrastructure Defect Detection

**Research Question:** What accuracy level is required for AI-based infrastructure defect detection to produce net economic value — and what is the minimum training dataset size to achieve that accuracy for the highest-value defect categories?

**Why It Matters:** Before investing heavily in computer vision for defect detection, Aurigo needs a clear answer to whether it will be useful in practice. An AI model that achieves 70% precision and recall on pavement crack detection sounds impressive — but if it produces so many false positives that inspectors spend more time reviewing incorrect suggestions than it saves, the net value is negative. The threshold question is: what precision and recall are required, for which defect categories, to produce a positive net economic value for a real agency?

**Current State of the Art:** The computer vision literature for infrastructure defect detection has many published models achieving > 90% accuracy on benchmark datasets. However, benchmark datasets are typically clean, well-lit, professionally photographed. Field conditions are different: smartphone cameras, variable lighting, occlusion by vegetation or water, image motion blur, and inspectors who hold the camera at inconsistent angles. Published accuracy on benchmark datasets overstates real-world performance by 15–25 percentage points in our estimation. Real-world accuracy of deployed commercial systems (Bentley iTwin, Jacobs NCEL, StructuresScan) is not publicly disclosed.

**Aurigo's Unique Data Advantage:** Maintain's inspection photos will be taken by real field inspectors in real field conditions — making them realistic training data. As the dataset grows, Aurigo can train models on realistic data and evaluate them on realistic holdout sets. This is a significant advantage over academic models trained on curated datasets.

**Research Approach:** Part 1 (economic threshold analysis): model the inspection workflow economics. Estimate inspector time spent per defect code entry. Estimate the review time required per AI suggestion at various precision levels. Calculate the break-even precision: at what precision does AI suggestion save more time than it costs in review? Perform this calculation for the 10 highest-frequency defect types across pavement and bridges. Part 2 (dataset size requirements): collect a labeled sample of 1,000 inspection photos per defect category (using Maintain's existing corpus, with active annotation by inspectors). Train models at dataset sizes of 100, 500, 1,000, and 5,000 labeled examples per defect type and plot the accuracy learning curve. Extrapolate to the dataset size required to reach the economic threshold precision.

**Success Metric:** A clear answer to: for which defect categories does AI detection have positive net economic value at achievable accuracy levels? A minimum training set size estimate for each viable category. A go/no-go recommendation for each of the top 10 defect categories — is it worth building the detection model or not?

**Time Horizon:** 12 months. The economic analysis can be completed in 1–2 months. The dataset labeling and model training takes 6–9 months. No new infrastructure required — can use existing SageMaker setup.

---

## Research Area 8: Structural Health Monitoring Sensor Fusion

**Research Question:** What is the minimum sensor configuration (type, placement, sampling rate) that produces a condition signal accurate enough to supplement or extend inspection intervals for bridges, and how should heterogeneous sensor readings be fused into a single condition score?

**Why It Matters:** Bridge inspection is currently required on a 2-year cycle by federal regulation. If SHM sensors can provide continuous condition monitoring between inspection cycles, two outcomes are possible: (1) anomalies are detected earlier (between inspection cycles) improving safety, and (2) for bridges that show stable sensor readings between inspections, the inspection interval could potentially be extended to 4 years with regulatory approval (FHWA has published guidance on risk-based inspection intervals). The economic value of extending inspection intervals for stable bridges is substantial — inspection costs are $3K–$15K per bridge per event.

**Current State of the Art:** SHM research is well-established in academia (ASCE SHM journal, Journal of Bridge Engineering). Practical deployments are limited to high-profile bridges (Confederation Bridge Canada, Stonecutters Bridge Hong Kong). Academic SHM systems typically use accelerometers for modal analysis (natural frequency shift indicates structural change), strain gauges for load response, and corrosion sensors for steel. Sensor fusion approaches range from simple threshold rules (single sensor exceeds limit) to Bayesian sensor fusion (combine multiple sensor streams into a probability distribution over structural condition states). Commercial SHM deployments are predominantly proprietary and not published.

**Aurigo's Unique Data Advantage:** Maintain's inspection records provide the ground truth for sensor fusion model training: the actual NBI condition rating assigned by a licensed inspector is the label that the sensor-derived condition score should predict. No academic study has access to this ground truth at scale because inspection records are not publicly available at the asset level. Aurigo, with access to both sensor data (from SHM-equipped bridges in the portfolio) and inspection records, can train and validate sensor fusion models against known ground truth.

**Research Approach:** Phase 1 — literature synthesis: identify the best-validated sensor configurations and fusion approaches from the published SHM literature. Define a target condition score (NBI equivalent) and a minimum accuracy threshold (r² ≥ 0.85 against NBI ratings). Phase 2 — pilot deployment: instrument 5–10 bridges across 2–3 Maintain customers with a minimal sensor set (3-axis accelerometer + 4 strain gauges per span + temperature). Collect sensor data for 12 months across 2 inspection cycles per bridge. Train a Bayesian sensor fusion model that outputs a continuous condition score. Validate against NBI ratings assigned independently by licensed inspectors. Phase 3 — minimum sensor analysis: use sensitivity analysis to identify which sensors contribute most to model accuracy. Repeat the validation with progressively sparser sensor sets to find the minimum configuration that maintains r² ≥ 0.85.

**Success Metric:** A published minimum sensor configuration and fusion algorithm that predicts NBI-equivalent condition scores with r² ≥ 0.85 against inspector-assigned ratings, validated on at least 10 bridges over 2+ inspection cycles. A recommendation on whether the sensor-derived condition signal is sufficiently accurate to support regulatory discussion of extended inspection intervals (r² ≥ 0.85 is the threshold for that recommendation — below it, the sensors are supplementary monitoring only, not a substitute for inspection).

**Time Horizon:** 3 years. Phase 1 can begin immediately. Phase 2 requires a customer pilot program with SHM sensor installation (procurement, installation, and one full inspection cycle before validation data is available). Phase 3 follows Phase 2. This is a longer-horizon research area that requires sustained investment and patient capital but has the potential to reshape federal bridge inspection policy — a regulatory moat no competitor can replicate quickly.
