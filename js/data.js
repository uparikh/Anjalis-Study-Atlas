// ==========================================================================
//  data.js  —  Anjali's study guides, encoded.
//  Mirrors the structure of "A&P Guide.pdf" and "Clinical Medicine I.pdf"
//  so the website reproduces the exact way she organized her notes.
// ==========================================================================

/* ----------------------------- A&P GUIDE ------------------------------- */
// Each system has an outline (her bulleted topics + sub-bullets). The
// sub-bullets become checklist items. Musculoskeletal also carries muscle
// region tables. `region` ties the system to a zone on the body map.

const AP_SYSTEMS = [
  {
    id: "body-org",
    name: "Body Organization",
    region: "core",
    blurb: "Orientation, chemistry, cells, and tissues — the foundation.",
    outline: [
      { topic: "Orientation", subs: ["Requirements for life", "Homeostasis", "Body Direction, Region, and Planes"] },
      { topic: "Chemistry/Biochemistry", subs: ["Types of Bonds", "Inorganic and Organic Compounds", "Carbohydrates", "Lipids", "Proteins", "DNA, RNA, and ATP"] },
      { topic: "Cells", subs: ["Plasma Membrane", "Cytoplasm", "Nucleus"] },
      { topic: "Tissues", subs: ["Epithelial Tissue", "Connective Tissue", "Muscular Tissue", "Nervous Tissue", "Tissue Repair"] }
    ]
  },
  {
    id: "integumentary",
    name: "Integumentary System",
    region: "skin",
    blurb: "Skin, hair, nails, glands, and skin cancer.",
    outline: [
      { topic: "Epidermis", subs: ["Function", "Anatomy"] },
      { topic: "Dermis", subs: ["Function", "Anatomy"] },
      { topic: "Melanin, Hair, and Nails", subs: ["Components of Skin Color", "Components of Hair", "Components of Nails"] },
      { topic: "Sebaceous and Sweat Glands", subs: ["Function"] },
      { topic: "Cancer", subs: [] }
    ]
  },
  {
    id: "musculoskeletal",
    name: "Musculoskeletal System",
    region: "msk",
    blurb: "Bones, joints, muscle tissue, and muscle tables by region.",
    has3d: true,
    outline: [
      { topic: "Bones and Skeletal Tissue", subs: ["Cartilage", "Function of Bone", "Anatomy of Bone", "Bone Repair and Disorders"] },
      { topic: "Skeleton", subs: ["Axial Skeleton", "Appendicular Skeleton"] },
      { topic: "Joints", subs: ["Classification", "Fibrous", "Cartilaginous", "Synovial", "Injury and Damage"] },
      { topic: "Muscles and Muscle Tissue", subs: ["Types of Muscle Tissue", "Skeletal Muscle", "Muscle Contraction", "Smooth Muscle"] },
      { topic: "Muscular System", subs: ["Movement", "Naming", "Arrangements"] }
    ],
    // Muscle region tables — columns mirror her sheet (diagram lives in its own box).
    muscleColumns: ["Muscle", "Description", "Origin", "Insertion", "Action", "Nerve Supply"],
    regions: [
      "Head",
      "Anterior Neck and Throat",
      "Neck and Vertebral Column",
      "Thorax",
      "Abdominal Wall",
      "Pelvic Floor and Perineum",
      "Anterior and Posterior Thorax",
      "Shoulder Joint",
      "Elbow Joint",
      "Forearm",
      "Hand",
      "Hip and Knee Joint",
      "Legs",
      "Foot"
    ]
  },
  {
    id: "cardiovascular",
    name: "Cardiovascular System",
    region: "heart",
    blurb: "Blood, heart, and the vascular tree.",
    outline: [
      { topic: "Blood", subs: ["Function", "Anatomy", "Erythrocytes", "Leukocytes", "Platelets"] },
      { topic: "Heart", subs: ["Anatomy", "Blood Flow", "Cardiac Cycle"] },
      { topic: "Blood Vessels", subs: ["Structure and Function", "Physiology of Circulation", "Pulmonary and Systemic Circulation", "Aorta and Major Arteries", "Arteries of Head and Neck", "Arteries of Upper Limbs and Thorax", "Arteries of Abdomen", "Arteries of Pelvis and Lower Limbs", "Venae Cavae and Major Veins", "Veins of Head and Neck", "Veins of Upper Limbs and Thorax", "Veins of Abdomen", "Veins of Pelvis and Lower Limbs"] }
    ]
  },
  {
    id: "lymphatic",
    name: "Lymphatic / Immune System",
    region: "lymph",
    blurb: "Lymphoid organs and innate + adaptive defenses.",
    outline: [
      { topic: "Lymphatic System, Lymphoid Organs and Tissues", subs: ["Components of Lymphatic System", "Organs", "Functions", "Spleen", "Lymphocytes"] },
      { topic: "Immune System: Innate and Adaptive Defenses", subs: ["Innate Defenses", "Adaptive Defenses", "Insufficient or Overactive Immune Response"] }
    ]
  },
  {
    id: "pulmonary",
    name: "Pulmonary System",
    region: "lungs",
    blurb: "Airway anatomy and the physiology of breathing.",
    outline: [
      { topic: "Anatomy", subs: ["Upper Respiratory System", "Lower Respiratory System"] },
      { topic: "Physiology", subs: ["Volume Change", "Gas Exchange", "Oxygen", "Respiratory Adjustments and Disease"] }
    ]
  },
  {
    id: "gastrointestinal",
    name: "Gastrointestinal System",
    region: "gi",
    blurb: "GI tract anatomy, digestion, nutrition, and metabolism.",
    outline: [
      { topic: "Overview", subs: ["Major Processes", "GI Tract"] },
      { topic: "Anatomy", subs: ["Mouth", "Pharynx and Esophagus", "Stomach", "Liver and Pancreas", "Small Intestine", "Large Intestine"] },
      { topic: "Physiology", subs: ["Digestion", "Nutrient Processing"] },
      { topic: "Nutrition", subs: ["Macro and Micro Nutrients"] },
      { topic: "Metabolism", subs: ["Carbohydrate", "Lipids", "Proteins/Amino Acids"] },
      { topic: "Energy Balance", subs: ["Basal Metabolic Rate"] }
    ]
  },
  {
    id: "nervous",
    name: "Nervous System",
    region: "brain",
    blurb: "Neurons, CNS, PNS, and the autonomic system.",
    outline: [
      { topic: "Fundamentals of the Nervous System and Nervous Tissue", subs: ["Resting Membrane Potential", "Action Potential", "Chemical Synapse", "Neurons"] },
      { topic: "Central Nervous System", subs: ["Cerebral Hemisphere", "Diencephalon", "Brain Stem", "Cerebellum", "Brain Injuries", "Spinal Cord"] },
      { topic: "Peripheral Nervous System", subs: ["Sensory Receptors and Sensation", "Nerves (Structure and Repair)", "Motor Endings and Activity", "Reflex"] },
      { topic: "Autonomic Nervous System", subs: ["Function", "Parasympathetic", "Sympathetic", "Neurotransmitters"] }
    ]
  },
  {
    id: "endocrine",
    name: "Endocrine System",
    region: "endo",
    blurb: "Hormones and the glands that make them.",
    outline: [
      { topic: "Function", subs: ["Chemical Structure of Hormones", "Stimuli and Hormones"] },
      { topic: "Pituitary Gland", subs: ["Function", "Components", "Hormones"] },
      { topic: "Thyroid", subs: ["Function", "Components", "Hormones"] },
      { topic: "Parathyroid", subs: ["Function", "Components", "Hormones"] },
      { topic: "Adrenal Glands", subs: ["Function", "Components", "Hormones"] },
      { topic: "Pineal Gland", subs: [] },
      { topic: "Pancreas, Gonads, and More", subs: ["Components", "Hormones"] }
    ]
  },
  {
    id: "urinary",
    name: "Urinary System",
    region: "kidney",
    blurb: "Kidneys, urine formation, fluids, and acid-base.",
    outline: [
      { topic: "Anatomy", subs: ["Kidneys", "Ureters", "Bladder", "Urethra"] },
      { topic: "Urine Formation", subs: ["Step 1", "Step 2", "Step 3"] },
      { topic: "Renal Function", subs: [] },
      { topic: "Fluids", subs: ["Intake and Output"] },
      { topic: "Electrolyte", subs: ["Sodium, Potassium, Phosphate, and Calcium"] },
      { topic: "Acid-Base", subs: ["pH Changes"] }
    ]
  },
  {
    id: "reproductive",
    name: "Reproductive System",
    region: "repro",
    blurb: "Reproductive anatomy, development, and genetics.",
    outline: [
      { topic: "Female Reproductive System", subs: ["Function", "Anatomy", "Physiology"] },
      { topic: "Male Reproductive System", subs: ["Function", "Anatomy", "Physiology"] },
      { topic: "Human Development", subs: ["Embryonic Development", "Pregnancy", "Newborn Development", "Reproductive Technologies"] },
      { topic: "Genetics", subs: ["Variation", "Phenotyping", "Environmental Factors", "Genetic Disorders"] }
    ]
  }
];

/* ------------------------ CLINICAL MEDICINE I -------------------------- */
// Each specialty has an "Overview / Need to Know" table and one or more
// disease tables. Columns mirror her sheet exactly.

const CLINICAL_OVERVIEW_COLUMNS = ["Topic", "Overview / Need to Know"];
const CLINICAL_TABLE_COLUMNS = [
  "Type", "Pathophysiology", "Causes / RFs", "S/SX",
  "PE / Diagnosis", "Treatment", "Picture or Prognosis"
];

const CLINICAL_SPECIALTIES = [
  { id: "immunology", name: "Immunology", blurb: "Hypersensitivity, immunodeficiency, and autoimmune disease." },
  { id: "dermatology", name: "Dermatology", blurb: "Lesions, rashes, infections, and skin cancers." },
  { id: "gastroenterology", name: "Gastroenterology", blurb: "GI and hepatobiliary disease." },
  { id: "endocrinology", name: "Endocrinology", blurb: "Glandular and metabolic disorders." }
];

// Default rows so a fresh template looks like her blank sheet.
const DEFAULT_OVERVIEW_ROWS = 3;
const DEFAULT_TABLE_ROWS = 8;

window.GUIDE = {
  ap: AP_SYSTEMS,
  clinical: {
    specialties: CLINICAL_SPECIALTIES,
    overviewColumns: CLINICAL_OVERVIEW_COLUMNS,
    tableColumns: CLINICAL_TABLE_COLUMNS,
    defaultOverviewRows: DEFAULT_OVERVIEW_ROWS,
    defaultTableRows: DEFAULT_TABLE_ROWS
  }
};
