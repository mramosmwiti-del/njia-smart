export type IctProjectTemplate = {
  serviceType: string;
  label: string;
  description: string;
  milestones: { title: string; stage: string }[];
};

/** Default delivery plans for new ICT projects. Existing projects are not changed. */
export const ICT_PROJECT_TEMPLATES: IctProjectTemplate[] = [
  {
    serviceType: "network_installation",
    label: "Network installation & configuration",
    description: "Network requirements, design, installation, testing and handover.",
    milestones: [
      { title: "Requirements and site survey", stage: "kickoff" },
      { title: "Network design and bill of materials", stage: "information" },
      { title: "Equipment procurement and readiness", stage: "information" },
      { title: "Installation and configuration", stage: "analysis" },
      { title: "Connectivity, security and performance tests", stage: "draft" },
      { title: "Internal technical review", stage: "review" },
      { title: "Client training and handover", stage: "signoff" },
    ],
  },
  {
    serviceType: "software_implementation",
    label: "Software development / implementation",
    description: "Requirements, solution configuration, testing, deployment and handover.",
    milestones: [
      { title: "Requirements and acceptance criteria", stage: "kickoff" },
      { title: "Solution design and implementation plan", stage: "information" },
      { title: "Configuration or development", stage: "analysis" },
      { title: "User acceptance testing", stage: "draft" },
      { title: "Security, backup and recovery checks", stage: "review" },
      { title: "Production deployment", stage: "review" },
      { title: "User training and client sign-off", stage: "signoff" },
    ],
  },
  {
    serviceType: "hardware_deployment",
    label: "Hardware supply & deployment",
    description: "Hardware specification, procurement, deployment, inventory and sign-off.",
    milestones: [
      { title: "Confirm specifications and quantities", stage: "kickoff" },
      { title: "Procurement and supplier confirmation", stage: "information" },
      { title: "Asset tagging and inventory recording", stage: "analysis" },
      { title: "Installation and user setup", stage: "draft" },
      { title: "Device testing and acceptance", stage: "review" },
      { title: "Handover and user acknowledgement", stage: "signoff" },
    ],
  },
  {
    serviceType: "cybersecurity_assessment",
    label: "Cybersecurity assessment",
    description: "Scope, authorized assessment, findings, remediation recommendations and report.",
    milestones: [
      { title: "Scope, authorization and rules of engagement", stage: "kickoff" },
      { title: "Asset and risk discovery", stage: "information" },
      { title: "Authorized security assessment", stage: "analysis" },
      { title: "Validate findings and severity", stage: "draft" },
      { title: "Prepare remediation recommendations", stage: "review" },
      { title: "Present report and obtain client sign-off", stage: "signoff" },
    ],
  },
  {
    serviceType: "maintenance_support",
    label: "Maintenance & support engagement",
    description: "Baseline review, maintenance work, verification and service report.",
    milestones: [
      { title: "Confirm scope and maintenance window", stage: "kickoff" },
      { title: "Baseline and backup checks", stage: "information" },
      { title: "Maintenance and updates", stage: "analysis" },
      { title: "Post-maintenance testing", stage: "draft" },
      { title: "Document changes and outstanding risks", stage: "review" },
      { title: "Service report and client confirmation", stage: "signoff" },
    ],
  },
  {
    serviceType: "cloud_migration",
    label: "Cloud migration / backup & recovery",
    description: "Migration planning, backup validation, controlled migration and recovery testing.",
    milestones: [
      { title: "Discovery and migration scope", stage: "kickoff" },
      { title: "Architecture, dependencies and migration plan", stage: "information" },
      { title: "Backup and rollback validation", stage: "analysis" },
      { title: "Migration rehearsal and approval", stage: "draft" },
      { title: "Production migration and verification", stage: "review" },
      { title: "Recovery test, documentation and handover", stage: "signoff" },
    ],
  },
];

export const ICT_GENERAL_TEMPLATE: IctProjectTemplate = {
  serviceType: "general",
  label: "General ICT engagement",
  description: "General ICT service delivery project.",
  milestones: [],
};
