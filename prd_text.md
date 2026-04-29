PRODUCT REQUIREMENTS DOCUMENT
User-Controlled Financial Identity Verification
UCFIV Platform — Version 1.0
Defeating deepfakes, synthetic identities, and credential theft in regulated financial services
Document Status
Draft — For Internal Review
Version
1.0
Date
April 2025
Classification
Confidential
Owner
Product & Engineering
Regulatory Scope
RBI KYC Master Direction 2016 (as amended), DPDP Act 2023, DigiLocker API, Account Aggregator Framework
1. Executive Summary
Financial institutions across India lose an estimated ₹6,400 crore annually to identity fraud, with synthetic identity attacks and AI-generated deepfakes accelerating at rates that outpace legacy KYC controls. Simultaneously, legitimate customers endure 8–14 days of onboarding friction, submit the same documents to every institution, and have no visibility into where their personal data resides.
The User-Controlled Financial Identity Verification (UCFIV) platform resolves both crises through a single cryptographic architecture. Users complete a single, high-assurance verification and receive a tamper-proof Verifiable Credential (VC) stored in an on-device secure enclave. Every subsequent onboarding or re-KYC engagement is fulfilled by selectively disclosing only the attributes the institution requires, with zero-knowledge proofs replacing raw PII wherever a derived claim suffices.
The platform intercepts AI-generated impersonation at the camera layer, executes a multi-modal liveness challenge, and runs a continuous synthetic-identity anomaly engine across velocity, biometric, and graph signals. The result is a system that is simultaneously harder to defraud, faster to onboard through, and more privacy-preserving than the status quo — and that operates on 2G networks and IVR for the 400 million Indians not yet on smartphones.
North Star
A verified Indian resident completes their first KYC once, on any channel, in under 8 minutes — and is onboarded to every subsequent regulated institution in under 60 seconds, without surrendering a single byte of PII they did not explicitly approve.
2. Problem Statement
2.1 Threat Landscape
Three converging fraud vectors have overwhelmed existing KYC controls:
Deepfake impersonation: Open-source diffusion models now generate photorealistic face-swap video at <200ms latency. Legacy passive liveness checks based on 2D texture analysis fail against synthetic video at rates exceeding 30% under adversarial probing.
Synthetic identity fraud: Fraudsters compose identities from real PAN numbers, fabricated Aadhaar-style demographic data, and AI-generated selfies. These identities pass document-matching checks because each fragment is individually authentic; only cross-signal graph analysis reveals the composite.
Credential theft and replay: OTP-based authentication is susceptible to SIM-swap and SS7 interception. Static document scans submitted once are re-used across institutions through injection attacks that bypass camera APIs entirely.
2.2 User Experience Failures
Legitimate users bear disproportionate cost from the current system:
Average KYC onboarding time: 8–14 days across banks, NBFCs, and insurers.
Average document submissions per user per year: 7.2 across institutions for the same underlying identity.
Re-KYC burden: RBI's periodic re-KYC requirement forces full re-submission even when user attributes have not changed.
Exclusion: Rural, low-literacy, and feature-phone users are systematically excluded by video KYC and document upload flows designed for smartphone users.
2.3 Regulatory Gap
Existing frameworks mandate KYC but do not specify interoperability. The result is institutional silos: a customer verified to Full-KYC standard at one bank must repeat the entire process at another. The Account Aggregator framework established consent-based financial data sharing but does not extend to identity credentials. DigiLocker provides document retrieval but does not issue cryptographically verifiable credentials that institutions can verify without a real-time DigiLocker API call.
Impact
₹6,400 Cr / year lost to identity fraud + 185 Mn hours / year lost by customers to redundant KYC — both addressable by a single portable, privacy-preserving identity layer.
3. Goals and Non-Goals
3.1 Goals
Detect and block AI-generated deepfake video, biometric injection, and replay attacks at the point of identity capture.
Issue a W3C-compliant Verifiable Credential to every verified user, stored in a device-resident secure enclave under user-controlled keys.
Enable selective disclosure so users share only the specific attributes each institution needs, replacing raw PII with zero-knowledge proofs wherever a derived claim suffices.
Eliminate redundant KYC: a credential issued by any participating institution shall be accepted for onboarding and re-KYC by all others, subject to consent.
Run a real-time synthetic identity anomaly engine that flags composite identities, velocity abuse, and biometric mismatches before credential issuance.
Support all user segments: smartphone, feature phone (IVR), and assisted (Business Correspondent / CSP agent) flows with equivalent security guarantees.
Comply fully with RBI KYC Master Direction 2016 (amended), DPDP Act 2023, DigiLocker API terms, and the Account Aggregator consent framework.
3.2 Non-Goals
The platform does not store biometric templates centrally. Templates are hashed, salted, and never leave the issuing institution's HSM.
The platform does not provide credit scoring, financial analysis, or any derived insight beyond identity verification.
The platform does not replace Aadhaar authentication. It uses Aadhaar OTP as one input to verification and anchors the resulting credential to the UIDAI-verified identity without re-creating an identity database.
The platform does not expose a public blockchain. Credential verification uses permissioned DID registries accessible only to regulated FIUs.
Cross-border identity portability is out of scope for v1.0.
4. User Personas & Use Cases
4.1 Personas
Persona
Profile
Primary Need
Key Constraints
Priya, 29
Urban salaried, owns 3 bank accounts and a brokerage
One-click onboarding to new fintech; no re-document submission
Privacy-aware; unwilling to share address with every institution
Rajan, 52
Semi-urban trader, Jan Dhan account, feature phone
Open NBFC loan account without travelling to branch
Low literacy; no smartphone; intermittent 2G coverage
Kavya (BC Agent)
Business Correspondent serving 600 rural users
Complete assisted KYC for customers efficiently and compliantly
Limited connectivity; must work offline-first
Ajay, 35 (Fraud Actor)
Synthetic identity fraudster using AI-generated selfies
Bypass liveness checks using deepfake video injection
Blocked at Phase 2 — this is a threat actor, not a user to serve
4.2 Primary Use Cases
UC-01 — First-time KYC: User completes initial identity verification across any channel and receives a portable VC.
UC-02 — Cross-institution onboarding: User shares selective attributes from existing VC to a new FIU without fresh document submission.
UC-03 — Re-KYC: User satisfies periodic re-KYC by presenting an up-to-date VC; institution verifies freshness via credential timestamp and revocation registry.
UC-04 — Assisted onboarding: BC agent initiates verification on behalf of user; user biometric is captured locally and transmitted via compressed, encrypted payload.
UC-05 — ZK claim presentation: User proves derived claim (age ≥ 18, resident of state X, KYC tier ≥ 2) to institution without disclosing underlying attributes.
5. Functional Requirements
Requirements are prioritised P0 (must-have for launch), P1 (required within 6 months), and P2 (target within 12 months).
5.1 Identity Capture & Channel Support
Requirement ID
Description
Priority
Regulatory Anchor
FR-CAP-01
System shall support Aadhaar OTP-based eKYC via UIDAI XML pull, auto-populating name, DOB, address, and photo.
P0
RBI KYC MD 2016 §18
FR-CAP-02
System shall support DigiLocker API pull for PAN, Aadhaar, driving licence, and passport in machine-readable format.
P0
DigiLocker API v2.0
FR-CAP-03
System shall support live document scan (PAN, passport, DL) with OCR, tamper-detection, and MRZ validation.
P0
RBI MD §10, §12
FR-CAP-04
System shall support Video KYC with agent, complying with RBI Video-KYC guidelines including live photo capture.
P0
RBI circular 2020
FR-CAP-05
System shall provide an IVR-based assisted flow for feature-phone users with equivalent identity assurance.
P1
RBI Financial Inclusion mandate
FR-CAP-06
System shall support BC agent-assisted flows with offline-capable local capture and encrypted batch submission.
P1
RBI BC Framework 2006
FR-CAP-07
System shall compress all payloads for 2G-compatible transmission (target <50KB for credential verification response).
P1
Bharat Net / Digital India
5.2 Liveness & Deepfake Defence
Requirement ID
Description
Priority
Regulatory Anchor
FR-LIV-01
System shall perform passive liveness detection using 3D depth map analysis to detect flat-image and silicone-mask attacks.
P0
NIST SP 800-76-2
FR-LIV-02
System shall perform active challenge-response liveness: randomised head-turn, blink, and digit-read challenges.
P0
ISO/IEC 30107-3
FR-LIV-03
System shall run a GAN/diffusion artefact detector on all submitted video frames, blocking streams with SSIM deviation >0.12 from expected facial geometry.
P0
Internal Threat Model
FR-LIV-04
System shall validate camera API integrity to detect virtual camera drivers and frame injection at the OS level.
P0
OWASP Mobile Top 10
FR-LIV-05
System shall flag and reject biometric submissions where audio-visual synchronisation score falls below threshold (lip-sync attack detection).
P1
Internal Threat Model
FR-LIV-06
System shall maintain a liveness model versioning pipeline enabling model updates within 72 hours of a new attack vector being confirmed.
P1
Operational SLA
5.3 Credential Issuance
Requirement ID
Description
Priority
Regulatory Anchor
FR-CRED-01
System shall issue a W3C Verifiable Credential (VC Data Model 2.0) signed with Ed25519 over the institution's DID-anchored key.
P0
W3C VC Data Model 2.0
FR-CRED-02
System shall generate a Groth16 zero-knowledge proof circuit for each VC enabling derived claim proofs without attribute disclosure.
P0
DPDP Act 2023 §4
FR-CRED-03
System shall generate a BBS+ selective disclosure signature enabling per-attribute disclosure from a single credential.
P0
DPDP Act 2023 §6
FR-CRED-04
System shall store all credential material in the device's TEE (Trusted Execution Environment) or Secure Enclave, never in cloud storage.
P0
RBI Data Localisation, DPDP
FR-CRED-05
System shall register each issued credential's DID Document on the permissioned identity registry within 5 seconds of issuance.
P0
Operational SLA
FR-CRED-06
System shall sync credential metadata with DigiLocker as a linked document, visible to the user in their DigiLocker dashboard.
P1
DigiLocker API v2.0
FR-CRED-07
System shall support credential revocation via a Status List 2021-compliant revocation registry, with real-time revocation checks.
P0
W3C Status List 2021
5.4 Consent & Selective Disclosure
Requirement ID
Description
Priority
Regulatory Anchor
FR-CON-01
System shall present a granular per-attribute consent UI before any disclosure, with plain-language descriptions in 12 Indian languages.
P0
DPDP Act 2023 §6, AA Framework
FR-CON-02
System shall log every consent grant and revocation in an immutable audit trail with timestamp, requesting FIU ID, and attributes approved.
P0
DPDP Act 2023 §8
FR-CON-03
System shall allow users to revoke consent for a specific FIU at any time, triggering immediate credential suspension for that relying party.
P0
DPDP Act 2023 §13
FR-CON-04
System shall support Account Aggregator consent artefact format (AA Framework v2) for FIU consent requests.
P1
RBI AA Framework
FR-CON-05
System shall support ZK proof presentation for derived claims: age ≥ N, KYC tier ≥ N, resident of state X, without disclosing raw attribute.
P0
DPDP Act 2023 §4
FR-CON-06
System shall expire consent grants automatically per user-specified duration, with pre-expiry notification.
P1
DPDP Act 2023 §6
5.5 Anomaly Detection
Requirement ID
Description
Priority
Regulatory Anchor
FR-ANOM-01
System shall compute a real-time synthetic identity risk score using graph analysis of PAN/Aadhaar usage across known identity nodes.
P0
Internal Fraud Model
FR-ANOM-02
System shall flag submissions where the selfie biometric does not match the document photo with confidence >99.5% (FAR <0.01%).
P0
NIST FRVT
FR-ANOM-03
System shall detect velocity abuse: >3 KYC attempts from same device fingerprint within 24 hours triggers mandatory human review.
P0
Internal Fraud Model
FR-ANOM-04
System shall detect geolocation inconsistency: IP geolocation differing >500km from Aadhaar address triggers enhanced due diligence.
P1
Internal Fraud Model
FR-ANOM-05
System shall feed anomaly signals back to the biometric verdict gate as a continuous risk score, tightening thresholds for flagged identities.
P1
Internal Architecture
FR-ANOM-06
System shall generate a SAR (Suspicious Activity Report) formatted output for compliance team review within 1 hour of a positive anomaly flag.
P0
RBI KYC MD 2016 §67
6. Non-Functional Requirements
6.1 Performance
Liveness verdict latency
<3 seconds on 4G; <8 seconds on 2G (with compressed payload)
Credential issuance time
<10 seconds from biometric verdict to VC in wallet
ZK proof generation time
<5 seconds on mid-range Android device (Snapdragon 695 or equivalent)
Selective disclosure verification
<500ms at FIU verifier node
Cross-institution onboarding (re-KYC)
<60 seconds end-to-end for returning user with valid VC
Anomaly engine score
Computed and attached to session within 2 seconds of submission
6.2 Security
All communication between wallet, issuer, and verifier shall use TLS 1.3 with certificate pinning.
Private keys shall never leave the device TEE. All signing operations are performed in-enclave.
The permissioned DID registry shall be accessible only to RBI-regulated FIUs with valid digital certificates.
Penetration testing shall be conducted quarterly by a CERT-In empanelled auditor.
The platform shall undergo a formal cryptographic review of ZK circuits before production deployment.
All personally identifiable data in transit and at rest shall be encrypted using AES-256-GCM.
6.3 Availability & Reliability
Platform availability SLA
99.95% uptime (< 4.4 hours downtime/year)
Credential verification availability
99.99% (verification must succeed even during issuer downtime via cached DID document)
Disaster recovery RTO
< 4 hours
Disaster recovery RPO
< 1 hour (no credential data is stored centrally; RPO applies to audit logs only)
6.4 Accessibility & Inclusivity
All mobile UI components shall comply with WCAG 2.1 AA.
IVR flow shall support 12 scheduled languages per the Eighth Schedule of the Constitution of India.
Consent UI shall use plain language at a Grade 6 reading level in all supported languages.
The platform shall function on Android 8.0+ (Go Edition included) and iOS 13+.
Document scan shall function in ambient lighting conditions as low as 50 lux.
7. System Architecture Overview
7.1 Component Summary
The platform comprises five integrated layers, each independently scalable and replaceable:
Layer
Components
Technology Stack
Capture & Channel
Mobile SDK, Web SDK, IVR adapter, BC agent app
React Native, WebRTC, Asterisk IVR
Liveness & Defence
Deepfake detector, 3D liveness, injection guard, verdict gate
PyTorch, MediaPipe, proprietary GAN detector
Credential Engine
KYC processor, VC issuer, ZK circuit compiler, SD-JWT generator
Hyperledger AnonCreds, snarkjs, IETF SD-JWT
Identity Wallet
Secure enclave key manager, VC store, consent manager, disclosure UI
Android Keystore, iOS Secure Enclave, DIF Wallet SDK
Anomaly & Audit
Graph anomaly engine, velocity monitor, audit log, SAR generator
Apache Flink, Neo4j, OpenTelemetry
7.2 Data Flow Principles
No PII leaves the issuing institution's perimeter after credential issuance. Verifying institutions receive only proofs and disclosed attributes.
The identity wallet is the sole source of credential material. The platform has no server-side wallet or credential cache.
Audit logs capture every event (capture, verdict, issuance, disclosure, revocation) but store only pseudonymised identifiers, not raw PII.
All ZK proof verification is deterministic and stateless — verifier nodes hold no user state.
7.3 Integration Points
UIDAI / Aadhaar OTP
eKYC XML pull via AUA/KUA licensed integration
DigiLocker API v2.0
Document pull and credential metadata sync
Account Aggregator
Consent artefact exchange with FIP and FIU
CKYC Registry (CERSAI)
Upload of KYC records for CKYC compliance
RBI Regulatory Sandbox
Reporting endpoint for Sandbox participants
FIU Verifier API
REST + gRPC API for on-demand VC and ZK proof verification
8. Regulatory & Compliance Requirements
8.1 Applicable Regulations
Regulation
Obligation
Platform Response
RBI KYC Master Direction 2016
Customer identification, document verification, re-KYC periodicity
Full eKYC + VKYC flow; VC freshness timestamp satisfies re-KYC
DPDP Act 2023
Informed consent, data minimisation, right to erasure
Granular consent UI; ZK proofs eliminate unnecessary disclosure; wallet deletion triggers revocation
Prevention of Money Laundering Act 2002
Record-keeping, STR/SAR filing, beneficial ownership
Immutable audit log; automated SAR generation on anomaly flags
IT Act 2000 (Amended)
Data security, encryption standards
AES-256-GCM at rest, TLS 1.3 in transit, HSM for issuer keys
DigiLocker API Terms
No central storage of pulled documents
Documents processed in memory; only extracted attributes retained
Account Aggregator Framework
Consent artefact format, FIP/FIU roles
AA v2 consent artefact generation and validation
8.2 Biometric Data Handling
CRITICAL
Biometric templates are hashed using a privacy-preserving fuzzy commitment scheme (Juels-Wattenberg) and stored only in the issuing institution's HSM. Raw templates are never transmitted, stored in the wallet, or accessible to any party other than the issuing institution's liveness system.
9. Success Metrics & OKRs
Measurement cadence: weekly for operational metrics, monthly for fraud metrics, quarterly for user experience metrics.
Metric
Baseline
Target (12 mo.)
Stretch (24 mo.)
First-time KYC completion rate
67% (industry avg.)
85%
93%
Onboarding time (first KYC)
8–14 days
< 8 minutes
< 5 minutes
Cross-institution onboarding time
3–7 days (fresh KYC)
< 60 seconds
< 20 seconds
Deepfake / injection block rate
~62% (2D liveness)
> 99.5%
> 99.9%
Synthetic identity detection rate
~41% (rule-based)
> 92%
> 97%
False positive rate (legitimate users blocked)
N/A
< 0.5%
< 0.1%
ZK proof adoption (of eligible disclosures)
0%
40%
75%
User consent revocation rate
N/A
< 2% / month
< 1% / month
IVR / assisted flow completion rate
~30% (branch-only)
> 70%
> 85%
Platform availability
N/A
99.95%
99.99%
10. Risks & Mitigations
Risk
Severity
Mitigation
Owner
Deepfake model outpaces detector
Critical
72-hour model update SLA; red-team adversarial testing monthly; fallback to human review for high-risk sessions
ML Engineering
UIDAI API downtime breaks first-time KYC
High
Cache last-successful eKYC XML for 24 hours; fallback to VKYC-only flow during UIDAI outage
Platform Engineering
ZK circuit vulnerability (soundness bug)
Critical
Formal verification of circuits before deployment; third-party cryptographic audit; circuit versioning with rollback
Cryptography Team
User key loss (device loss / wipe)
High
Credential re-issuance flow using original issuing institution; no cloud key backup (by design); recovery requires fresh liveness check
Product / Support
Regulatory non-compliance (DPDP enforcement)
High
DPO appointed; DPIA conducted; data minimisation by design; legal review of each jurisdiction before launch
Legal / Compliance
Low-literacy user abandonment in IVR flow
Medium
Usability testing with target cohort in 3 states before launch; BC agent as fallback; progressive disclosure of complexity
Design / Inclusion
11. Delivery Timeline
Phase 0 — Foundation (Months 1–2)
Regulatory filings: RBI Regulatory Sandbox application, UIDAI AUA/KUA license, DigiLocker API partner onboarding.
Cryptographic architecture review: ZK circuit design, BBS+ signature scheme, DID registry selection.
Threat modelling: adversarial red-team exercise against liveness and injection attack vectors.
Inclusive design research: field research with BC agents and rural users in 2 states.
Phase 1 — Core MVP (Months 3–5)
Aadhaar OTP eKYC + DigiLocker pull integration.
3D liveness + GAN deepfake detector v1 (targets FR-LIV-01 through FR-LIV-03).
VC issuance with Ed25519 signing and DID registry registration.
Basic selective disclosure via SD-JWT.
Mobile wallet (Android and iOS) with TEE key storage.
Anomaly engine v1: velocity and biometric mismatch flags.
Phase 2 — Privacy & Interop (Months 6–8)
ZK proof circuit (Groth16) for derived claims.
BBS+ signature support for per-attribute disclosure.
Account Aggregator consent artefact integration.
FIU verifier API (REST + gRPC) for cross-institution re-KYC.
Anomaly engine v2: graph-based synthetic identity detection.
Phase 3 — Inclusion & Scale (Months 9–12)
IVR-based assisted flow for feature-phone users (12 languages).
BC agent offline-capable app with encrypted batch submission.
Audio-visual sync (lip-sync) attack detection.
CKYC registry upload integration.
Performance optimisation for 2G-compatible payloads.
Third-party cryptographic audit and penetration test.
Go-Live Criteria
Platform achieves >99.5% deepfake block rate, <0.5% false positive rate, <8 minute end-to-end first KYC time, and successful RBI Regulatory Sandbox exit assessment before general availability.
12. Open Questions
ZK trusted setup ceremony: The Groth16 circuit requires a multi-party computation trusted setup. Who are the ceremony participants and how is the setup ceremony governed?
Cross-institution credential validity: Should a credential issued by a co-operative bank be accepted by a scheduled commercial bank for onboarding? What is the minimum issuer assurance level?
Biometric template portability: If a user switches primary institution, can the biometric commitment be ported without fresh liveness, or does each institution require independent capture?
DPDP right to erasure: When a user requests erasure, the VC on-chain DID Document cannot be deleted (by design). What disclosure is required at onboarding and how is this reconciled with the Act?
Liveness model governance: Who owns the model update decision authority? What is the review process for an emergency model push in response to a confirmed zero-day attack?
IVR biometric assurance: Voice biometrics collected via IVR are inherently lower assurance than 3D liveness. Should IVR-initiated credentials be issued at KYC Tier 1 only, with Tier 2 requiring in-person or video follow-up?
13. Appendix
A. Glossary
AA Framework
RBI Account Aggregator framework — consent-based financial data sharing architecture
BBS+ Signature
Cryptographic signature scheme enabling selective disclosure of individual attributes
BC Agent
Business Correspondent — RBI-licensed intermediary providing banking services in unbanked areas
DID
Decentralised Identifier — W3C standard for verifiable, self-sovereign digital identifiers
DigiLocker
MeitY-operated document wallet allowing citizens to store and share government-issued documents
FAR
False Acceptance Rate — rate at which a biometric system incorrectly accepts an impostor
FIU
Financial Information User — entity requesting financial data under the AA framework
Groth16
A zk-SNARK proving system with succinct proofs and fast verification, used for ZK claim generation
HSM
Hardware Security Module — tamper-resistant hardware for cryptographic key storage and operations
KYC Tier
RBI's tiered KYC classification: Tier 1 (simplified), Tier 2 (basic), Tier 3 (full/enhanced)
SD-JWT
Selective Disclosure JWT — IETF standard for credentials with per-attribute disclosure
TEE
Trusted Execution Environment — isolated hardware environment for sensitive computations
UIDAI
Unique Identification Authority of India — Aadhaar issuing authority
VC
Verifiable Credential — W3C standard for cryptographically verifiable digital identity claims
VKYC
Video KYC — RBI-approved remote identity verification via live video call with agent
ZK Proof
Zero-Knowledge Proof — cryptographic proof that a statement is true without revealing underlying data
B. Standards & References
W3C Verifiable Credentials Data Model 2.0 — https://www.w3.org/TR/vc-data-model-2.0/
W3C Decentralised Identifiers (DIDs) v1.0 — https://www.w3.org/TR/did-core/
IETF SD-JWT — draft-ietf-oauth-selective-disclosure-jwt
ISO/IEC 30107-3 — Biometric Presentation Attack Detection
NIST SP 800-76-2 — Biometric Specifications for Personal Identity Verification
NIST FRVT — Face Recognition Vendor Test
RBI KYC Master Direction 2016 (as amended up to 2024)
RBI Video-KYC circular — DOR.AML.REC.No.28/14.01.001/2020-21
Digital Personal Data Protection Act 2023
Prevention of Money Laundering (Maintenance of Records) Rules 2005
DigiLocker API Documentation v2.0 — https://api.digitallocker.gov.in/
Account Aggregator Framework — RBI circular DNBR.PD.007/03.10.119/2016-17